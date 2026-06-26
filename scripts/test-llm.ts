import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ChatAnthropic } from '@langchain/anthropic'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { AIMessage, HumanMessage } from '@langchain/core/messages'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { ChatOllama } from '@langchain/ollama'
import { ChatOpenAI } from '@langchain/openai'
import type { ConversationMessage } from '@shared/types'
import { z } from 'zod'
import {
  extractRecentCommands,
  formatContextBlock,
} from '../electron/ipc-handlers/providers/base-provider'
import { contextService } from '../electron/services/contextService'

// biome-ignore lint/suspicious/noConsole: debug/CI script
const out = console.log
// biome-ignore lint/suspicious/noConsole: debug/CI script
const err = console.error

const CONFIG_PATH = path.join(os.homedir(), '.config', 'termaid', 'config.json')
const SYSTEM_PROMPT_PATH = path.join(__dirname, '..', 'electron', 'prompts', 'system-prompt.md')
const INTERPRET_PROMPT_PATH = path.join(
  __dirname,
  '..',
  'electron',
  'prompts',
  'interpret-output-prompt.md'
)
const MAX_CONVERSATION_HISTORY = 50

const commandSchema = z.object({
  type: z.enum(['command', 'text']),
  intent: z.string().optional(),
  command: z.string().optional(),
  explanation: z.string().optional(),
  confidence: z.number().optional(),
  content: z.string().optional(),
})

interface AppConfig {
  llmProvider: string
  ollama: { url: string; model: string; temperature: number; maxTokens: number }
  claude?: { apiKey: string; model: string; temperature: number; maxTokens: number }
  openai?: { apiKey: string; model: string; temperature: number; maxTokens: number }
}

interface BatchItem {
  prompt: string
  expected?: 'command' | 'text' | 'interpretation'
  language?: string
  command?: string
  output?: string
}

interface BatchResult {
  prompt: string
  passed: boolean
  expected?: string
  actualType: string
  command?: string
  error?: string
}

// ============================================================
// Help
// ============================================================

function showHelp(): void {
  out(`
Usage: npm run test:llm <command> [options] [prompt]

Commands:
  generate <prompt>       Generate a command (default)
  stream <prompt>         Stream a command response
  history <file> <prompt> Generate with conversation history
  batch <file>            Run multiple prompts from JSON file
  interpret [output]      Interpret command output via LLM
  help                    Show this help

Options:
  --provider <name>       Override LLM provider (ollama|claude|openai)
  --language <code>       Override language (en|fr)
  --verbose, -v           Show detailed prompt info
  --json                  Output as JSON (for scripting)
  --exit-code             Exit with code 1 if type != "command"
  --file <path>           Read input from file (for interpret)
  --command <command>     The command that was executed (for interpret context)

Examples:
  npm run test:llm generate "liste les fichiers"
  npm run test:llm stream "comment va la machine ?"
  npm run test:llm history tests/fixtures/history.json "fais pareil"
  npm run test:llm batch tests/llm-regression.json --json --exit-code
  npm run test:llm interpret "Linux 6.8.0-48-generic"
  npm run test:llm interpret --file /tmp/output.txt
  cat /tmp/output.txt | npm run test:llm interpret
`)
}

// ============================================================
// Config
// ============================================================

function readConfig(): AppConfig {
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
  return raw.config as AppConfig
}

// ============================================================
// Model creation
// ============================================================

function createModel(config: AppConfig): BaseChatModel {
  const provider = config.llmProvider

  if (provider === 'ollama') {
    return new ChatOllama({
      model: config.ollama.model,
      baseUrl: config.ollama.url,
      temperature: config.ollama.temperature,
      numPredict: config.ollama.maxTokens,
    })
  }

  if (provider === 'claude' && config.claude?.apiKey) {
    return new ChatAnthropic({
      model: config.claude.model,
      temperature: config.claude.temperature,
      maxTokens: config.claude.maxTokens,
      anthropicApiKey: config.claude.apiKey,
    })
  }

  if (provider === 'openai' && config.openai?.apiKey) {
    return new ChatOpenAI({
      model: config.openai.model,
      temperature: config.openai.temperature,
      maxTokens: config.openai.maxTokens,
      apiKey: config.openai.apiKey,
    })
  }

  throw new Error(`Unsupported or misconfigured provider: ${provider}`)
}

// ============================================================
// Build prompt
// ============================================================

async function buildSystemPrompt(language: string): Promise<string> {
  const systemPrompt = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf-8')
  const context = await contextService.getContext(extractRecentCommands())
  const contextBlock = formatContextBlock(context)
  const enhancedPrompt = systemPrompt.replace('{{environment_context}}', contextBlock)
  return `${enhancedPrompt}\n\n[Language hint: User interface language is ${language}]`
}

// ============================================================
// Commands
// ============================================================

async function cmdGenerate(
  model: BaseChatModel,
  prompt: string,
  history: ConversationMessage[],
  language: string,
  verbose: boolean
): Promise<unknown> {
  const systemPrompt = await buildSystemPrompt(language)

  if (verbose) {
    out('─'.repeat(72))
    out('📋 SYSTEM PROMPT length:', systemPrompt.length, 'chars')
    out('─'.repeat(72))
  }

  const messages: (HumanMessage | AIMessage)[] = []
  if (history.length > 0) {
    const limitedHistory = history.slice(-MAX_CONVERSATION_HISTORY)
    for (const msg of limitedHistory) {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.content))
      } else {
        messages.push(new AIMessage(msg.content))
      }
    }
  }

  const promptTemplate = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    new MessagesPlaceholder('history'),
    ['human', '{input}'],
  ])

  const chain = promptTemplate.pipe(model.withStructuredOutput(commandSchema))

  const result = await chain.invoke({ input: prompt, history: messages })
  return result
}

async function cmdStream(
  model: BaseChatModel,
  prompt: string,
  history: ConversationMessage[],
  language: string,
  verbose: boolean
): Promise<unknown> {
  const systemPrompt = await buildSystemPrompt(language)

  if (verbose) {
    out('─'.repeat(72))
    out('📋 SYSTEM PROMPT length:', systemPrompt.length, 'chars')
    out('─'.repeat(72))
  }

  const messages: (HumanMessage | AIMessage)[] = []
  if (history.length > 0) {
    const limitedHistory = history.slice(-MAX_CONVERSATION_HISTORY)
    for (const msg of limitedHistory) {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.content))
      } else {
        messages.push(new AIMessage(msg.content))
      }
    }
  }

  const promptTemplate = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    new MessagesPlaceholder('history'),
    ['human', '{input}'],
  ])

  const chain = promptTemplate.pipe(model)
  const stream = await chain.stream({ input: prompt, history: messages })

  let accumulated = ''

  for await (const chunk of stream) {
    const content = chunk.content
    if (typeof content === 'string') {
      accumulated += content
      process.stdout.write(content)
    }
  }

  out('\n')
  if (verbose) {
    out('─'.repeat(72))
    out('📦 Raw accumulated length:', accumulated.length, 'chars')
    out('─'.repeat(72))
  }

  // Try to parse JSON from the accumulated response
  const jsonMatch = accumulated.match(/\{[^{}]*"type"[^{}]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      // fall through
    }
  }

  return { type: 'text', content: accumulated.trim() }
}

async function cmdHistory(
  model: BaseChatModel,
  historyFile: string,
  prompt: string,
  language: string,
  verbose: boolean
): Promise<unknown> {
  const raw = JSON.parse(fs.readFileSync(historyFile, 'utf-8'))
  const history = raw as ConversationMessage[]
  if (verbose) out(`📜 Loaded ${history.length} history messages from ${historyFile}`)
  return cmdGenerate(model, prompt, history, language, verbose)
}

async function cmdBatch(
  model: BaseChatModel,
  batchFile: string,
  language: string,
  verbose: boolean,
  jsonOutput: boolean,
  exitCode: boolean
): Promise<number> {
  const raw: BatchItem[] = JSON.parse(fs.readFileSync(batchFile, 'utf-8'))

  const results: BatchResult[] = []

  for (const item of raw) {
    const lang = item.language || language
    try {
      const isInterpretation = item.expected === 'interpretation'
      const prompt = isInterpretation ? item.command || 'unknown' : item.prompt

      const response = isInterpretation
        ? await cmdInterpret(model, item.output || '', lang, verbose, item.command)
        : await cmdGenerate(model, item.prompt, [], lang, verbose)

      const actualType = isInterpretation ? 'interpretation' : (response as { type: string }).type
      const passed =
        !item.expected || isInterpretation
          ? true
          : (response as { type: string }).type === item.expected

      results.push({
        prompt,
        passed,
        expected: item.expected,
        actualType,
      })
    } catch (error) {
      results.push({
        prompt: item.command || item.prompt,
        passed: false,
        expected: item.expected,
        actualType: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (jsonOutput) {
    out(JSON.stringify(results, null, 2))
  } else {
    const passed = results.filter(r => r.passed).length
    const failed = results.filter(r => !r.passed).length
    out(`\n📊 Batch results: ${passed} passed, ${failed} failed\n`)
    for (const result of results) {
      const icon = result.passed ? '✅' : '❌'
      out(`${icon} [${result.actualType}] ${result.prompt}`)
      if (result.expected) out(`   Expected: ${result.expected}, Got: ${result.actualType}`)
      if (result.command) out(`   Command: ${result.command}`)
      if (result.error) out(`   Error: ${result.error}`)
    }
  }

  const hasFailures = results.some(r => !r.passed)
  return hasFailures && exitCode ? 1 : 0
}

async function cmdInterpret(
  model: BaseChatModel,
  output: string,
  language: string,
  verbose: boolean,
  userCommand?: string
): Promise<unknown> {
  if (verbose) {
    out('─'.repeat(72))
    out('📋 Output to interpret:', output.length, 'chars')
    if (output.length < 500) {
      out(output)
    }
    if (userCommand) {
      out(`📋 Command: ${userCommand}`)
    }
    out('─'.repeat(72))
  }

  const systemPrompt = fs.readFileSync(INTERPRET_PROMPT_PATH, 'utf-8')

  const promptTemplate = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    ['human', 'Command: {command}\nOutput:\n{command_output}'],
  ])

  const chain = promptTemplate.pipe(model)

  if (verbose) {
    out('📋 SYSTEM PROMPT length:', systemPrompt.length, 'chars')
    out('─'.repeat(72))
  }

  const result = await chain.invoke({
    command: userCommand || 'unknown',
    command_output: output,
    language,
  })

  const responseText = result.content as string
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      const schema = z.object({
        summary: z.string(),
        key_findings: z.array(z.string()),
        warnings: z.array(z.string()),
        errors: z.array(z.string()),
        recommendations: z.array(z.string()),
        successful: z.boolean(),
      })
      return schema.parse(parsed)
    } catch {
      return { type: 'parse-error', raw: responseText }
    }
  }

  return { type: 'text', content: responseText.trim() }
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<number> {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    showHelp()
    return 0
  }

  const command = args[0]
  const rest = args.slice(1)

  // Parse options
  let providerOverride: string | null = null
  let language = 'fr'
  let verbose = false
  let jsonOutput = false
  let exitCodeMode = false
  let inputFile: string | null = null
  let userCommand: string | undefined

  const filteredArgs: string[] = []
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    if (arg === '--verbose' || arg === '-v') {
      verbose = true
    } else if (arg === '--json') {
      jsonOutput = true
    } else if (arg === '--exit-code') {
      exitCodeMode = true
    } else if (arg === '--provider' && i + 1 < rest.length) {
      providerOverride = rest[++i]
    } else if (arg === '--language' && i + 1 < rest.length) {
      language = rest[++i]
    } else if (arg === '--file' && i + 1 < rest.length) {
      inputFile = rest[++i]
    } else if (arg === '--command' && i + 1 < rest.length) {
      userCommand = rest[++i]
    } else {
      filteredArgs.push(arg)
    }
  }

  // Read config and create model
  const config = readConfig()
  if (providerOverride) {
    config.llmProvider = providerOverride
  }
  const model = createModel(config)

  if (verbose) {
    out('🤖 Provider:', config.llmProvider)
    out('🗣️  Language:', language)
    out('')
  }

  let result: unknown
  let exitCode = 0

  switch (command) {
    case 'generate': {
      const prompt = filteredArgs.join(' ') || "décris-moi l'environnement de ce projet"
      result = await cmdGenerate(model, prompt, [], language, verbose)
      break
    }

    case 'stream': {
      const prompt = filteredArgs.join(' ') || 'dis bonjour'
      result = await cmdStream(model, prompt, [], language, verbose)
      break
    }

    case 'history': {
      if (filteredArgs.length < 1) {
        err('❌ history requires a history file path')
        return 1
      }
      const historyFile = filteredArgs[0]
      const prompt = filteredArgs.slice(1).join(' ') || 'fais la même chose'
      result = await cmdHistory(model, historyFile, prompt, language, verbose)
      break
    }

    case 'batch': {
      if (filteredArgs.length < 1) {
        err('❌ batch requires a batch file path')
        return 1
      }
      exitCode = await cmdBatch(model, filteredArgs[0], language, verbose, jsonOutput, exitCodeMode)
      return exitCode
    }

    case 'interpret': {
      let output = filteredArgs.join(' ')

      // Read from file if --file is specified
      if (inputFile) {
        output = fs.readFileSync(inputFile, 'utf-8')
      } else if (!output && !process.stdin.isTTY) {
        // Read from stdin if piped
        const chunks: Buffer[] = []
        for await (const chunk of process.stdin) {
          chunks.push(chunk as Buffer)
        }
        output = Buffer.concat(chunks).toString('utf-8')
      }

      if (!output) {
        err('❌ interpret requires command output text, --file <path>, or stdin pipe')
        return 1
      }

      result = await cmdInterpret(model, output, language, verbose, userCommand)
      break
    }

    default:
      err(`❌ Unknown command: ${command}`)
      showHelp()
      return 1
  }

  if (result) {
    if (jsonOutput) {
      out(JSON.stringify(result, null, 2))
    } else {
      const r = result as { type: string; command?: string; explanation?: string; content?: string }
      out('')
      out('✅ LLM RESPONSE:')
      out('='.repeat(72))
      out(JSON.stringify(result, null, 2))
      out('='.repeat(72))

      if (r.type === 'command') {
        out(`\n▶️  Command: ${r.command}`)
        out(`💡 ${r.explanation}`)
      } else {
        out(`\n💬 ${r.content}`)
      }

      if (exitCodeMode && r.type !== 'command') {
        exitCode = 1
      }
    }
  }

  return exitCode
}

// Run
main()
  .then(code => process.exit(code))
  .catch(err => {
    err('❌ Fatal error:', err)
    process.exit(1)
  })
