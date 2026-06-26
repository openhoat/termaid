import type {
  AICommand,
  AppConfig,
  CommandInterpretation,
  Conversation,
  ConversationMessage,
} from '@shared/types'

/**
 * Default mock configuration for tests
 */
export const defaultMockConfig: AppConfig = {
  ollama: {
    url: 'http://localhost:11434',
    model: 'llama2',
    temperature: 0.7,
    maxTokens: 1000,
  },
  theme: 'dark',
  fontSize: 14,
  shell: 'auto',
}

/**
 * Default mock AI command response
 */
export const defaultMockAICommand: AICommand = {
  type: 'command',
  intent: 'list_files',
  command: 'ls -la',
  explanation: 'Liste tous les fichiers avec détails',
  confidence: 0.95,
}

/**
 * Default mock text response
 */
export const defaultMockTextResponse: AICommand = {
  type: 'text',
  content: 'This is a helpful response from the AI.',
}

/**
 * Default mock command interpretation
 */
export const defaultMockInterpretation: CommandInterpretation = {
  summary: 'Command executed successfully',
  key_findings: ['All files listed correctly'],
  warnings: [],
  errors: [],
  recommendations: ['Consider using ls -lh for human-readable sizes'],
  successful: true,
}

/**
 * Mock conversation for testing
 */
export const mockConversation: Conversation = {
  id: 'test-conversation-id',
  title: 'Test Conversation',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  messages: [
    { role: 'user', content: 'List all files' },
    {
      role: 'assistant',
      content: 'ls -la\n\nListe tous les fichiers avec détails',
      command: 'ls -la',
    },
  ],
}

/**
 * Mock environment sources (no env overrides by default)
 */
export const defaultMockEnvSources = {
  url: false,
  apiKey: false,
  model: false,
  temperature: false,
  maxTokens: false,
  shell: false,
}

/**
 * Mock command execution result
 */
export interface MockCommandExecution {
  /** Output from the command */
  output: string
  /** Exit code (0 = success) */
  exitCode?: number
  /** Delay before returning output (ms) */
  delay?: number
}

/**
 * Mock error configuration
 */
export interface MockErrors {
  /** Error to throw when llmGenerateCommand is called */
  llmGenerate?: Error
  /** Return false for llmTestConnection */
  llmConnectionFailed?: boolean
  /** Error to throw when terminalWrite is called */
  terminalWrite?: Error
}

/**
 * Create a mock electronAPI object for E2E tests
 * This can be injected into the renderer process via Playwright
 */
export function createMockElectronAPI(
  options: {
    config?: AppConfig
    aiCommand?: AICommand | AICommand[]
    interpretation?: CommandInterpretation | CommandInterpretation[]
    models?: string[]
    conversations?: Conversation[]
    connectionSuccess?: boolean
    terminalPid?: number
    terminalOutput?: string
    envSources?: typeof defaultMockEnvSources
    /** Mock errors to simulate failures */
    errors?: MockErrors
    /** Command execution result mock (single or array for multiple calls) */
    commandExecution?: MockCommandExecution | MockCommandExecution[]
  } = {}
) {
  const {
    config = defaultMockConfig,
    aiCommand = defaultMockAICommand,
    interpretation = defaultMockInterpretation,
    models = ['llama2', 'mistral', 'codellama'],
    conversations = [],
    connectionSuccess = true,
    terminalPid = 12345,
    terminalOutput = 'total 16\ndrwxr-xr-x  2 user user 4096 Jan  1 12:00 .',
    envSources = defaultMockEnvSources,
    errors = {},
    commandExecution,
  } = options

  // Support arrays for sequential mock responses
  const aiCommands = Array.isArray(aiCommand) ? aiCommand : [aiCommand]
  const interpretations = Array.isArray(interpretation) ? interpretation : [interpretation]
  const commandExecutions = commandExecution
    ? Array.isArray(commandExecution)
      ? commandExecution
      : [commandExecution]
    : undefined
  let callIndex = 0

  // Store for conversations
  let storedConversations = [...conversations]
  let currentConversationId: string | null = conversations[0]?.id || null

  // Store for command execution state (simulates terminal capturing output)
  const firstExec = commandExecutions?.[0]
  let pendingCommandOutput = firstExec?.output ?? terminalOutput
  let _pendingExitCode = firstExec?.exitCode ?? 0

  // Store for config persistence
  let storedConfig: AppConfig = { ...config }

  // Store for streaming progress callbacks (per requestId)
  const progressCallbacksMap = new Map<string, ((progress: unknown) => void)[]>()

  return {
    // Config
    getConfig: async () => ({ ...storedConfig }),
    getConfigEnvSources: async () => envSources,
    setConfig: async (newConfig: AppConfig) => {
      storedConfig = { ...newConfig }
    },
    resetConfig: async () => {
      storedConfig = { ...defaultMockConfig }
      return { ...storedConfig }
    },

    // Terminal
    terminalCreate: async () => terminalPid,
    terminalWrite: async (_pid: number, _data: string) => {
      // Simulate error if configured
      if (errors.terminalWrite) {
        throw errors.terminalWrite
      }
      // Simulate command execution with optional delay
      if (commandExecutions) {
        const exec =
          commandExecutions[Math.max(0, callIndex - 1)] ??
          commandExecutions[commandExecutions.length - 1]
        if (exec.delay) {
          await new Promise(resolve => setTimeout(resolve, exec.delay))
        }
        pendingCommandOutput = exec.output
        _pendingExitCode = exec.exitCode ?? 0
      }
    },
    terminalResize: async (_pid: number, _cols: number, _rows: number) => {
      // Mock terminal resize
    },
    terminalDestroy: async (_pid: number) => {
      // Mock terminal destroy
    },
    terminalStartCapture: async (_pid: number) => true,
    terminalGetCapture: async (_pid: number) => pendingCommandOutput,

    // Terminal events (return unsubscribe functions for cleanup)
    onTerminalData: (_callback: (data: { pid: number; data: string }) => void) => {
      return () => {
        // No-op unsubscribe for mock
      }
    },
    onTerminalExit: (_callback: (data: { pid: number; code: number }) => void) => {
      return () => {
        // No-op unsubscribe for mock
      }
    },

    // LLM
    llmInit: async (_config: {
      url: string
      apiKey?: string
      model: string
      temperature?: number
      maxTokens?: number
    }) => {
      // Mock LLM initialization
    },
    llmGenerateCommand: async (
      _prompt: string,
      _conversationHistory?: ConversationMessage[],
      _language?: string
    ): Promise<AICommand> => {
      // Simulate error if configured
      if (errors.llmGenerate) {
        throw errors.llmGenerate
      }
      const result = aiCommands[callIndex] ?? aiCommands[aiCommands.length - 1]
      callIndex++
      return result
    },
    llmExplainCommand: async (_command: string): Promise<string> => {
      return 'This command lists all files in the current directory.'
    },
    llmInterpretOutput: async (
      _output: string,
      _language?: string,
      _command?: string
    ): Promise<CommandInterpretation> => {
      // callIndex is already incremented after llmGenerateCommand, so use callIndex-1
      const idx = Math.max(0, callIndex - 1)
      return interpretations[idx] ?? interpretations[interpretations.length - 1]
    },
    llmTestConnection: async (): Promise<boolean> => {
      // Simulate connection failure if configured
      if (errors.llmConnectionFailed) {
        return false
      }
      return connectionSuccess
    },
    llmListModels: async (): Promise<string[]> => {
      return models
    },

    // Streaming LLM (for new streaming feature)
    llmStreamCommand: async (
      requestId: string,
      _prompt: string,
      _conversationHistory?: ConversationMessage[],
      _language?: string
    ): Promise<AICommand> => {
      // Simulate error if configured
      if (errors.llmGenerate) {
        // Get callbacks and notify them of the error before throwing
        const callbacks = progressCallbacksMap.get(requestId) ?? []
        for (const callback of callbacks) {
          callback({ type: 'error', error: errors.llmGenerate.message })
        }
        progressCallbacksMap.delete(requestId)
        throw errors.llmGenerate
      }

      const result = aiCommands[callIndex] ?? aiCommands[aiCommands.length - 1]

      // Get the stored callbacks for this requestId
      const callbacks = progressCallbacksMap.get(requestId) ?? []

      // Always simulate streaming progress (even if no callbacks registered)
      // This ensures the streaming flow works correctly
      const content =
        result.type === 'command'
          ? `${result.explanation}\n\nCommand: ${result.command}`
          : result.content

      // Call callbacks with progress updates synchronously
      for (const callback of callbacks) {
        callback({ type: 'connecting' })
      }
      for (const callback of callbacks) {
        callback({ type: 'receiving', content })
      }
      for (const callback of callbacks) {
        callback({ type: 'complete', partialCommand: result })
      }

      // Clean up
      progressCallbacksMap.delete(requestId)

      callIndex++
      return result
    },
    llmCancelStream: async (_requestId: string): Promise<boolean> => {
      return true
    },
    onLlmStreamProgress: (requestId: string, callback: (progress: unknown) => void) => {
      // Store the callback for this requestId
      const progressCallbacks = progressCallbacksMap.get(requestId) ?? []
      progressCallbacks.push(callback)
      progressCallbacksMap.set(requestId, progressCallbacks)

      // Return unsubscribe function
      return () => {
        const callbacks = progressCallbacksMap.get(requestId) ?? []
        progressCallbacksMap.set(
          requestId,
          callbacks.filter(cb => cb !== callback)
        )
      }
    },

    // Conversations
    conversationGetAll: async (): Promise<Conversation[]> => {
      return storedConversations
    },
    conversationGet: async (id: string): Promise<Conversation | null> => {
      return storedConversations.find(c => c.id === id) || null
    },
    conversationCreate: async (firstMessage: string): Promise<Conversation> => {
      const newConversation: Conversation = {
        id: `conv-${Date.now()}`,
        title: firstMessage.slice(0, 50),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [{ role: 'user', content: firstMessage }],
      }
      storedConversations.unshift(newConversation)
      currentConversationId = newConversation.id
      return newConversation
    },
    conversationAddMessage: async (
      conversationId: string,
      message: ConversationMessage
    ): Promise<Conversation | null> => {
      const conversation = storedConversations.find(c => c.id === conversationId)
      if (!conversation) return null
      conversation.messages.push(message)
      conversation.updatedAt = Date.now()
      return conversation
    },
    conversationUpdateMessage: async (
      conversationId: string,
      messageIndex: number,
      updates: Partial<ConversationMessage>
    ): Promise<Conversation | null> => {
      const conversation = storedConversations.find(c => c.id === conversationId)
      if (!conversation || !conversation.messages[messageIndex]) return null
      conversation.messages[messageIndex] = {
        ...conversation.messages[messageIndex],
        ...updates,
      }
      conversation.updatedAt = Date.now()
      return conversation
    },
    conversationUpdate: async (
      id: string,
      updates: Partial<Conversation>
    ): Promise<Conversation | null> => {
      const conversation = storedConversations.find(c => c.id === id)
      if (!conversation) return null
      Object.assign(conversation, updates)
      conversation.updatedAt = Date.now()
      return conversation
    },
    conversationDelete: async (id: string): Promise<void> => {
      storedConversations = storedConversations.filter(c => c.id !== id)
      if (currentConversationId === id) {
        currentConversationId = storedConversations[0]?.id || null
      }
    },
    conversationClearAll: async (): Promise<void> => {
      storedConversations = []
      currentConversationId = null
    },
    conversationExport: async (
      id: string
    ): Promise<{ success: boolean; filePath?: string; error?: string; cancelled?: boolean }> => {
      const conversation = storedConversations.find(c => c.id === id)
      if (!conversation) {
        return { success: false, error: 'Conversation not found' }
      }
      return { success: true, filePath: `/tmp/conversation-${id}.json` }
    },
    conversationExportAll: async (): Promise<{
      success: boolean
      filePath?: string
      error?: string
      cancelled?: boolean
    }> => {
      return { success: true, filePath: '/tmp/all-conversations.json' }
    },
    conversationImport: async (): Promise<{
      success: boolean
      imported?: number
      skipped?: number
      error?: string
      cancelled?: boolean
    }> => {
      // Simulate importing conversations from a file
      const importedConversations: Conversation[] = [
        {
          id: `conv-import-${Date.now()}`,
          title: 'Imported conversation',
          createdAt: Date.now() - 50000,
          updatedAt: Date.now() - 40000,
          messages: [
            { role: 'user', content: 'Hello from imported conversation' },
            { role: 'assistant', content: 'Response from imported conversation' },
          ],
        },
      ]
      storedConversations.push(...importedConversations)
      return { success: true, imported: importedConversations.length, skipped: 0 }
    },
  }
}

/**
 * Script to inject mock electronAPI into the page
 * Use with context.addInitScript() in Playwright
 *
 * Note: This must be called BEFORE the page loads, otherwise the app
 * will have already captured a reference to the real electronAPI.
 *
 * IMPORTANT: contextBridge.exposeInMainWorld creates a read-only property
 * that cannot be overridden. We intercept by defining the property first
 * with a getter that returns our mock.
 */
export function getMockInjectionScript(
  options: Parameters<typeof createMockElectronAPI>[0] = {}
): string {
  // Serialize error objects for the script
  const serializedOptions = {
    ...options,
    errors: options.errors
      ? {
          llmGenerate: options.errors.llmGenerate
            ? { message: options.errors.llmGenerate.message }
            : undefined,
          llmConnectionFailed: options.errors.llmConnectionFailed,
          terminalWrite: options.errors.terminalWrite
            ? { message: options.errors.terminalWrite.message }
            : undefined,
        }
      : undefined,
  }

  return `
    // Create mock electronAPI before the app loads
    (function() {
      const options = ${JSON.stringify(serializedOptions)};

      // Reconstruct error objects if needed
      if (options.errors) {
        if (options.errors.llmGenerate) {
          options.errors.llmGenerate = new Error(options.errors.llmGenerate.message);
        }
        if (options.errors.terminalWrite) {
          options.errors.terminalWrite = new Error(options.errors.terminalWrite.message);
        }
      }

      // Create the mock API using the same logic as createMockElectronAPI
      const mockAPI = ${createMockElectronAPI.toString()}(options);

      // Define electronAPI property BEFORE contextBridge.exposeInMainWorld is called
      // This prevents contextBridge from overwriting it
      let currentAPI = mockAPI;

      Object.defineProperty(window, 'electronAPI', {
        get: function() {
          return currentAPI;
        },
        set: function(_value) {
          // contextBridge.exposeInMainWorld tries to set electronAPI with the real API
          // We intentionally ignore it to keep our mock in place
          console.log('[E2E Mock] electronAPI setter intercepted, keeping mock');
        },
        configurable: true,
        enumerable: true
      });

      console.log('[E2E Mock] electronAPI getter/setter installed');

      // Also listen for DOMContentLoaded to ensure our mock is in place
      document.addEventListener('DOMContentLoaded', function() {
        console.log('[E2E Mock] DOMContentLoaded - electronAPI mock active');
      });
    })();
  `
}

/**
 * Options for launching the Electron app with mocks
 */
export interface LaunchOptions {
  /** Mock configuration */
  mocks?: Parameters<typeof createMockElectronAPI>[0]
  /** Environment variables to set for the Electron process */
  env?: Record<string, string>
  /** Force a specific locale (e.g. 'en') via localStorage before the app loads */
  locale?: string
  /** Force real LLM (no mocks) for interactive testing */
  realLlm?: boolean
}
