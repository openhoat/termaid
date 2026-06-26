import type {
  AICommand,
  AppConfig,
  CheckpointMetadata,
  Conversation,
  ConversationMessage,
  LLMProviderMetadata,
  ProviderInfo,
  StreamingProgress,
} from '@shared/types'

/**
 * Result of waiting for shell prompt
 */
export interface WaitForPromptResult {
  /** Whether a prompt was detected */
  detected: boolean
  /** The captured output */
  output: string
  /** Whether the wait timed out */
  timedOut: boolean
}

/**
 * Configuration options for prompt detection
 */
export interface PromptDetectionOptions {
  /** Maximum time to wait for prompt detection (ms) */
  maxWaitTimeMs?: number
  /** Interval between prompt checks (ms) */
  checkIntervalMs?: number
  /** Minimum time to wait before checking for prompt (ms) */
  minWaitTimeMs?: number
  /** Additional custom prompt patterns (regex strings) */
  customPatterns?: string[]
}

export interface ElectronAPI {
  // Config
  getConfig: () => Promise<AppConfig>
  getConfigEnvSources: () => Promise<{
    url: boolean
    apiKey: boolean
    model: boolean
    temperature: boolean
    maxTokens: boolean
    shell: boolean
    llmProvider: boolean
    claudeApiKey: boolean
    claudeModel: boolean
  }>
  setConfig: (config: AppConfig) => Promise<AppConfig>
  resetConfig: () => Promise<AppConfig>

  // Terminal
  terminalCreate: () => Promise<number>
  terminalWrite: (pid: number, data: string) => Promise<void>
  terminalResize: (pid: number, cols: number, rows: number) => Promise<void>
  terminalDestroy: (pid: number) => Promise<void>
  terminalStartCapture: (pid: number) => Promise<boolean>
  terminalGetCapture: (pid: number) => Promise<string>
  terminalWaitForPrompt: (
    pid: number,
    options?: PromptDetectionOptions
  ) => Promise<WaitForPromptResult>

  // Terminal events (return unsubscribe functions for cleanup)
  onTerminalData: (callback: (data: { pid: number; data: string }) => void) => () => void
  onTerminalExit: (callback: (data: { pid: number; code: number }) => void) => () => void

  // LLM
  llmInit: (config: AppConfig) => Promise<void>
  llmGenerateCommand: (
    prompt: string,
    conversationHistory?: ConversationMessage[],
    language?: string
  ) => Promise<AICommand>
  llmExplainCommand: (command: string) => Promise<string>
  llmInterpretOutput: (
    output: string,
    language?: string,
    command?: string
  ) => Promise<{
    summary: string
    key_findings: string[]
    warnings: string[]
    errors: string[]
    recommendations: string[]
    successful: boolean
  }>
  llmTestConnection: () => Promise<boolean>
  llmListModels: () => Promise<string[]>

  // LLM Streaming
  llmStreamCommand: (
    requestId: string,
    prompt: string,
    conversationHistory?: ConversationMessage[],
    language?: string
  ) => Promise<AICommand>
  llmCancelStream: (requestId: string) => Promise<boolean>
  onLlmStreamProgress: (
    requestId: string,
    callback: (progress: StreamingProgress) => void
  ) => () => void

  // LLM Provider Management
  llmListProviders: () => Promise<LLMProviderMetadata[]>
  llmGetProviderInfos: (configs?: Record<string, unknown>) => Promise<ProviderInfo[]>
  llmGetProviderDefaults: (providerName: string) => Promise<Record<string, unknown> | undefined>
  llmTestProviderConnection: (providerName: string, config: unknown) => Promise<boolean>
  llmListProviderModels: (providerName: string, config: unknown) => Promise<string[]>

  // Conversations
  conversationGetAll: () => Promise<Conversation[]>
  conversationGet: (id: string) => Promise<Conversation | null>
  conversationCreate: (firstMessage: string) => Promise<Conversation>
  conversationAddMessage: (
    conversationId: string,
    message: ConversationMessage
  ) => Promise<Conversation | null>
  conversationUpdateMessage: (
    conversationId: string,
    messageIndex: number,
    updates: Partial<ConversationMessage>
  ) => Promise<Conversation | null>
  conversationUpdate: (id: string, updates: Partial<Conversation>) => Promise<Conversation | null>
  conversationDelete: (id: string) => Promise<boolean>
  conversationClearAll: () => Promise<void>
  conversationExport: (id: string) => Promise<{
    success: boolean
    cancelled?: boolean
    filePath?: string
    error?: string
  }>
  conversationExportAll: () => Promise<{
    success: boolean
    cancelled?: boolean
    filePath?: string
    error?: string
  }>
  conversationImport: () => Promise<{
    success: boolean
    cancelled?: boolean
    imported?: number
    skipped?: number
    error?: string
  }>

  // Checkpoints
  checkpointGetAll: (conversationId: string) => Promise<{
    success: boolean
    checkpoints?: CheckpointMetadata[]
    error?: string
  }>
  checkpointGet: (
    conversationId: string,
    checkpointId: string
  ) => Promise<{
    success: boolean
    checkpoint?: ConversationMessage[]
    error?: string
  }>
  checkpointRestore: (
    conversationId: string,
    checkpointId: string
  ) => Promise<{
    success: boolean
    messages?: ConversationMessage[]
    error?: string
  }>
  checkpointRestoreByIndex: (
    conversationId: string,
    messageIndex: number
  ) => Promise<{
    success: boolean
    messages?: ConversationMessage[]
    error?: string
  }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
