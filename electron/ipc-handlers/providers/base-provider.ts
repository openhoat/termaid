import fs from 'node:fs'
import path from 'node:path'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { AIMessage, HumanMessage } from '@langchain/core/messages'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { stripAnsiCodes, stripOscSequences } from '@shared/ansi'
import type {
  AICommand,
  CommandInterpretation,
  ConversationMessage,
  StreamingCallback,
  SystemContext,
} from '@shared/types'
import { z } from 'zod'
import { contextService } from '../../services/contextService'
import { Logger } from '../../utils/logger'

// ============================================================================
// Provider Interfaces
// ============================================================================

/**
 * Result of configuration validation
 */
export interface ValidationResult {
  /** Whether the configuration is valid */
  valid: boolean
  /** Error message if validation failed */
  error?: string
}

/**
 * Generic factory interface for creating LLM providers
 * @template TConfig - The provider-specific configuration type
 */
export interface IProviderFactory<TConfig> {
  /** Unique identifier for this provider */
  readonly name: string
  /** Metadata describing the provider */
  readonly metadata: {
    name: string
    displayName: string
    description?: string
    version?: string
    requiresApiKey: boolean
    supportsStreaming: boolean
    websiteUrl?: string
    icon?: string
  }
  /**
   * Create a new provider instance
   * @param config - Provider-specific configuration
   */
  create(config: TConfig): ILLMProvider
  /**
   * Validate the configuration for this provider
   * @param config - Configuration to validate
   * @returns Type predicate indicating if config is valid
   */
  validateConfig(config: unknown): config is TConfig
  /**
   * Get the default configuration for this provider
   * @returns Default configuration object
   */
  getDefaultConfig(): TConfig
  /**
   * List available models for this provider
   * @param config - Provider configuration
   * @returns List of model identifiers
   */
  listModels(config: TConfig): Promise<string[]>
  /**
   * Test connection to the provider
   * @param config - Provider configuration
   * @returns True if connection successful
   */
  testConnection(config: TConfig): Promise<boolean>
}

/**
 * Interface for LLM provider implementations
 * Defines the core operations all providers must support
 */
export interface ILLMProvider {
  /**
   * Generate a shell command from natural language description
   * @param prompt - Natural language description of desired command
   * @param conversationHistory - Previous conversation messages for context
   * @param language - User interface language (default: 'en')
   * @returns Generated AI command with metadata
   */
  generateCommand(
    prompt: string,
    conversationHistory?: ConversationMessage[],
    language?: string
  ): Promise<AICommand>

  /**
   * Stream a shell command generation with progress callbacks
   * @param prompt - Natural language description of desired command
   * @param conversationHistory - Previous conversation messages for context
   * @param language - User interface language
   * @param onProgress - Callback for streaming progress updates
   * @param signal - AbortSignal for cancellation
   * @returns Generated AI command with metadata
   */
  streamCommand(
    prompt: string,
    conversationHistory: ConversationMessage[] | undefined,
    language: string,
    onProgress: StreamingCallback,
    signal?: AbortSignal
  ): Promise<AICommand>

  /**
   * Explain a shell command in natural language
   * @param command - Shell command to explain
   * @returns Human-readable explanation
   */
  explainCommand(command: string): Promise<string>

  /**
   * Interpret terminal output and provide insights
   * @param output - Raw terminal output to interpret
   * @param language - User interface language (default: 'en')
   * @returns Structured interpretation with summary, findings, and recommendations
   */
  interpretOutput(output: string, language?: string): Promise<CommandInterpretation>

  /**
   * Test connection to LLM provider
   * @returns True if connection successful
   */
  testConnection(): Promise<boolean>

  /**
   * List available models from LLM provider
   * @returns Array of model identifiers
   */
  listModels(): Promise<string[]>
}

// Logger instance
const logger = new Logger('BaseLLMProvider')

// Constants
const MAX_CONVERSATION_HISTORY = 50
const MAX_OUTPUT_LINES = 200
const DEFAULT_TEMPERATURE = 0.7
const DEFAULT_MAX_TOKENS = 2000

/**
 * Clean terminal output by removing ANSI codes, OSC sequences, and control characters
 */
function cleanTerminalOutput(str: string): string {
  return (
    stripOscSequences(stripAnsiCodes(str))
      .replace(/\r/g, '')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: required for ANSI escape sequence stripping
      .replace(/\u001B\[\?[0-9;]*[hl]/g, '')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: required for OSC sequence stripping
      .replace(/\u001B\].*?(\u0007|\u001B\\)/g, '')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: required for ANSI escape sequence stripping
      .replace(/\u001B\[[0-9;]*[A-Za-z]/g, '')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: required for control character removal
      .replace(/[\u0000-\u0009\u000B-\u001F]/g, '')
      .trim()
  )
}

function loadPrompt(filename: string): string {
  const promptsDir = path.join(__dirname, '..', '..', 'prompts')
  const filePath = path.join(promptsDir, filename)
  return fs.readFileSync(filePath, 'utf-8')
}

const SILENT_COMMANDS = new Set([
  'mkdir',
  'touch',
  'cp',
  'mv',
  'rm',
  'ln',
  'chmod',
  'chown',
  'cd',
  'pushd',
  'popd',
  'source',
  'export',
  'alias',
  'unset',
  'set',
  'let',
  'typeset',
  'declare',
  'local',
])

function isSilentCommand(command: string): boolean {
  const cmdName = command.trim().split(/\s+/)[0]?.toLowerCase()
  return cmdName ? SILENT_COMMANDS.has(cmdName) : false
}

function commandSummary(command: string, language: string): string {
  const cmdName = command.trim().split(/\s+/)[0]
  if (language === 'fr') {
    return `Commande exécutée avec succès : ${cmdName} n'a produit aucune sortie (comportement normal)`
  }
  return `Command executed successfully: ${cmdName} produced no output (normal behavior)`
}

/**
 * Extract recent commands from conversation history
 */
export function extractRecentCommands(conversationHistory?: ConversationMessage[]): string[] {
  if (!conversationHistory || conversationHistory.length === 0) {
    return []
  }
  return conversationHistory
    .filter(msg => msg.role === 'assistant' && msg.command)
    .map(msg => msg.command as string)
    .slice(-5)
}

/**
 * Format environment context into a readable block for the prompt
 */
export function formatContextBlock(context: SystemContext): string {
  const lines: string[] = [
    `Working directory: ${context.cwd}`,
    `OS: ${context.os.platform}${context.os.distro ? ` (${context.os.distro})` : ''} ${context.os.release} ${context.os.arch}`,
    `Hostname: ${context.os.hostname}`,
    `Shell: ${context.shell}`,
  ]

  if (context.git.isRepo) {
    const gitParts = [`Git: branch: ${context.git.branch || 'HEAD'}`]
    if (context.git.status) {
      const changeCount = context.git.status.split('\n').length
      gitParts.push(`${changeCount} file(s) modified`)
    } else {
      gitParts.push('clean working tree')
    }
    lines.push(gitParts.join(' — '))
  } else {
    lines.push('Git: not a git repository')
  }

  lines.push(`Project type: ${context.projectType}`)
  if (context.projectFiles.length > 0) {
    lines.push(`Detected files: ${context.projectFiles.join(', ')}`)
  }
  lines.push(`Docker: ${context.hasDocker ? 'available' : 'not available'}`)

  if (context.recentCommands.length > 0) {
    lines.push(`Recent commands: ${context.recentCommands.join(' | ')}`)
  }

  return lines.join('\n')
}

/**
 * Abstract base class for LLM providers
 * Contains shared logic for command generation, explanation, and output interpretation
 */
export abstract class BaseLLMProvider implements ILLMProvider {
  protected model!: BaseChatModel
  protected temperature: number
  protected maxTokens: number

  constructor(temperature?: number, maxTokens?: number) {
    this.temperature = temperature ?? DEFAULT_TEMPERATURE
    this.maxTokens = maxTokens ?? DEFAULT_MAX_TOKENS
  }

  /**
   * Generate a shell command from natural language description
   */
  async generateCommand(
    prompt: string,
    conversationHistory?: ConversationMessage[],
    language: string = 'en'
  ): Promise<AICommand> {
    const systemPrompt = loadPrompt('system-prompt.md')

    const context = await contextService.getContext(extractRecentCommands(conversationHistory))
    const contextBlock = formatContextBlock(context)
    const contextualizedPrompt = systemPrompt.replace('{{environment_context}}', contextBlock)

    const messages: (HumanMessage | AIMessage)[] = []

    if (conversationHistory && conversationHistory.length > 0) {
      const limitedHistory = conversationHistory.slice(-MAX_CONVERSATION_HISTORY)
      for (const msg of limitedHistory) {
        if (msg.role === 'user') {
          messages.push(new HumanMessage(msg.content))
        } else {
          messages.push(new AIMessage(msg.content))
        }
      }
    }

    const enhancedSystemPrompt = `${contextualizedPrompt}\n\n[Language hint: User interface language is ${language}]`

    const commandSchema = z.object({
      type: z.enum(['command', 'text']),
      intent: z.string().optional(),
      command: z.string().optional(),
      explanation: z.string().optional(),
      confidence: z.number().optional(),
      content: z.string().optional(),
    })

    const promptTemplate = ChatPromptTemplate.fromMessages([
      ['system', enhancedSystemPrompt],
      new MessagesPlaceholder('history'),
      ['human', '{input}'],
    ])

    const chain = promptTemplate.pipe(this.model.withStructuredOutput(commandSchema))

    try {
      const result = await chain.invoke({ input: prompt, history: messages })

      if (result.type === 'text') {
        return {
          type: 'text',
          content: result.content || '',
        }
      }

      return {
        type: 'command',
        intent: result.intent || 'Execute command',
        command: result.command || '',
        explanation: result.explanation || '',
        confidence: result.confidence || 0.5,
      }
    } catch (error) {
      logger.error('Structured output failed, using fallback', error)
      let fallbackResponseText: string | null = null

      try {
        const fallbackChain = ChatPromptTemplate.fromMessages([
          ['system', enhancedSystemPrompt],
          new MessagesPlaceholder('history'),
          ['human', '{input}'],
        ]).pipe(this.model)

        const fallbackResult = await fallbackChain.invoke({ input: prompt, history: messages })
        fallbackResponseText = fallbackResult.content as string
      } catch (fallbackError) {
        const isQuotaError =
          String(fallbackError).includes('429') ||
          String(fallbackError).toLowerCase().includes('usage limit')
        return {
          type: 'text',
          content: this.getFallbackMessage(
            isQuotaError ? 'quota_exceeded' : 'parsing_failed',
            language
          ),
        }
      }

      const codeBlockMatch = fallbackResponseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      const textToSearch = codeBlockMatch ? codeBlockMatch[1] : fallbackResponseText

      let jsonMatch = textToSearch.match(/\{[^{}]*"type"[^{}]*\}/)
      if (!jsonMatch) {
        jsonMatch = textToSearch.match(/\{(?:[^{}]|\{[^{}]*\})*\}/)
      }

      if (!jsonMatch) {
        return { type: 'text', content: fallbackResponseText.trim() }
      }

      try {
        const parsed = JSON.parse(jsonMatch[0])
        const validated = commandSchema.parse(parsed)

        if (validated.type === 'text') {
          return { type: 'text', content: validated.content || '' }
        }

        return {
          type: 'command',
          intent: validated.intent || 'Execute command',
          command: validated.command || '',
          explanation: validated.explanation || '',
          confidence: validated.confidence || 0.5,
        }
      } catch (parseError) {
        logger.error('Failed to parse fallback JSON response', parseError)
        return { type: 'text', content: fallbackResponseText.trim() }
      }
    }
  }

  /**
   * Stream a shell command generation with progress callbacks
   * This method streams text response and parses it at the end
   */
  async streamCommand(
    prompt: string,
    conversationHistory: ConversationMessage[] | undefined,
    language: string,
    onProgress: StreamingCallback,
    signal?: AbortSignal
  ): Promise<AICommand> {
    const systemPrompt = loadPrompt('system-prompt.md')

    const context = await contextService.getContext(extractRecentCommands(conversationHistory))
    const contextBlock = formatContextBlock(context)
    const contextualizedPrompt = systemPrompt.replace('{{environment_context}}', contextBlock)

    const messages: (HumanMessage | AIMessage)[] = []

    if (conversationHistory && conversationHistory.length > 0) {
      const limitedHistory = conversationHistory.slice(-MAX_CONVERSATION_HISTORY)
      for (const msg of limitedHistory) {
        if (msg.role === 'user') {
          messages.push(new HumanMessage(msg.content))
        } else {
          messages.push(new AIMessage(msg.content))
        }
      }
    }

    const enhancedSystemPrompt = `${contextualizedPrompt}\n\n[Language hint: User interface language is ${language}]`

    // Notify connecting
    onProgress({ type: 'connecting' })

    try {
      const promptTemplate = ChatPromptTemplate.fromMessages([
        ['system', enhancedSystemPrompt],
        new MessagesPlaceholder('history'),
        ['human', '{input}'],
      ])

      const chain = promptTemplate.pipe(this.model)

      // Stream the response
      const stream = await chain.stream({ input: prompt, history: messages })

      let accumulatedContent = ''

      // Notify receiving started
      onProgress({ type: 'receiving' })

      for await (const chunk of stream) {
        // Check for abort
        if (signal?.aborted) {
          onProgress({ type: 'error', error: 'Request cancelled' })
          return { type: 'text', content: accumulatedContent }
        }

        const content = chunk.content
        if (typeof content === 'string') {
          accumulatedContent += content
          // Send partial content update
          onProgress({
            type: 'receiving',
            content: accumulatedContent,
          })
        }
      }

      // Notify processing
      onProgress({ type: 'processing', content: accumulatedContent })

      // Parse the accumulated content
      const result = this.parseCommandResponse(accumulatedContent, language)

      // Notify complete
      onProgress({ type: 'complete', partialCommand: result })

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      onProgress({ type: 'error', error: errorMessage })

      // Check if it's a quota error
      const isQuotaError =
        errorMessage.includes('429') || errorMessage.toLowerCase().includes('usage limit')

      return {
        type: 'text',
        content: this.getFallbackMessage(
          isQuotaError ? 'quota_exceeded' : 'parsing_failed',
          language
        ),
      }
    }
  }

  /**
   * Parse command response from accumulated text
   */
  private parseCommandResponse(responseText: string, _language: string): AICommand {
    const commandSchema = z.object({
      type: z.enum(['command', 'text']),
      intent: z.string().optional(),
      command: z.string().optional(),
      explanation: z.string().optional(),
      confidence: z.number().optional(),
      content: z.string().optional(),
    })

    // Try to extract JSON from code block first
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    const textToSearch = codeBlockMatch ? codeBlockMatch[1] : responseText

    // Try to find JSON object
    let jsonMatch = textToSearch.match(/\{[^{}]*"type"[^{}]*\}/)
    if (!jsonMatch) {
      jsonMatch = textToSearch.match(/\{(?:[^{}]|\{[^{}]*\})*\}/)
    }

    if (!jsonMatch) {
      return { type: 'text', content: responseText.trim() }
    }

    try {
      const parsed = JSON.parse(jsonMatch[0])
      const validated = commandSchema.parse(parsed)

      if (validated.type === 'text') {
        return { type: 'text', content: validated.content || '' }
      }

      return {
        type: 'command',
        intent: validated.intent || 'Execute command',
        command: validated.command || '',
        explanation: validated.explanation || '',
        confidence: validated.confidence || 0.5,
      }
    } catch (parseError) {
      logger.error('Failed to parse JSON response', parseError)
      return { type: 'text', content: responseText.trim() }
    }
  }

  /**
   * Explain a shell command
   */
  async explainCommand(command: string): Promise<string> {
    const promptTemplate = loadPrompt('explain-command-prompt.md')
    const context = await contextService.getContext(extractRecentCommands())
    const contextBlock = formatContextBlock(context)
    const prompt = promptTemplate
      .replace('{command}', command)
      .replace('{{environment_context}}', contextBlock)

    const chatPrompt = ChatPromptTemplate.fromMessages([['human', prompt]])

    const chain = chatPrompt.pipe(this.model)

    try {
      const result = await chain.invoke({})
      return result.content as string
    } catch (error) {
      logger.error('Failed to explain command', error)
      return 'Unable to explain the command. Please try again.'
    }
  }

  /**
   * Extract generic observations from any command output.
   * Pure pattern discovery — no command-specific format assumptions.
   */
  private extractGenericFindings(text: string): string[] {
    const findings: string[] = []
    const rawLines = text.split('\n')
    const lines = rawLines.filter(l => l.trim().length > 0)
    if (lines.length === 0) return findings

    // Total block count (common in ls output — purely observational)
    const total = text.match(/^total\s+(\d+)/m)
    if (total && total[1] !== '0') {
      findings.push(`Total blocks: ${total[1]}`)
    }

    // Count lines with permission-like prefixes (generic UNIX listing pattern)
    const listingLines = lines.filter(l => /^[dlspc-][rwxst-]{9}\s/.test(l))
    if (listingLines.length > 0) {
      const dirs = listingLines.filter(l => l.trim().startsWith('d')).length
      const files = listingLines.filter(l => l.trim().startsWith('-')).length
      const links = listingLines.filter(l => l.trim().startsWith('l')).length
      const parts: string[] = []
      if (files > 0) parts.push(`${files} file${files > 1 ? 's' : ''}`)
      if (dirs > 0) parts.push(`${dirs} director${dirs > 1 ? 'ies' : 'y'}`)
      if (links > 0) parts.push(`${links} symlink${links > 1 ? 's' : ''}`)
      if (parts.length > 0) findings.push(parts.join(', '))
    }

    // Numbers with units (KB, MB, GB, KiB, MiB, GiB, %)
    const units = [
      ...new Set(
        Array.from(text.matchAll(/([\d.]+)\s*(KB|MB|GB|KiB|MiB|GiB|%)/gi)).map(
          m => `${m[1]} ${m[2].toUpperCase()}`
        )
      ),
    ].slice(0, 5)
    if (units.length > 0) findings.push(`Values: ${units.join(', ')}`)

    // Error/warning line counts
    const errorCount = lines.filter(l =>
      /error|fail|denied|cannot|no such file|not found/i.test(l)
    ).length
    const warningCount = lines.filter(l => /warning|deprecated/i.test(l)).length
    if (errorCount > 0) findings.push(`Errors: ${errorCount}`)
    if (warningCount > 0) findings.push(`Warnings: ${warningCount}`)

    findings.push(`${lines.length} line${lines.length > 1 ? 's' : ''}`)

    return findings
  }

  /**
   * Check if LLM interpretation result is too weak and needs enrichment
   */
  private needsEnrichment(interpretation: CommandInterpretation): boolean {
    if (!interpretation.successful) return false
    if (interpretation.key_findings.length < 2) return true
    return interpretation.key_findings.every(kf =>
      /command executed|output received|listed \d+ items|commande exécutée/i.test(kf)
    )
  }

  /**
   * Interpret terminal output
   */
  async interpretOutput(
    output: string,
    language = 'en',
    command?: string
  ): Promise<CommandInterpretation> {
    const cleanedOutput = cleanTerminalOutput(output)

    // Pre-validate empty output — check if command is a silent type
    if (cleanedOutput.trim().length === 0) {
      if (command && isSilentCommand(command)) {
        return {
          summary: commandSummary(command, language),
          key_findings: [`Command executed: ${command}`],
          warnings: [],
          errors: [],
          recommendations: [],
          successful: true,
        }
      }
      return {
        summary:
          language === 'fr'
            ? 'Commande exécutée sans produire de sortie'
            : 'Command executed with no output',
        key_findings: [],
        warnings: [],
        errors: [
          language === 'fr'
            ? 'Aucune sortie détectée - la commande peut avoir échoué ou ne rien retourner'
            : 'No output detected - command may have failed or returned nothing',
        ],
        recommendations: [
          language === 'fr'
            ? 'Vérifiez la syntaxe de la commande ou essayez une commande alternative'
            : 'Check command syntax or try an alternative command',
        ],
        successful: false,
      }
    }

    const lines = cleanedOutput.split('\n').slice(0, MAX_OUTPUT_LINES).join('\n')
    const systemPrompt = loadPrompt('interpret-output-prompt.md')
    const context = await contextService.getContext(extractRecentCommands())
    const contextBlock = formatContextBlock(context)
    const contextualizedPrompt = systemPrompt.replace('{{environment_context}}', contextBlock)

    const chatPrompt = ChatPromptTemplate.fromMessages([
      ['system', contextualizedPrompt],
      ['human', 'Command: {command}\nOutput:\n{command_output}'],
    ])

    const chain = chatPrompt.pipe(this.model)

    let result: CommandInterpretation | null = null
    let llmFailed = false

    try {
      const llmResult = await chain.invoke({
        command: command || 'unknown',
        command_output: lines,
        language,
      })
      const responseText = llmResult.content as string

      const jsonMatch = responseText.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        const interpretationSchema = z.object({
          summary: z.string(),
          key_findings: z.array(z.string()),
          warnings: z.array(z.string()),
          errors: z.array(z.string()),
          recommendations: z.array(z.string()),
          successful: z.boolean(),
        })

        const validated = interpretationSchema.parse(parsed)

        result = {
          summary: validated.summary || 'Command output received',
          key_findings: validated.key_findings || [],
          warnings: validated.warnings || [],
          errors: validated.errors || [],
          recommendations: validated.recommendations || [],
          successful: validated.successful ?? true,
        }
      } else {
        throw new Error('No JSON in LLM response')
      }
    } catch {
      llmFailed = true
    }

    // If LLM failed or result is too weak, use generic extraction
    if (result === null || llmFailed || (result !== null && this.needsEnrichment(result))) {
      const generic = this.extractGenericFindings(cleanedOutput)

      if (llmFailed || result === null) {
        const hasErrors = /error|fail|permission denied|cannot|no such file|not found/i.test(
          cleanedOutput
        )
        const isSuccessful = !hasErrors && cleanedOutput.trim().length > 0

        result = {
          summary: isSuccessful
            ? language === 'fr'
              ? 'Commande exécutée avec succès'
              : 'Command executed successfully'
            : language === 'fr'
              ? 'La commande a rencontré des erreurs'
              : 'Command encountered issues',
          key_findings: generic.length > 0 ? generic : ['Output received'],
          warnings: [],
          errors: hasErrors
            ? [
                cleanedOutput
                  .split('\n')
                  .filter(l => /error|fail|denied/i.test(l))[0]
                  ?.substring(0, 120) || 'Unknown error',
              ]
            : [],
          recommendations: hasErrors
            ? [
                language === 'fr'
                  ? 'Vérifiez la syntaxe et les permissions'
                  : 'Check command syntax and permissions',
              ]
            : [],
          successful: isSuccessful,
        }
      } else {
        // Enrich weak LLM result with generic findings
        for (const f of generic) {
          if (
            !result.key_findings.some(kf =>
              kf
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '')
                .includes(
                  f
                    .toLowerCase()
                    .split(':')[0]
                    .replace(/[^a-z0-9]/g, '')
                )
            )
          ) {
            result.key_findings.push(f)
          }
        }
      }
    }

    return result
  }

  /**
   * Test connection to LLM provider
   */
  abstract testConnection(): Promise<boolean>

  /**
   * List available models from LLM provider
   */
  abstract listModels(): Promise<string[]>

  /**
   * Get localized fallback messages for error cases
   */
  protected getFallbackMessage(
    errorType: 'unable_to_generate' | 'parsing_failed' | 'quota_exceeded',
    language: string
  ): string {
    const messages = {
      unable_to_generate: {
        en: "I couldn't generate a command for that request. Could you please clarify what you'd like me to do?",
        fr: "Je n'ai pas pu générer de commande pour cette demande. Pourriez-vous préciser ce que vous souhaitez que je fasse ?",
      },
      parsing_failed: {
        en: 'I had trouble understanding that request. Could you try rephrasing it or providing more details?',
        fr: "J'ai eu du mal à comprendre cette demande. Pourriez-vous la reformuler ou donner plus de détails ?",
      },
      quota_exceeded: {
        en: 'Your LLM usage quota has been reached. Please wait or upgrade your plan to continue.',
        fr: "Votre quota d'utilisation LLM est épuisé. Veuillez patienter ou mettre à niveau votre abonnement pour continuer.",
      },
    }
    return (
      messages[errorType][language as keyof (typeof messages)['unable_to_generate']] ||
      messages[errorType].en
    )
  }
}
