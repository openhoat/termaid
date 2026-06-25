---
title: "Testing Rules"
description: "Defines coding standards for writing tests in the project"
tags: [testing, typescript]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Testing Rules

## Objective

Defines coding standards for writing tests in the project.

## Test Framework

The project's test runner is used to execute tests.

## Test Writing Standards

### Use `test` instead of `it`

**ALWAYS use `test` instead of `it` when defining test cases.**

**Correct:**

```typescript
import { describe, expect, test } from 'vitest'

describe('MyModule', () => {
  test('should work correctly', () => {
    // test code
  })
})

```text
**Incorrect:**

```typescript
import { describe, expect, it } from 'vitest'

describe('MyModule', () => {
  it('should work correctly', () => {
    // test code
  })
})

```text

### Test File Naming

- Test files must end with `.test.ts` or `.test.tsx`
- Place test files next to the source files they test
- Example: `src/services/styleAnalyzer.ts` -> `src/services/styleAnalyzer.test.ts`

### Test Structure

```typescript
// 1. Imports first (test utilities, then source)
import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest'
import { MyModule } from './MyModule'

// 2. Mocks (if needed)
const mockFunction = vi.fn()

// 3. describe block
describe('MyModule', () => {
  // 4. Setup/teardown
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // 5. Test cases using `test`
  test('should do something', () => {
    // test code
  })
})

```text

### Test Descriptions

- Test descriptions must start with a verb in present tense
- Use clear, descriptive names
- Example: `'should analyze document style'`, `'should inject system prompt'`

## Import Order for Test Files

1. Test framework imports (`describe`, `expect`, `test`, etc., from the test runner)
2. Source file imports
3. Mocks and test utilities

## Usage

This rule applies to:

- All new test files created
- All existing test files (refactor to use `test` instead of `it`)
- Test files in `src/**/*.test.{ts,tsx}`
