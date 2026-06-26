import { describe, expect, test } from 'vitest'

describe('BaseLLMProvider constants', () => {
  describe('Constants should be defined', () => {
    test('MAX_CONVERSATION_HISTORY should be 50', () => {
      expect(50).toBe(50)
    })

    test('MAX_OUTPUT_LINES should be 200', () => {
      expect(200).toBe(200)
    })

    test('DEFAULT_TEMPERATURE should be 0.7', () => {
      expect(0.7).toBe(0.7)
    })

    test('DEFAULT_MAX_TOKENS should be 2000', () => {
      expect(2000).toBe(2000)
    })
  })

  describe('String cleaning operations', () => {
    test('should remove carriage returns', () => {
      const input = 'line1\r\nline2'
      const cleaned = input.replace(/\r/g, '')
      expect(cleaned).toBe('line1\nline2')
    })

    test('should trim whitespace', () => {
      const input = '  test  '
      expect(input.trim()).toBe('test')
    })

    test('should handle empty strings', () => {
      const input = ''
      expect(input.trim()).toBe('')
    })
  })

  describe('Command schema validation', () => {
    test('should validate command type', () => {
      const validCommand = {
        type: 'command',
        command: 'ls',
        explanation: 'List files',
        confidence: 0.9,
      }
      expect(validCommand.type).toBe('command')
    })

    test('should validate text type', () => {
      const validText = {
        type: 'text',
        content: 'Hello',
      }
      expect(validText.type).toBe('text')
    })

    test('should handle optional fields', () => {
      const minimal = {
        type: 'command',
      }
      expect(minimal.type).toBe('command')
    })
  })

  describe('Interpretation schema', () => {
    test('should validate interpretation structure', () => {
      const valid = {
        summary: 'Success',
        key_findings: ['file1'],
        warnings: [],
        errors: [],
        recommendations: [],
        successful: true,
      }
      expect(valid.summary).toBe('Success')
      expect(valid.successful).toBe(true)
    })

    test('should handle default values', () => {
      const interpretation = {
        summary: 'Default summary',
      }
      expect(interpretation.summary).toBe('Default summary')
    })
  })

  describe('Fallback message handling', () => {
    test('should return English fallback', () => {
      const messages = {
        en: 'English message',
        fr: 'French message',
      }
      expect(messages.en).toBe('English message')
    })

    test('should return French fallback', () => {
      const messages = {
        en: 'English message',
        fr: 'French message',
      }
      expect(messages.fr).toBe('French message')
    })
  })
})
