import * as path from 'node:path'
import { app, BrowserWindow, nativeImage, screen } from 'electron'
import Store from 'electron-store'
import { DEFAULT_CONFIG, mergeConfig } from '../shared/config'
import type { AppConfig } from '../shared/types'
import { createAuditHandlers } from './ipc-handlers/audit'
import { createCheckpointHandlers } from './ipc-handlers/checkpoint'
import { createConfigHandlers } from './ipc-handlers/config'
import { createContextHandlers } from './ipc-handlers/context'
import { createConversationHandlers } from './ipc-handlers/conversation'
import { cleanupActiveStreams, createLLMHandlers } from './ipc-handlers/llm-service'
import { createTerminalHandlers } from './ipc-handlers/terminal'
import { createVideoHandlers } from './ipc-handlers/video'
import { checkForUpdates } from './services/versionCheckService'
import { Logger } from './utils/logger'

// Logger instance for main process
const logger = new Logger('Main')

interface StoreType {
  get: (key: string) => unknown
  set: (key: string, value: unknown) => void
}

const isStoreType = (value: unknown): value is StoreType => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const store = value as Record<string, unknown>
  return typeof store.get === 'function' && typeof store.set === 'function'
}

const isAppConfig = (value: unknown): value is AppConfig => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const config = value as Record<string, unknown>

  const ollama = config.ollama
  if (!ollama || typeof ollama !== 'object') {
    return false
  }

  const ollamaConfig = ollama as Record<string, unknown>
  if (typeof ollamaConfig.url !== 'string' || typeof ollamaConfig.model !== 'string') {
    return false
  }

  if (typeof ollamaConfig.temperature !== 'number' || typeof ollamaConfig.maxTokens !== 'number') {
    return false
  }

  if (typeof config.theme !== 'string' || typeof config.fontSize !== 'number') {
    return false
  }

  return true
}

/**
 * Normalize a stored config to ensure all required fields exist (backward compat)
 */
const normalizeConfig = (config: AppConfig): AppConfig => ({
  ...DEFAULT_CONFIG,
  ...config,
  ollama: {
    ...DEFAULT_CONFIG.ollama,
    ...config.ollama,
    url: config.ollama?.url || DEFAULT_CONFIG.ollama.url,
  },
  claude: config.claude ? { ...DEFAULT_CONFIG.claude, ...config.claude } : DEFAULT_CONFIG.claude,
  llmProvider: config.llmProvider ?? DEFAULT_CONFIG.llmProvider,
})

const isDev = process.env.NODE_ENV === 'development' && !app.isPackaged

// Initialize store for configuration (with environment variables override)
const rawStore = new Store({
  defaults: {
    config: DEFAULT_CONFIG,
  },
})

const store = isStoreType(rawStore)
  ? rawStore
  : ({
      get: () => null,
      set: () => {
        /* No-op fallback */
      },
    } as StoreType)

let mainWindow: BrowserWindow | null = null

/**
 * Get the main window (for IPC handlers that need to send events)
 */
const getMainWindow = (): BrowserWindow | null => mainWindow

const createWindow = (): void => {
  const windowWidth = 1200
  const windowHeight = 800

  // Check if we're in demo mode (for video recording)
  const isDemoMode = process.env.DEMO_VIDEO === '1'

  // Position window at (0, 0) for demo mode (for screen recording)
  // Otherwise center it on the primary display
  let x: number
  let y: number
  if (isDemoMode) {
    x = 0
    y = 0
  } else {
    // Get the primary display to calculate center position
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize
    x = Math.round((screenWidth - windowWidth) / 2 + primaryDisplay.bounds.x)
    y = Math.round((screenHeight - windowHeight) / 2 + primaryDisplay.bounds.y)
  }

  // Set the application icon
  const iconPath = isDev
    ? path.join(__dirname, '../../build/icons/icon.png')
    : path.join(process.resourcesPath, 'icon.png')

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 800,
    minHeight: 600,
    x,
    y,
    autoHideMenuBar: true,
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Disable DevTools in production for security (prevents users from inspecting sensitive data)
      devTools: isDev,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    backgroundColor: '#1e1e1e',
  })

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // Only open DevTools if TERMAID_DEVTOOLS environment variable is set to 'true'
    if (process.env.TERMAID_DEVTOOLS === 'true') {
      mainWindow.webContents.openDevTools()
    }
  } else {
    // Use relative path from compiled main.js location
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  // Add error handler for loading issues
  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      logger.error('Failed to load', { errorCode, errorDescription, validatedURL })
      // Fallback to local file if dev server is unavailable
      if (isDev && errorCode === -102 && mainWindow) {
        logger.info('Dev server unavailable, falling back to local file')
        mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
      }
    }
  )

  mainWindow.webContents.on('did-finish-load', () => {
    logger.info('Page loaded successfully')
  })

  // Add keyboard shortcut to open DevTools (Ctrl+Shift+I or Cmd+Option+I)
  // Only available in development mode for security
  if (isDev) {
    mainWindow.webContents.on('before-input-event', (_event, input) => {
      if (
        (input.control || input.meta) &&
        input.shift &&
        (input.key.toLowerCase() === 'i' || input.key === 'I')
      ) {
        mainWindow?.webContents.toggleDevTools()
      }
    })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// App lifecycle
app.whenReady().then(() => {
  // Register IPC handlers BEFORE creating the window to avoid race conditions
  // The handlers use getMainWindow() to get the window when needed
  createTerminalHandlers(getMainWindow)
  createConversationHandlers()
  createCheckpointHandlers()
  createAuditHandlers(getMainWindow)
  createContextHandlers()

  // Get initial config and merge with environment variables
  const storedConfig = store.get('config')
  const validConfig = isAppConfig(storedConfig) ? normalizeConfig(storedConfig) : DEFAULT_CONFIG
  const mergedConfig = mergeConfig(validConfig)
  createLLMHandlers(getMainWindow, mergedConfig)

  createConfigHandlers(getMainWindow, store)
  createVideoHandlers(getMainWindow)

  // Now create the window - handlers are already registered
  createWindow()

  // Check for updates in the background (non-blocking)
  checkForUpdates().catch(error => {
    logger.error('Version check failed', error)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  // Cleanup all active streaming requests
  cleanupActiveStreams()
})
