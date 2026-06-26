import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessageData } from '@/components/chat'
import { useChatResetKey } from '@/store/useStore'

export interface UseConversationStateResult {
  // State
  conversation: ChatMessageData[]
  messageCounter: number
  messageCounterRef: React.MutableRefObject<number>
  currentCommandIndex: number | null
  persistedCommandIndex: number | null

  // Actions
  addMessage: (message: ChatMessageData) => void
  updateMessage: (index: number, updates: Partial<ChatMessageData>) => void
  restoreMessages: (messages: ChatMessageData[]) => void
  clearConversation: () => void
  setCurrentCommandIndex: (index: number | null) => void
  setPersistedCommandIndex: (index: number | null) => void
}

/**
 * Custom hook for managing local conversation state
 * Handles messages, counter, and command indices
 * Auto-resets when chatResetKey changes
 */
export function useConversationState(): UseConversationStateResult {
  const [conversation, setConversation] = useState<ChatMessageData[]>([])
  const [messageCounter, setMessageCounter] = useState(0)
  const messageCounterRef = useRef(0)
  const [currentCommandIndex, setCurrentCommandIndex] = useState<number | null>(null)
  const [persistedCommandIndex, setPersistedCommandIndex] = useState<number | null>(null)

  // Keep ref in sync with state
  messageCounterRef.current = messageCounter

  const chatResetKey = useChatResetKey()
  const prevResetKeyRef = useRef(chatResetKey)

  // Reset conversation when chatResetKey changes
  useEffect(() => {
    if (prevResetKeyRef.current !== chatResetKey) {
      setConversation([])
      setMessageCounter(0)
      setCurrentCommandIndex(null)
      setPersistedCommandIndex(null)
      prevResetKeyRef.current = chatResetKey
    }
  }, [chatResetKey])

  /**
   * Add a new message to the conversation
   */
  const addMessage = useCallback((message: ChatMessageData) => {
    setConversation(prev => [...prev, message])
    setMessageCounter(prev => prev + 1)
  }, [])

  /**
   * Update an existing message by index
   */
  const updateMessage = useCallback((index: number, updates: Partial<ChatMessageData>) => {
    setConversation(prev => prev.map((msg, i) => (i === index ? { ...msg, ...updates } : msg)))
  }, [])

  /**
   * Restore messages (for loading saved conversations)
   */
  const restoreMessages = useCallback((messages: ChatMessageData[]) => {
    setConversation(messages)
    setMessageCounter(messages.length)
  }, [])

  /**
   * Clear all conversation state
   */
  const clearConversation = useCallback(() => {
    setConversation([])
    setMessageCounter(0)
    setCurrentCommandIndex(null)
    setPersistedCommandIndex(null)
  }, [])

  return {
    conversation,
    messageCounter,
    messageCounterRef,
    currentCommandIndex,
    persistedCommandIndex,
    addMessage,
    updateMessage,
    restoreMessages,
    clearConversation,
    setCurrentCommandIndex,
    setPersistedCommandIndex,
  }
}
