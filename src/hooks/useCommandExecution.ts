import type { CommandInterpretation } from '@shared/types'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/hooks/useToast'
import { CommandTimer } from '@/services/statsService'
import { useConfig, useTerminalPid } from '@/store/useStore'
import { Logger } from '@/utils/logger'

const logger = new Logger('useCommandExecution')

export interface UseCommandExecutionOptions {
  onExecutionStart?: () => void
  onExecutionComplete?: (command: string, output: string) => void
  onExecutionError?: (error: Error) => void
  onInterpretationError?: (error: Error) => void
}

export interface UseCommandExecutionResult {
  // State
  isExecuting: boolean
  isInterpreting: boolean
  executionProgress: number

  // Actions
  executeCommand: (command: string) => Promise<string>
  executeWithInterpretation: (
    command: string,
    messageIndex: number,
    persistedCommandIndex: number | null,
    onInterpretation: (output: string, interpretation: CommandInterpretation) => void
  ) => Promise<void>
}

/**
 * Custom hook for executing commands in the terminal
 * Handles terminal readiness, output capture, and error handling
 */
export function useCommandExecution(
  options: UseCommandExecutionOptions = {}
): UseCommandExecutionResult {
  const { i18n } = useTranslation()
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionProgress, setExecutionProgress] = useState(0)
  const [isInterpreting, setIsInterpreting] = useState(false)

  const config = useConfig()
  const terminalPid = useTerminalPid()
  const { addToast } = useToast()

  /**
   * Execute a command in the terminal and return its output
   * @param command - The command to execute
   * @returns The command output
   */
  const executeCommand = useCallback(
    async (command: string): Promise<string> => {
      logger.debug('executeCommand called with:', command)
      logger.debug('Current terminalPid:', terminalPid)

      setIsExecuting(true)
      setExecutionProgress(10)
      options.onExecutionStart?.()

      const timer = CommandTimer.start()

      try {
        // Wait for terminal to be ready with retry mechanism
        const maxRetries = 20 // 10 seconds total (20 * 500ms)
        let retries = 0
        let currentPid = terminalPid

        while (!currentPid && retries < maxRetries) {
          logger.debug(`Waiting for terminal... (${retries + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, 500))
          retries++
          // Re-check terminal PID (it might have been set during the wait)
          currentPid = terminalPid
        }

        setExecutionProgress(30)

        if (!currentPid) {
          logger.error('Terminal not ready after retries')
          const errorMessage = i18n.t('errors.terminalNotReady')
          throw new Error(errorMessage)
        }

        logger.info('Terminal is ready, PID:', currentPid)

        // Start capturing output
        await window.electronAPI.terminalStartCapture(currentPid)
        setExecutionProgress(50)

        // Execute command in terminal
        logger.debug('Writing command to terminal:', command)
        await window.electronAPI.terminalWrite(currentPid, `${command}\r`)
        logger.info('Command written successfully')

        setExecutionProgress(70)

        // Wait for command completion using server-side prompt detection
        const result = await window.electronAPI.terminalWaitForPrompt(currentPid)
        const output = result.output

        if (result.detected) {
          logger.debug('Prompt detected, command finished')
        } else {
          logger.warn('Prompt not detected within timeout, proceeding anyway')
        }

        setExecutionProgress(90)

        timer.end(config, command, true)
        options.onExecutionComplete?.(command, output)

        return output
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        timer.end(config, command, false, err.message)
        logger.error('Command execution error:', err)

        addToast('error', err.message)
        options.onExecutionError?.(err)

        throw err
      } finally {
        setIsExecuting(false)
        setExecutionProgress(0)
      }
    },
    [config, terminalPid, i18n, addToast, options]
  )

  /**
   * Execute command with AI interpretation of output
   * @param command - The command to execute
   * @param messageIndex - Index in conversation to update
   * @param persistedCommandIndex - Index in stored conversation to update
   * @param onInterpretation - Callback with output and interpretation
   */
  const executeWithInterpretation = useCallback(
    async (
      command: string,
      _messageIndex: number,
      _persistedCommandIndex: number | null,
      onInterpretation: (output: string, interpretation: CommandInterpretation) => void
    ): Promise<void> => {
      const output = await executeCommand(command)

      // Always interpret output, even if empty
      // Many successful commands (mkdir, touch, cp) produce no output
      try {
        setIsInterpreting(true)
        setExecutionProgress(95)

        const interpretation = await window.electronAPI.llmInterpretOutput(
          output,
          i18n.language,
          command
        )

        logger.info('AI interpretation received:', JSON.stringify(interpretation).substring(0, 200))

        // Callback to update conversation
        onInterpretation(output, interpretation)

        setExecutionProgress(100)
      } catch (error) {
        logger.error('Output interpretation error:', error)
        options.onInterpretationError?.(error instanceof Error ? error : new Error(String(error)))
      } finally {
        setIsInterpreting(false)
        setExecutionProgress(0)
      }
    },
    [executeCommand, i18n, options.onInterpretationError]
  )

  return {
    isExecuting: isExecuting || isInterpreting,
    isInterpreting,
    executionProgress,
    executeCommand,
    executeWithInterpretation,
  }
}
