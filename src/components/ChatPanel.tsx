import type { ValidationResult } from '@shared/commandValidation'
import { validateCommand } from '@shared/commandValidation'
import type { CSSProperties } from 'react'
import { type FormEvent, Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckpointDivider } from '@/components/CheckpointDivider'
import { CommandWarningModal } from '@/components/CommandWarningModal'
import { useChat } from '@/hooks/useChat'
import {
  useClearAllConversations,
  useCurrentConversationId,
  useRestoreCheckpoint,
  useSetAiCommand,
} from '@/store/useStore'
import { Logger } from '@/utils/logger'
import { ChatMessage } from './chat'
import './ChatPanel.css'

const logger = new Logger('ChatPanel')

export const ChatPanel = ({ style }: { style?: CSSProperties }) => {
  const { t } = useTranslation()

  // Ref for the chat input element
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Ref for the messages container for auto-scroll
  const messagesRef = useRef<HTMLDivElement>(null)
  // Track if user is at the bottom of the chat
  const [isAtBottom, setIsAtBottom] = useState(true)

  // Use the custom chat hook for chat logic
  const chat = useChat()

  // Use setAiCommand from store directly for the cancel button
  const setAiCommand = useSetAiCommand()
  const clearAllConversations = useClearAllConversations()
  const currentConversationId = useCurrentConversationId()
  const restoreCheckpoint = useRestoreCheckpoint()

  // State for command warning modal
  const [_pendingCommand, _setPendingCommand] = useState<{
    command: string
    validation: ValidationResult
  } | null>(null)

  // Check if user is at the bottom of the chat
  const checkIsAtBottom = useCallback(() => {
    const container = messagesRef.current
    if (!container) return true

    const threshold = 50 // Allow 50px tolerance
    const isBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold
    setIsAtBottom(isBottom)
    return isBottom
  }, [])

  // Scroll to bottom of messages
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = messagesRef.current
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      })
      setIsAtBottom(true)
    }
  }, [])

  // Auto-scroll to bottom when new messages arrive (only if user is at bottom)
  // We use conversation.length as a trigger to detect new messages
  // Also scroll when interpretation completes (isInterpreting changes to false)
  // Also scroll during streaming to show progress
  // biome-ignore lint/correctness/useExhaustiveDependencies: conversation.length, isInterpreting, streamingContent trigger scroll
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom('instant')
    }
  }, [
    chat.conversation.length,
    chat.isInterpreting,
    chat.streamingContent,
    isAtBottom,
    scrollToBottom,
  ])

  // Handle scroll events to track user position
  useEffect(() => {
    const container = messagesRef.current
    if (!container) return

    const handleScroll = () => {
      checkIsAtBottom()
    }

    container.addEventListener('scroll', handleScroll)
    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [checkIsAtBottom])

  // Auto-focus chat input field on mount and when loading completes
  useEffect(() => {
    if (!chat.isLoading && inputRef.current) {
      inputRef.current.focus()
    }
  }, [chat.isLoading])

  // State for command validation warning modal
  const [pendingValidation, setPendingValidation] = useState<{
    command: string
    validation: ValidationResult
    messageIndex?: number
  } | null>(null)

  /**
   * Validate a command and show warning modal if needed
   * Returns true if command should proceed, false if blocked or waiting for confirmation
   */
  const validateAndExecuteCommand = useCallback(
    async (command: string, messageIndex?: number): Promise<boolean> => {
      const validation = validateCommand(command)

      // If command is safe, proceed directly
      if (validation.riskLevel === 'safe') {
        await chat.executeCommand(command, messageIndex)
        return true
      }

      // If command is blocked, show error
      if (validation.blocked) {
        setPendingValidation({ command, validation, messageIndex })
        return false
      }

      // If command is warning or dangerous, show modal for confirmation
      setPendingValidation({ command, validation, messageIndex })
      return false
    },
    [chat]
  )

  /**
   * Handle confirmation from warning modal
   */
  const handleConfirmWarning = useCallback(async () => {
    if (pendingValidation) {
      const { command, messageIndex } = pendingValidation
      setPendingValidation(null)
      await chat.executeCommand(command, messageIndex)
    }
  }, [pendingValidation, chat])

  /**
   * Handle cancellation from warning modal
   */
  const handleCancelWarning = useCallback(() => {
    setPendingValidation(null)
  }, [])

  const executeCurrentCommand = useCallback(async () => {
    logger.debug('Execute command triggered')
    logger.debug('Button terminalPid check:', chat.terminalPid)
    logger.debug('Using currentCommandIndex:', chat.currentCommandIndex)
    if (chat.aiCommand?.type === 'command') {
      await validateAndExecuteCommand(chat.aiCommand.command, chat.currentCommandIndex ?? undefined)
    }
  }, [chat.aiCommand, chat.terminalPid, chat.currentCommandIndex, validateAndExecuteCommand])

  const handleExecuteCommand = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      executeCurrentCommand()
    },
    [executeCurrentCommand]
  )

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter: Execute command
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        if (chat.aiCommand?.type === 'command') {
          executeCurrentCommand()
        }
      }

      // Ctrl+K: Clear conversation
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        chat.clearChat()
        clearAllConversations()
      }

      // Esc: Cancel current action
      if (e.key === 'Escape') {
        e.preventDefault()
        if (chat.aiCommand) {
          setAiCommand(null)
        }
        if (chat.error) {
          chat.setUserInput('')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    chat.aiCommand,
    chat.error,
    chat.clearChat,
    chat.setUserInput,
    setAiCommand,
    clearAllConversations,
    executeCurrentCommand,
  ])

  const submitMessage = useCallback(async () => {
    if (!chat.userInput.trim() || chat.isLoading || chat.isStreaming) return
    const prompt = chat.userInput.trim()
    chat.setUserInput('')
    // Use streaming by default for better UX
    await chat.streamAICommand(prompt)
  }, [chat.userInput, chat.isLoading, chat.isStreaming, chat.setUserInput, chat.streamAICommand])

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Arrow Up: Navigate to previous input in history
    if (e.key === 'ArrowUp') {
      const textarea = e.currentTarget
      // Only navigate history if at the start of the text or text is empty
      if (textarea.selectionStart === 0 && textarea.selectionEnd === 0) {
        e.preventDefault()
        chat.navigateHistory('up')
      }
      return
    }

    // Arrow Down: Navigate to next input in history
    if (e.key === 'ArrowDown') {
      const textarea = e.currentTarget
      // Only navigate history if at the end of the text or text is empty
      if (textarea.selectionStart === textarea.value.length) {
        e.preventDefault()
        chat.navigateHistory('down')
      }
      return
    }

    // Enter alone = submit (unless Shift is pressed)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitMessage()
    }
    // Shift+Enter = new line (default textarea behavior)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    submitMessage()
  }

  return (
    <div className="chat-panel" style={style}>
      <div className="chat-header">
        <h2>AI Assistant</h2>
      </div>

      <div
        className="chat-messages"
        aria-live="polite"
        aria-label="Chat messages"
        role="log"
        ref={messagesRef}
      >
        {chat.conversation.length === 0 && (
          <div className="chat-welcome">
            <h3>{t('chat.welcome.title')}</h3>
            <p>{t('chat.welcome.description')}</p>
            <p className="chat-examples">{t('chat.welcome.examples')}</p>
            <ul>
              <li>{t('chat.welcome.example1')}</li>
              <li>{t('chat.welcome.example2')}</li>
              <li>{t('chat.welcome.example3')}</li>
            </ul>
          </div>
        )}

        {chat.conversation
          .filter(msg => !msg.isStreaming)
          .map((msg, index) => (
            <Fragment key={msg.id}>
              <ChatMessage id={msg.id} message={msg} />
              {msg.type === 'user' && currentConversationId && (
                <CheckpointDivider
                  checkpoint={{
                    id: `${currentConversationId}-${index}`,
                    conversationId: currentConversationId,
                    messageIndex: index,
                    createdAt: Date.now(),
                    preview: msg.content.slice(0, 50) + (msg.content.length > 50 ? '...' : ''),
                  }}
                  onRestore={async (checkpointId: string) => {
                    await restoreCheckpoint(checkpointId)
                  }}
                  isLoading={chat.isLoading}
                />
              )}
            </Fragment>
          ))}

        {!isAtBottom && (
          <button
            type="button"
            className="scroll-to-bottom-btn"
            onClick={() => scrollToBottom()}
            title={t('chat.scrollToBottom')}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <title>{t('chat.scrollToBottom')}</title>
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <polyline points="19 12 12 19 5 12"></polyline>
            </svg>
          </button>
        )}

        {chat.isLoading && !chat.isStreaming && (
          <div className="chat-message ai">
            <div className="message-content">
              <output className="loading-spinner" aria-label="Loading">
                <span></span>
                <span></span>
                <span></span>
              </output>
            </div>
          </div>
        )}

        {chat.isStreaming && (
          <div className="chat-message ai streaming">
            <div className="message-content">
              {chat.streamingProgress?.type === 'connecting' && (
                <div className="streaming-status">
                  <output className="loading-spinner" aria-label="Connecting">
                    <span></span>
                    <span></span>
                    <span></span>
                  </output>
                  <span>{t('chat.progress.connecting')}</span>
                </div>
              )}
              {chat.streamingProgress?.type === 'receiving' && (
                <div className="streaming-content">
                  <div className="streaming-text">
                    <span className="thinking">{t('chat.progress.thinking')}</span>
                    {chat.streamingContent && (
                      <>
                        <br />
                        <span className="streaming-preview">{chat.streamingContent}</span>
                      </>
                    )}
                    <span className="streaming-cursor">▌</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-cancel-stream"
                    onClick={chat.cancelStreaming}
                    title={t('chat.actions.cancelStream')}
                  >
                    {t('chat.actions.cancel')}
                  </button>
                </div>
              )}
              {chat.streamingProgress?.type === 'processing' && (
                <div className="streaming-status">
                  <output className="loading-spinner" aria-label="Processing">
                    <span></span>
                    <span></span>
                    <span></span>
                  </output>
                  <span>{t('chat.progress.processing')}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {chat.isInterpreting && (
          <div className="chat-message ai">
            <div className="message-content">
              <output className="loading-spinner" aria-label="Interpreting">
                <span></span>
                <span></span>
                <span></span>
              </output>
              <p>{t('chat.progress.interpreting')}</p>
            </div>
          </div>
        )}

        {chat.isExecuting && (
          <div className="chat-message ai">
            <div className="message-content">
              <div className="progress-indicator">
                <div
                  className="progress-bar"
                  role="progressbar"
                  aria-valuenow={chat.executionProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Command execution progress"
                >
                  <div
                    className="progress-fill"
                    style={{ width: `${chat.executionProgress}%` }}
                  ></div>
                </div>
                <p className="progress-text">
                  {chat.executionProgress < 30 && t('chat.progress.initializing')}
                  {chat.executionProgress >= 30 &&
                    chat.executionProgress < 70 &&
                    t('chat.progress.executing')}
                  {chat.executionProgress >= 70 &&
                    chat.executionProgress < 90 &&
                    t('chat.progress.retrieving')}
                  {chat.executionProgress >= 90 && t('chat.progress.finalizing')}
                </p>
              </div>
            </div>
          </div>
        )}

        {chat.error && (
          <div className="chat-message ai error">
            <div className="message-content">{chat.error}</div>
          </div>
        )}
      </div>

      {chat.aiCommand && chat.aiCommand.type === 'command' && (
        <div className="command-actions">
          <button
            type="button"
            className="btn btn-execute"
            disabled={!chat.terminalPid}
            onClick={handleExecuteCommand}
            title={
              !chat.terminalPid
                ? t('chat.actions.terminalNotReady')
                : `${t('chat.actions.executeCommand')} (Ctrl+Enter)`
            }
          >
            {!chat.terminalPid ? t('chat.actions.preparing') : t('chat.actions.execute')}
          </button>
          <button
            type="button"
            className="btn btn-modify"
            onClick={chat.modifyCommand}
            title={t('chat.actions.modifyCommand')}
          >
            {t('chat.actions.modify')}
          </button>
          <button
            type="button"
            className="btn btn-cancel"
            onClick={() => setAiCommand(null)}
            title={`${t('chat.actions.cancelCommand')} (Esc)`}
          >
            {t('chat.actions.cancel')}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="chat-input">
        <textarea
          value={chat.userInput}
          onChange={chat.handleInputChange}
          onKeyDown={handleTextareaKeyDown}
          placeholder={t('chat.placeholder')}
          disabled={chat.isLoading}
          // biome-ignore lint/a11y/noAutofocus: Intentional auto-focus for chat input UX
          autoFocus
          ref={inputRef}
          rows={1}
        />
        <button
          type="submit"
          disabled={chat.isLoading || !chat.userInput.trim() || chat.aiCommand?.type === 'command'}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <title>{t('chat.send')}</title>
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>

      {/* Command warning modal */}
      {pendingValidation && (
        <CommandWarningModal
          command={pendingValidation.command}
          validation={pendingValidation.validation}
          onConfirm={handleConfirmWarning}
          onCancel={handleCancelWarning}
          isVisible={!!pendingValidation}
        />
      )}
    </div>
  )
}
