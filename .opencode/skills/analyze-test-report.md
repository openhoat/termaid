---
name: analyze-test-report
description: Analyze test results
disable-model-invocation: false
title: "Analyze Test Report"
tags: [testing, analysis]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Analyze Test Report

Analyze the output of test runs for the project.

## Command

```bash
npm run test 2>&1

```text

## Analysis

When analyzing test output:

1. **Summary**: Total tests, passed, failed, skipped.

1. **Failing tests**: For each failure:
   - Test file and test name
   - Error message and stack trace
   - Expected vs actual values
   - Root cause analysis
   - Suggested fix

1. **Slow tests**: Identify tests that take unusually long and suggest optimization.

1. **Patterns**: Look for patterns in failures (e.g., all tests in one module failing, common assertion errors).

## Important

- Tests use the `node` environment (not Happy DOM or jsdom).
- Test framework: the project's configured test runner.
- Run from the project root or feature worktree root.
