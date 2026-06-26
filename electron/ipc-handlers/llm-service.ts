import type { AICommand, AppConfig, StreamingProgress } from '@shared/types'
import { getActiveProvider, getProviderConfig } from '@shared/types'
import { type BrowserWindow, ipcMain } from 'electron'
import { Logger } from '../utils/logger'
import { claudeProviderFactory, ollamaProviderFactory, openaiProviderFactory } from './providers'
import type { BaseLLMProvider } from './providers/base-provider'
import { providerRegistry } from './providers/registry'

// Logger instance for LLM service
const logger = new Logger('LLMService')

// Track active streaming requests for cancellation
const activeStreams = new Map<string, AbortController>()

type WindowGetter = () => BrowserWindow | null

/**
 * Create the appropriate LLM provider based on configuration
 * Uses the provider registry for dynamic provider instantiation
 */
function createProvider(config: AppConfig): BaseLLMProvider {
  // Get the active provider name (supports both new and legacy config formats)
  const providerName = getActiveProvider(config)

  // Get the provider configuration (supports both new and legacy config formats)
  const providerConfig = getProviderConfig(config, providerName)

  if (!providerConfig) {
    throw new Error(`No configuration found for provider: ${providerName}`)
  }

  // Use the registry to create the provider instance
  return providerRegistry.createProvider(providerName, providerConfig) as BaseLLMProvider
}

/**
 * Initialize the provider registry with default providers
 * Should be called once at application startup
 */
function initializeProviderRegistry(): void {
  if (!providerRegistry.has('ollama')) {
    providerRegistry.register(ollamaProviderFactory)
  }
  if (!providerRegistry.has('claude')) {
    providerRegistry.register(claudeProviderFactory)
  }
  if (!providerRegistry.has('openai')) {
    providerRegistry.register(openaiProviderFactory)
  }
}

// Initialize registry at module load
initializeProviderRegistry()

/**
 * Create LLM service handlers for IPC
 *
 * @param _getWindow - Function to get the main window (unused, kept for API compatibility)
 * @param initialConfig - Initial application configuration
 */
export function createLLMHandlers(_getWindow: WindowGetter, initialConfig?: AppConfig): void {
  let service: BaseLLMProvider | null = null

  // E2E mock state — only initialized when NODE_ENV === 'test'
  let mockErrors: Record<string, string> | null = null
  let mockConnectionFailed = false
  let mockModels: string[] | null = null
  let mockAIResponses: AICommand[] | null = null
  let mockAIResponseIndex = 0
  let mockInterpretations: Array<{
    summary: string
    key_findings: string[]
    warnings: string[]
    errors: string[]
    recommendations: string[]
    successful: boolean
  }> | null = null
  let mockInterpretationIndex = 0

  // E2E mock initialization — only when NODE_ENV === 'test' AND NOT using real LLM
  if (process.env.NODE_ENV === 'test' && process.env.TERMAID_E2E_REAL_LLM !== 'true') {
    try {
      if (process.env.TERMAID_E2E_MOCK_ERRORS) {
        mockErrors = JSON.parse(process.env.TERMAID_E2E_MOCK_ERRORS)
      }
    } catch (error) {
      logger.error('Failed to parse TERMAID_E2E_MOCK_ERRORS', error)
    }

    mockConnectionFailed = process.env.TERMAID_E2E_MOCK_CONNECTION_FAILED === 'true'

    try {
      if (process.env.TERMAID_E2E_MOCK_MODELS) {
        mockModels = JSON.parse(process.env.TERMAID_E2E_MOCK_MODELS)
      }
    } catch (error) {
      logger.error('Failed to parse TERMAID_E2E_MOCK_MODELS', error)
    }

    try {
      if (process.env.TERMAID_E2E_MOCK_AI_RESPONSE) {
        const parsed = JSON.parse(process.env.TERMAID_E2E_MOCK_AI_RESPONSE)
        mockAIResponses = Array.isArray(parsed) ? parsed : [parsed]
      }
    } catch (error) {
      logger.error('Failed to parse TERMAID_E2E_MOCK_AI_RESPONSE', error)
    }

    try {
      if (process.env.TERMAID_E2E_MOCK_INTERPRETATION) {
        const parsed = JSON.parse(process.env.TERMAID_E2E_MOCK_INTERPRETATION)
        mockInterpretations = Array.isArray(parsed) ? parsed : [parsed]
      }
    } catch (error) {
      logger.error('Failed to parse TERMAID_E2E_MOCK_INTERPRETATION', error)
    }
  }

  if (initialConfig) {
    const providerName = getActiveProvider(initialConfig)
    const providerConfig = getProviderConfig(initialConfig, providerName)

    // Check if the provider can be initialized (has valid config)
    const canInit = providerConfig
      ? providerRegistry.validateConfig(providerName, providerConfig)
      : false

    if (canInit && providerConfig) {
      try {
        service = createProvider(initialConfig)
      } catch (error) {
        logger.warn(
          'Failed to initialize LLM provider at startup',
          error instanceof Error ? error.message : String(error)
        )
      }
    }
  }

  // Initialize the LLM service with configuration
  ipcMain.handle('llm:init', async (_event, config: AppConfig) => {
    try {
      service = createProvider(config)
    } catch (error) {
      service = null
      throw new Error(
        `Failed to initialize LLM provider: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  })

  // Generate command from natural language
  ipcMain.handle(
    'llm:generate-command',
    async (
      _event,
      prompt: string,
      conversationHistory?: import('@shared/types').ConversationMessage[],
      language?: string
    ) => {
      // E2E mock: simulate errors
      if (mockErrors?.llmGenerate) {
        throw new Error(mockErrors.llmGenerate)
      }

      // E2E mock: return predefined response (cycles through array)
      if (mockAIResponses) {
        const response =
          mockAIResponses[mockAIResponseIndex] ?? mockAIResponses[mockAIResponses.length - 1]
        mockAIResponseIndex++
        return response
      }

      if (!service) {
        throw new Error('LLM service not initialized')
      }
      return await service.generateCommand(prompt, conversationHistory, language)
    }
  )

  // Explain a shell command
  ipcMain.handle('llm:explain-command', async (_event, command: string) => {
    if (!service) {
      throw new Error('LLM service not initialized')
    }
    return await service.explainCommand(command)
  })

  // Interpret terminal output
  ipcMain.handle(
    'llm:interpret-output',
    async (_event, output: string, language?: string, command?: string) => {
      // E2E mock: return predefined interpretation (cycles through array)
      if (mockInterpretations && mockInterpretations.length > 0) {
        const idx = mockInterpretationIndex % mockInterpretations.length
        mockInterpretationIndex++
        return mockInterpretations[idx]
      }

      if (!service) {
        throw new Error('LLM service not initialized')
      }
      return await service.interpretOutput(output, language, command)
    }
  )

  // Test connection to LLM provider
  ipcMain.handle('llm:test-connection', async () => {
    // E2E mock: simulate connection failure
    if (mockConnectionFailed) {
      return false
    }

    if (!service) {
      throw new Error('LLM service not initialized')
    }
    return await service.testConnection()
  })

  // List available models
  ipcMain.handle('llm:list-models', async () => {
    // E2E mock: return predefined models
    if (mockModels) {
      return mockModels
    }

    if (!service) {
      throw new Error('LLM service not initialized')
    }
    return await service.listModels()
  })

  // Stream command generation with progress updates
  ipcMain.handle(
    'llm:stream-command',
    async (
      event,
      requestId: string,
      prompt: string,
      conversationHistory?: import('@shared/types').ConversationMessage[],
      language?: string
    ) => {
      // E2E mock: simulate errors
      if (mockErrors?.llmGenerate) {
        throw new Error(mockErrors.llmGenerate)
      }

      // E2E mock: simulate streaming with predefined response
      if (mockAIResponses && mockAIResponses.length > 0) {
        const response = mockAIResponses[0]
        // Simulate streaming progress - skip 'receiving' to avoid raw JSON in UI
        // Go directly to 'complete' which properly sets the command
        event.sender.send(`llm:stream-progress:${requestId}`, {
          type: 'connecting',
        } as StreamingProgress)

        await new Promise(resolve => setTimeout(resolve, 50))

        event.sender.send(`llm:stream-progress:${requestId}`, {
          type: 'complete',
          partialCommand: response,
        } as StreamingProgress)

        return response
      }

      if (!service) {
        throw new Error('LLM service not initialized')
      }

      // Create abort controller for this request
      const abortController = new AbortController()
      activeStreams.set(requestId, abortController)

      try {
        const result = await service.streamCommand(
          prompt,
          conversationHistory,
          language || 'en',
          (progress: StreamingProgress) => {
            // Send progress update to renderer
            event.sender.send(`llm:stream-progress:${requestId}`, progress)
          },
          abortController.signal
        )

        return result
      } finally {
        // Clean up the abort controller
        activeStreams.delete(requestId)
      }
    }
  )

  // Cancel a streaming request
  ipcMain.handle('llm:cancel-stream', (_event, requestId: string) => {
    const abortController = activeStreams.get(requestId)
    if (abortController) {
      abortController.abort()
      activeStreams.delete(requestId)
      return true
    }
    return false
  })

  // ============================================================
  // Provider Management IPC Handlers
  // ============================================================

  // List all available providers with their metadata
  ipcMain.handle('llm:list-providers', async () => {
    return providerRegistry.listMetadata()
  })

  // Get detailed information about all providers (including availability)
  ipcMain.handle('llm:get-provider-infos', async (_event, configs?: Record<string, unknown>) => {
    return providerRegistry.getProviderInfos(configs ?? {})
  })

  // Get default configuration for a specific provider
  ipcMain.handle('llm:get-provider-defaults', async (_event, providerName: string) => {
    return providerRegistry.getDefaultConfig(providerName)
  })

  // Test connection to a provider with given config
  ipcMain.handle(
    'llm:test-provider-connection',
    async (_event, providerName: string, config: unknown) => {
      try {
        return await providerRegistry.testConnection(providerName, config)
      } catch (error) {
        logger.error(`Provider connection test failed for ${providerName}`, error)
        return false
      }
    }
  )

  // List models for a specific provider
  ipcMain.handle(
    'llm:list-provider-models',
    async (_event, providerName: string, config: unknown) => {
      try {
        return await providerRegistry.listModels(providerName, config)
      } catch (error) {
        logger.error(`Failed to list models for ${providerName}`, error)
        return []
      }
    }
  )
}

/**
 * Cleanup all active streaming requests
 * Should be called when the application is shutting down
 */
export function cleanupActiveStreams(): void {
  for (const [requestId, controller] of activeStreams.entries()) {
    controller.abort()
    activeStreams.delete(requestId)
  }
}
