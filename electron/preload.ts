import type {
  AppConfig,
  Conversation,
  ConversationMessage,
  LLMProviderMetadata,
  ProviderInfo,
  StreamingProgress,
  SystemContext,
} from '@shared/types'
import { contextBridge, desktopCapturer, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Config
  getConfig: () => ipcRenderer.invoke('config:get'),
  getConfigEnvSources: () => ipcRenderer.invoke('config:get-env-sources'),
  setConfig: (config: AppConfig) => ipcRenderer.invoke('config:set', config),
  resetConfig: () => ipcRenderer.invoke('config:reset'),

  // Terminal
  terminalCreate: () => ipcRenderer.invoke('terminal:create'),
  terminalWrite: (pid: number, data: string) => ipcRenderer.invoke('terminal:write', pid, data),
  terminalResize: (pid: number, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal:resize', pid, cols, rows),
  terminalDestroy: (pid: number) => ipcRenderer.invoke('terminal:destroy', pid),
  terminalStartCapture: (pid: number) => ipcRenderer.invoke('terminal:startCapture', pid),
  terminalGetCapture: (pid: number) => ipcRenderer.invoke('terminal:getCapture', pid),
  terminalWaitForPrompt: (
    pid: number,
    options?: {
      maxWaitTimeMs?: number
      checkIntervalMs?: number
      minWaitTimeMs?: number
      customPatterns?: string[]
    }
  ) => ipcRenderer.invoke('terminal:waitForPrompt', pid, options),

  // Terminal events (return unsubscribe functions for cleanup)
  onTerminalData: (callback: (data: { pid: number; data: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { pid: number; data: string }) =>
      callback(data)
    ipcRenderer.on('terminal:data', handler)
    return () => {
      ipcRenderer.removeListener('terminal:data', handler)
    }
  },
  onTerminalExit: (callback: (data: { pid: number; code: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { pid: number; code: number }) =>
      callback(data)
    ipcRenderer.on('terminal:exit', handler)
    return () => {
      ipcRenderer.removeListener('terminal:exit', handler)
    }
  },

  // Context
  getContext: (recentCommands?: string[]) =>
    ipcRenderer.invoke('context:get', recentCommands) as Promise<SystemContext>,
  setCwd: (cwd: string) => ipcRenderer.invoke('context:set-cwd', cwd),

  // LLM
  llmInit: (config: {
    url: string
    apiKey?: string
    model: string
    temperature?: number
    maxTokens?: number
  }) => ipcRenderer.invoke('llm:init', config),
  llmGenerateCommand: (
    prompt: string,
    conversationHistory?: ConversationMessage[],
    language?: string
  ) => ipcRenderer.invoke('llm:generate-command', prompt, conversationHistory, language),
  llmExplainCommand: (command: string) => ipcRenderer.invoke('llm:explain-command', command),
  llmInterpretOutput: (output: string, language?: string, command?: string) =>
    ipcRenderer.invoke('llm:interpret-output', output, language, command),
  llmTestConnection: () => ipcRenderer.invoke('llm:test-connection'),
  llmListModels: () => ipcRenderer.invoke('llm:list-models'),

  // LLM Streaming
  llmStreamCommand: (
    requestId: string,
    prompt: string,
    conversationHistory?: ConversationMessage[],
    language?: string
  ) => ipcRenderer.invoke('llm:stream-command', requestId, prompt, conversationHistory, language),
  llmCancelStream: (requestId: string) => ipcRenderer.invoke('llm:cancel-stream', requestId),
  onLlmStreamProgress: (requestId: string, callback: (progress: StreamingProgress) => void) => {
    const channel = `llm:stream-progress:${requestId}`
    const handler = (_event: Electron.IpcRendererEvent, progress: StreamingProgress) =>
      callback(progress)
    ipcRenderer.on(channel, handler)
    return () => {
      ipcRenderer.removeListener(channel, handler)
    }
  },

  // LLM Provider Management
  llmListProviders: () =>
    ipcRenderer.invoke('llm:list-providers') as Promise<LLMProviderMetadata[]>,
  llmGetProviderInfos: (configs?: Record<string, unknown>) =>
    ipcRenderer.invoke('llm:get-provider-infos', configs) as Promise<ProviderInfo[]>,
  llmGetProviderDefaults: (providerName: string) =>
    ipcRenderer.invoke('llm:get-provider-defaults', providerName) as Promise<
      Record<string, unknown> | undefined
    >,
  llmTestProviderConnection: (providerName: string, config: unknown) =>
    ipcRenderer.invoke('llm:test-provider-connection', providerName, config) as Promise<boolean>,
  llmListProviderModels: (providerName: string, config: unknown) =>
    ipcRenderer.invoke('llm:list-provider-models', providerName, config) as Promise<string[]>,

  // Conversations
  conversationGetAll: () => ipcRenderer.invoke('conversation:get-all'),
  conversationGet: (id: string) => ipcRenderer.invoke('conversation:get', id),
  conversationCreate: (firstMessage: string) =>
    ipcRenderer.invoke('conversation:create', firstMessage),
  conversationAddMessage: (conversationId: string, message: ConversationMessage) =>
    ipcRenderer.invoke('conversation:add-message', conversationId, message),
  conversationUpdateMessage: (
    conversationId: string,
    messageIndex: number,
    updates: Partial<ConversationMessage>
  ) => ipcRenderer.invoke('conversation:update-message', conversationId, messageIndex, updates),
  conversationUpdate: (id: string, updates: Partial<Conversation>) =>
    ipcRenderer.invoke('conversation:update', id, updates),
  conversationDelete: (id: string) => ipcRenderer.invoke('conversation:delete', id),
  conversationClearAll: () => ipcRenderer.invoke('conversation:clear-all'),
  conversationExport: (id: string) => ipcRenderer.invoke('conversation:export', id),
  conversationExportAll: () => ipcRenderer.invoke('conversation:export-all'),
  conversationImport: () => ipcRenderer.invoke('conversation:import'),

  // Checkpoints
  checkpointGetAll: (conversationId: string) =>
    ipcRenderer.invoke('checkpoint:get-all', conversationId),
  checkpointGet: (conversationId: string, checkpointId: string) =>
    ipcRenderer.invoke('checkpoint:get', conversationId, checkpointId),
  checkpointRestore: (conversationId: string, checkpointId: string) =>
    ipcRenderer.invoke('checkpoint:restore', conversationId, checkpointId),
  checkpointRestoreByIndex: (conversationId: string, messageIndex: number) =>
    ipcRenderer.invoke('checkpoint:restore-by-index', conversationId, messageIndex),

  // Audit Logs
  auditGetLogs: (query?: {
    result?: 'success' | 'blocked' | 'cancelled' | 'error' | 'sandboxed'
    riskLevel?: 'safe' | 'warning' | 'dangerous'
    fromDate?: string
    toDate?: string
    limit?: number
    commandPattern?: string
  }) => ipcRenderer.invoke('audit:get-logs', query),
  auditGetStatistics: () => ipcRenderer.invoke('audit:get-statistics'),
  auditClearLogs: () => ipcRenderer.invoke('audit:clear-logs'),
  auditExportLogs: () => ipcRenderer.invoke('audit:export-logs'),
  auditExportLogsCsv: () => ipcRenderer.invoke('audit:export-logs-csv'),

  // Desktop capturer for demo video recording
  desktopCapturer: {
    getSources: (options: { types: Array<'screen' | 'window'> }) =>
      desktopCapturer.getSources(options),
  },
})
