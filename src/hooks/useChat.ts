import type { ConversationMessage } from '@shared/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatMessageData } from '@/components/chat'
import { useCommandExecution } from '@/hooks/useCommandExecution'
import { useConversationState } from '@/hooks/useConversationState'
import { useInputHistory } from '@/hooks/useInputHistory'
import { useStreamingCommand } from '@/hooks/useStreamingCommand'
import { useToast } from '@/hooks/useToast'
import { hasInjectionPatterns, sanitizeUserInput } from '@/services/commandExecutionService'
import {
  useAddMessageToConversation,
  useAiCommand,
  useConfig,
  useCreateConversation,
  useCurrentConversation,
  useError,
  useIsLoading,
  useLoadConversations,
  useSetAiCommand,
  useSetError,
  useSetIsLoading,
  useStore,
  useTerminalPid,
  useUpdateMessageInConversation,
} from '@/store/useStore'
import { Logger } from '@/utils/logger'

const logger = new Logger('useChat')

// Constants
const DEBOUNCE_MS = 300 // Debounce delay for user input

/**
 * Simple debounce hook
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Custom hook for managing chat logic
 * Orchestrates specialized hooks for input history, streaming, execution, and conversation state
 */
export function useChat() {
  const { i18n } = useTranslation()
  const [userInput, setUserInput] = useState('')

  // Global store state (using individual selector hooks)
  const _config = useConfig()
  const aiCommand = useAiCommand()
  const setAiCommand = useSetAiCommand()
  const isLoading = useIsLoading()
  const setIsLoading = useSetIsLoading()
  const error = useError()
  const setError = useSetError()
  const terminalPid = useTerminalPid()
  const currentConversation = useCurrentConversation()
  const createConversation = useCreateConversation()
  const addMessageToConversation = useAddMessageToConversation()
  const updateMessageInConversation = useUpdateMessageInConversation()
  const loadConversations = useLoadConversations()

  const { addToast } = useToast()

  // Debounced user input for auto-hiding AI command
  const debouncedUserInput = useDebounce(userInput, DEBOUNCE_MS)

  // Specialized hooks
  const inputHistory = useInputHistory()
  const conversationState = useConversationState()

  // Memoize callbacks to prevent re-renders
  const handleStreamComplete = useCallback(
    command => {
      setAiCommand(command)
      // Note: setIsLoading(false) is called after DB save in streamAICommand
      logger.info('AI command generated:', command.command)
    },
    [setAiCommand]
  )

  const handleStreamError = useCallback(
    err => {
      setError(err.message)
      setIsLoading(false)
      addToast('error', err.message)
    },
    [setError, setIsLoading, addToast]
  )

  const handleExecutionComplete = useCallback((_command, _output) => {
    logger.info('Command executed successfully')
  }, [])

  const handleExecutionError = useCallback(
    err => {
      addToast('error', err.message)
    },
    [addToast]
  )

  const streaming = useStreamingCommand({
    onStreamComplete: handleStreamComplete,
    onStreamError: handleStreamError,
  })

  const handleInterpretationError = useCallback(
    (error: Error) => {
      logger.warn('Interpretation failed (non-fatal):', error.message)
      addToast('warning', `Output analysis failed: ${error.message}`)
    },
    [addToast]
  )

  const execution = useCommandExecution({
    onExecutionComplete: handleExecutionComplete,
    onExecutionError: handleExecutionError,
    onInterpretationError: handleInterpretationError,
  })

  const isInterpreting = execution.isInterpreting

  /**
   * Load conversations on mount
   */
  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  /**
   * Restore conversation messages when conversation ID changes (loading a different conversation)
   */
  const prevConversationIdRef = useRef<string | null>(null)
  const prevMessagesLengthRef = useRef<number>(0)

  useEffect(() => {
    const conversationId = currentConversation?.id || null
    const messagesLength = currentConversation?.messages.length || 0

    // Restore when conversation ID changes OR when messages length decreases (checkpoint restore)
    if (
      conversationId !== prevConversationIdRef.current ||
      (prevMessagesLengthRef.current > 0 && messagesLength < prevMessagesLengthRef.current)
    ) {
      prevConversationIdRef.current = conversationId
      prevMessagesLengthRef.current = messagesLength

      if (currentConversation && currentConversation.messages.length > 0) {
        const restoredMessages: ChatMessageData[] = currentConversation.messages.map(
          (msg, idx) => ({
            id: `msg-restored-${idx}`,
            type: msg.role === 'user' ? 'user' : 'ai',
            content: msg.content,
            output: msg.output,
            interpretation: msg.interpretation,
          })
        )
        conversationState.restoreMessages(restoredMessages)
      } else if (!currentConversation) {
        conversationState.clearConversation()
      }
    } else if (messagesLength > prevMessagesLengthRef.current) {
      // Update length when messages are added
      prevMessagesLengthRef.current = messagesLength
    }
  }, [
    currentConversation?.id,
    currentConversation,
    conversationState.restoreMessages,
    conversationState.clearConversation,
  ])

  /**
   * Auto-hide AI command when user starts typing new content
   */
  const prevDebouncedInputRef = useRef<string>('')

  useEffect(() => {
    const changed = debouncedUserInput !== prevDebouncedInputRef.current
    prevDebouncedInputRef.current = debouncedUserInput

    if (changed && aiCommand?.type === 'command' && debouncedUserInput.length > 0) {
      setAiCommand(null)
    }
  }, [debouncedUserInput, aiCommand, setAiCommand])

  /**
   * Handle user input changes
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value)
  }, [])

  /**
   * Generate AI command from user prompt (streaming)
   */
  const streamAICommand = useCallback(
    async (prompt: string) => {
      logger.debug('streamAICommand called with:', prompt)

      // Guard against concurrent calls
      if (!prompt.trim() || isLoading || streaming.isStreaming) {
        logger.debug('streamAICommand: skipping - already loading or streaming')
        return
      }

      // Sanitize input
      const sanitized = sanitizeUserInput(prompt)
      const injectionCheck = hasInjectionPatterns(sanitized)
      if (injectionCheck.hasInjection) {
        const errorMsg = i18n.t('errors.dangerousInput')
        setError(errorMsg)
        addToast('error', errorMsg)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        // Create conversation if needed (creates empty conversation)
        if (!currentConversation) {
          await createConversation(sanitized)
        }

        // Add user message to local conversation
        const userMessageId = `msg-user-${Date.now()}`
        conversationState.addMessage({
          id: userMessageId,
          type: 'user',
          content: sanitized,
        })

        // Save user message to persistent storage (always after creating conversation if needed)
        await addMessageToConversation({
          role: 'user',
          content: sanitized,
          timestamp: new Date(),
        })

        // Build conversation history for context
        const conversationHistory: ConversationMessage[] =
          currentConversation?.messages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })) || []

        // Stream AI command
        const command = await streaming.startStreaming(
          sanitized,
          conversationHistory,
          i18n.language
        )

        if (command) {
          // Add AI command to local conversation
          const messageId = `msg-${Date.now()}`
          const aiContent = command.type === 'text' ? command.content : command.explanation || ''

          // Calculate index BEFORE adding (index of the message we're about to add)
          // Use ref to avoid stale closure in async execution
          const messageIndex = conversationState.messageCounterRef.current

          conversationState.addMessage({
            id: messageId,
            type: 'ai',
            content: aiContent,
            command: command.type === 'command' ? command : undefined,
          })

          // Save AI response to persistent storage
          // Calculate the persisted index: user message is at length-1, assistant will be at length
          // Need to get fresh state since currentConversation might be stale in closure
          const currentState = useStore.getState()
          const freshConversation = currentState.currentConversation
          const userMessageIndex = freshConversation ? freshConversation.messages.length - 1 : 0
          const persistedIndex = userMessageIndex + 1 // Assistant message comes after user message

          const messageToSave: ConversationMessage = {
            role: 'assistant',
            content: aiContent,
          }
          if (command.type === 'command') {
            messageToSave.command = command.command
          }

          // Set both indices BEFORE db save to prevent race condition:
          // user clicking Execute before persistedCommandIndex is set
          if (command.type === 'command') {
            conversationState.setCurrentCommandIndex(messageIndex)
            conversationState.setPersistedCommandIndex(persistedIndex)
          }

          await addMessageToConversation(messageToSave)

          // Add to input history
          inputHistory.addToHistory(sanitized)
          inputHistory.resetNavigation()

          // Clear user input
          setUserInput('')

          // Mark as complete after all DB operations are done
          setIsLoading(false)
        }
      } catch (err) {
        logger.error('Failed to generate AI command:', err)
        setIsLoading(false)
        // Error already handled by streaming.onStreamError
      }
    },
    [
      isLoading,
      streaming.isStreaming,
      i18n,
      setIsLoading,
      setError,
      currentConversation,
      createConversation,
      addMessageToConversation,
      conversationState.addMessage,
      conversationState.messageCounterRef,
      conversationState.setCurrentCommandIndex,
      conversationState.setPersistedCommandIndex,
      streaming.startStreaming,
      inputHistory.addToHistory,
      inputHistory.resetNavigation,
      addToast,
    ]
  )

  /**
   * Generate AI command from user prompt (non-streaming, legacy)
   */
  const generateAICommand = useCallback(
    async (prompt: string) => {
      logger.debug('generateAICommand called (non-streaming):', prompt)

      // Guard against concurrent calls
      if (!prompt.trim() || isLoading) {
        logger.debug('generateAICommand: skipping - already loading')
        return
      }

      // Sanitize input
      const sanitized = sanitizeUserInput(prompt)
      const injectionCheck = hasInjectionPatterns(sanitized)
      if (injectionCheck.hasInjection) {
        const errorMsg = i18n.t('errors.dangerousInput')
        setError(errorMsg)
        addToast('error', errorMsg)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        // Add user message to local conversation
        const userMessageId = `msg-user-${Date.now()}`
        conversationState.addMessage({
          id: userMessageId,
          type: 'user',
          content: sanitized,
        })

        // Create conversation if needed (creates empty conversation)
        if (!currentConversation) {
          await createConversation(sanitized)
        }

        // Save user message to persistent storage (always after creating conversation if needed)
        await addMessageToConversation({
          role: 'user',
          content: sanitized,
          timestamp: new Date(),
        })

        // Build conversation history for context
        const conversationHistory: ConversationMessage[] =
          currentConversation?.messages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })) || []

        // Generate command (non-streaming)
        const command = await window.electron.llm.generateCommand(
          sanitized,
          conversationHistory,
          i18n.language
        )

        // Add AI command to local conversation
        const aiContent = command.type === 'text' ? command.content : command.explanation || ''

        // Calculate index BEFORE adding (index of the message we're about to add)
        // Use ref to avoid stale closure in async execution
        const messageIndex = conversationState.messageCounterRef.current

        conversationState.addMessage({
          id: `msg-${Date.now()}`,
          type: 'ai',
          content: aiContent,
          command: command.type === 'command' ? command : undefined,
        })

        // Save AI response to persistent storage
        // Calculate the persisted index: user message is at length-1, assistant will be at length
        // Need to get fresh state since currentConversation might be stale in closure
        const currentState = useStore.getState()
        const freshConversation = currentState.currentConversation
        const userMessageIndex = freshConversation ? freshConversation.messages.length - 1 : 0
        const persistedIndex = userMessageIndex + 1 // Assistant message comes after user message

        const messageToSave: ConversationMessage = {
          role: 'assistant',
          content: aiContent,
        }
        if (command.type === 'command') {
          messageToSave.command = command.command
        }

        // Set both indices BEFORE db save to prevent race condition
        if (command.type === 'command') {
          conversationState.setCurrentCommandIndex(messageIndex)
          conversationState.setPersistedCommandIndex(persistedIndex)
        }

        await addMessageToConversation(messageToSave)

        // Set aiCommand AFTER indices are set so Execute button only appears when both are ready
        setAiCommand(command)

        // Add to input history
        inputHistory.addToHistory(sanitized)
        inputHistory.resetNavigation()

        // Clear user input
        setUserInput('')

        // Mark as complete after all DB operations are done
        setIsLoading(false)

        logger.info('AI command generated:', command.command)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error.message)
        setIsLoading(false)
        addToast('error', error.message)
        logger.error('Failed to generate AI command:', error)
      }
    },
    [
      isLoading,
      i18n,
      setIsLoading,
      setError,
      setAiCommand,
      currentConversation,
      createConversation,
      addMessageToConversation,
      conversationState.addMessage,
      conversationState.messageCounterRef,
      conversationState.setCurrentCommandIndex,
      conversationState.setPersistedCommandIndex,
      inputHistory.addToHistory,
      inputHistory.resetNavigation,
      addToast,
    ]
  )

  /**
   * Execute a command in the terminal
   */
  const executeCommand = useCallback(
    async (command: string, messageIndex?: number) => {
      // Hide command actions immediately when execution starts
      setAiCommand(null)

      try {
        if (messageIndex !== undefined && conversationState.persistedCommandIndex !== null) {
          // Execute with interpretation
          await execution.executeWithInterpretation(
            command,
            messageIndex,
            conversationState.persistedCommandIndex,
            (output, interpretation) => {
              logger.info('Interpretation callback:', {
                messageIndex,
                interpretation: interpretation?.summary,
              })
              // Update local conversation
              conversationState.updateMessage(messageIndex, { output, interpretation })

              // Persist to storage
              if (conversationState.persistedCommandIndex !== null) {
                updateMessageInConversation(conversationState.persistedCommandIndex, {
                  output,
                  interpretation,
                })
              }
            }
          )
        } else {
          // Execute without interpretation
          await execution.executeCommand(command)
        }
      } catch (err) {
        logger.error('Command execution failed:', err)
        // Error already handled by execution.onExecutionError
      }
    },
    [
      execution.executeCommand,
      execution.executeWithInterpretation,
      conversationState.persistedCommandIndex,
      conversationState.updateMessage,
      setAiCommand,
      updateMessageInConversation,
    ]
  )

  /**
   * Modify an existing AI-generated command
   * Copies command to input field and hides command actions
   */
  const modifyCommand = useCallback(() => {
    if (!aiCommand || aiCommand.type !== 'command') return

    // Copy command to input field for editing
    setUserInput(aiCommand.command)

    // Hide command actions
    setAiCommand(null)
  }, [aiCommand, setAiCommand])

  /**
   * Navigate through input history (arrow keys)
   */
  const navigateHistory = useCallback(
    (direction: 'up' | 'down') => {
      const newInput = inputHistory.navigateHistory(direction, userInput)
      setUserInput(newInput)
    },
    [inputHistory.navigateHistory, userInput]
  )

  /**
   * Clear conversation and reset state
   */
  const clearChat = useCallback(() => {
    conversationState.clearConversation()
    setAiCommand(null)
    setError(null)
    setUserInput('')
    inputHistory.resetNavigation()
  }, [conversationState.clearConversation, setAiCommand, setError, inputHistory.resetNavigation])

  return {
    // State
    userInput,
    conversation: conversationState.conversation,
    currentCommandIndex: conversationState.currentCommandIndex,
    isInterpreting,
    isExecuting: execution.isExecuting,
    executionProgress: execution.executionProgress,

    // Streaming state
    isStreaming: streaming.isStreaming,
    streamingContent: streaming.streamingContent,
    streamingProgress: streaming.streamingProgress,

    // Global state from store
    aiCommand,
    isLoading: isLoading || streaming.isStreaming,
    error,
    terminalPid,

    // Actions
    setUserInput,
    handleInputChange,
    generateAICommand,
    streamAICommand,
    cancelStreaming: streaming.cancelStreaming,
    executeCommand,
    modifyCommand,
    addToHistory: inputHistory.addToHistory,
    navigateHistory,
    clearChat,
  }
}
