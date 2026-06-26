// ============================================================================
// LLM Plugin System Types
// ============================================================================

/**
 * Metadata describing an LLM provider
 */
export interface LLMProviderMetadata {
  /** Unique identifier for the provider (e.g., 'ollama', 'claude', 'openai') */
  name: string
  /** Human-readable display name */
  displayName: string
  /** Optional description of the provider */
  description?: string
  /** Provider version */
  version?: string
  /** Author information */
  author?: string
  /** Whether the provider requires an API key */
  requiresApiKey: boolean
  /** Whether the provider supports streaming */
  supportsStreaming: boolean
  /** URL to the provider's website or documentation */
  websiteUrl?: string
  /** Icon name or URL for the provider */
  icon?: string
}

/**
 * Information about a provider for UI display
 */
export interface ProviderInfo {
  /** Provider metadata */
  metadata: LLMProviderMetadata
  /** Whether the provider is currently available (e.g., API key configured) */
  isAvailable: boolean
  /** List of available models (if known) */
  models?: string[]
  /** Default configuration for the provider */
  defaultConfig: Record<string, unknown>
}

/**
 * Factory interface for creating LLM providers
 */
export interface LLMProviderFactory<TConfig = Record<string, unknown>> {
  /** Unique identifier for this provider */
  readonly name: string
  /** Metadata describing the provider */
  readonly metadata: LLMProviderMetadata
  /**
   * Create a new provider instance
   * @param config - Provider-specific configuration
   */
  create(config: TConfig): unknown // Returns BaseLLMProvider, but using unknown to avoid circular deps
  /**
   * Validate the configuration for this provider
   * @param config - Configuration to validate
   * @returns True if configuration is valid
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

// ============================================================================
// Provider Configuration Types
// ============================================================================

// Configuration Ollama
export interface OllamaConfig {
  url: string
  apiKey?: string
  model: string
  temperature?: number
  maxTokens?: number
}

// Configuration Claude (Anthropic)
export interface ClaudeConfig {
  apiKey: string
  model: string
  temperature?: number
  maxTokens?: number
}

// Configuration OpenAI
export interface OpenAIConfig {
  apiKey: string
  model: string
  temperature?: number
  maxTokens?: number
}

// LLM provider name (deprecated: kept for backward compatibility)
export type LLMProviderName = 'ollama' | 'claude' | 'openai'

// Sandbox mode type
export type SandboxMode = 'none' | 'restricted' | 'docker' | 'system'

// Sandbox configuration
export interface SandboxConfig {
  /** Whether sandbox mode is enabled */
  enabled: boolean
  /** Sandbox mode to use */
  mode: SandboxMode
  /** Timeout in milliseconds */
  timeout: number
  /** Docker image to use (for docker mode) */
  dockerImage: string
  /** Whether to mount current directory as read-only */
  readOnlyMount: boolean
}

// Union type for all known provider configs
export type KnownProviderConfig = OllamaConfig | ClaudeConfig | OpenAIConfig

// Generic provider configuration (can be any provider's config)
// Using a less strict type to allow interfaces without index signatures
export type ProviderConfig = { [key: string]: unknown }

// Configuration application
export interface AppConfig {
  /** Currently active provider (replaces llmProvider for dynamic providers) */
  activeProvider?: string
  /** Provider configurations by name (replaces fixed ollama/claude/openai properties) */
  providers?: Record<string, ProviderConfig>
  /** @deprecated Use activeProvider instead */
  llmProvider: LLMProviderName
  /** @deprecated Use providers['ollama'] instead */
  ollama: OllamaConfig
  /** @deprecated Use providers['claude'] instead */
  claude: ClaudeConfig
  /** @deprecated Use providers['openai'] instead */
  openai: OpenAIConfig
  theme: 'dark' | 'light'
  fontSize: number
  shell: string
  chatLanguage: string // Language for AI responses (e.g., 'en', 'fr', 'auto')
  sandbox: SandboxConfig
}

/**
 * Get the active provider name from config (handles both new and legacy format)
 */
export function getActiveProvider(config: AppConfig): string {
  return config.activeProvider ?? config.llmProvider ?? 'ollama'
}

/**
 * Get provider configuration by name (handles both new and legacy format)
 */
export function getProviderConfig<T extends ProviderConfig = ProviderConfig>(
  config: AppConfig,
  providerName: string
): T | undefined {
  // Try new format first
  if (config.providers && providerName in config.providers) {
    return config.providers[providerName] as T
  }
  // Fall back to legacy format
  switch (providerName) {
    case 'ollama':
      return config.ollama as unknown as T
    case 'claude':
      return config.claude as unknown as T
    case 'openai':
      return config.openai as unknown as T
    default:
      return undefined
  }
}

/**
 * Check if config uses the new provider format
 */
export function isModernConfig(config: AppConfig): boolean {
  return config.activeProvider !== undefined && config.providers !== undefined
}

/**
 * Migrate legacy config to new format
 */
export function migrateToModernConfig(config: AppConfig): AppConfig {
  if (isModernConfig(config)) {
    return config
  }

  return {
    ...config,
    activeProvider: config.llmProvider,
    providers: {
      ollama: config.ollama as unknown as ProviderConfig,
      claude: config.claude as unknown as ProviderConfig,
      openai: config.openai as unknown as ProviderConfig,
    },
  }
}

// ============================================================================
// IPC and Message Types
// ============================================================================

// Messages IPC
export interface IpcMessage<T = unknown> {
  type: string
  payload?: T
}

// Messages terminal
export interface TerminalMessage {
  type: 'command' | 'output' | 'error'
  content: string
}

// Commande IA
export type AICommand = AICommandText | AICommandShell

export interface AICommandText {
  type: 'text'
  content: string
}

export interface AICommandShell {
  type: 'command'
  intent: string
  command: string
  explanation: string
  confidence: number
}

// Interprétation de sortie de commande
export interface CommandInterpretation {
  summary: string
  key_findings: string[]
  warnings: string[]
  errors: string[]
  recommendations: string[]
  successful: boolean
}

// Historique de conversation (ancien format, à migrer vers Conversation)
export interface ConversationHistory {
  id: string
  timestamp: number
  userMessage: string
  aiResponse: AICommand
  executed: boolean
}

// Message de conversation pour le LLM
export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  // Champs optionnels pour les commandes exécutées
  command?: string // Commande shell exécutée
  output?: string // Résultat brut de la commande
  interpretation?: CommandInterpretation // Interprétation du résultat
}

// Conversation complète avec persistance
export interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ConversationMessage[]
}

// Liste des conversations
export interface ConversationsList {
  conversations: Conversation[]
}

// Streaming progress callback
export interface StreamingProgress {
  type: 'connecting' | 'receiving' | 'processing' | 'complete' | 'error'
  content?: string
  partialCommand?: AICommand
  error?: string
}

export type StreamingCallback = (progress: StreamingProgress) => void

// ============================================================================
// Checkpoint Types
// ============================================================================

/**
 * A checkpoint saves the state of a conversation at a specific point
 * Created automatically after each user message for easy restoration
 */
export interface Checkpoint {
  /** Unique identifier */
  id: string
  /** Conversation this checkpoint belongs to */
  conversationId: string
  /** Index of the message in the conversation (after this message) */
  messageIndex: number
  /** Snapshot of messages at this checkpoint */
  messages: ConversationMessage[]
  /** Timestamp when checkpoint was created */
  createdAt: number
}

/**
 * Lightweight checkpoint metadata for listing in UI
 */
export interface CheckpointMetadata {
  id: string
  conversationId: string
  messageIndex: number
  createdAt: number
  /** First 50 chars of the last user message for context */
  preview: string
}

// ============================================================================
// System Context Types
// ============================================================================

/**
 * Detected project type based on files present in the working directory
 */
export type ProjectType = 'node' | 'python' | 'rust' | 'go' | 'docker' | 'generic'

/**
 * Operating system information
 */
export interface OsInfo {
  platform: string
  distro?: string
  release: string
  arch: string
  hostname: string
}

/**
 * Git repository status snapshot
 */
export interface GitInfo {
  isRepo: boolean
  branch?: string
  status?: string
}

/**
 * System context collected for enriching LLM prompts
 */
export interface SystemContext {
  cwd: string
  os: OsInfo
  shell: string
  git: GitInfo
  projectType: ProjectType
  projectFiles: string[]
  hasDocker: boolean
  recentCommands: string[]
}

// Configuration par défaut et fonctions utilitaires
export { DEFAULT_CONFIG, getEnvConfig, getEnvSources, mergeConfig } from './config'
