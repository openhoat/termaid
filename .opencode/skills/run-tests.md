---
name: run-tests
description: Run unit tests with the project's test framework
disable-model-invocation: false
title: "Run Tests"
tags: [testing, unit-tests]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Run Tests

Run the project unit tests.

## Commands

### Run all tests

```bash
npm run test

```text

### Run tests with coverage

```bash
npm run test:coverage

```text

### Run a specific test file

```bash
npx <test-runner> run <path-to-test-file>

```text

## Analysis

When tests fail:

1. Report each failing test with its full name and location.
2. Show the expected vs actual values.
3. Identify the root cause (code bug, outdated test, missing mock, etc.).
4. Suggest a concrete fix.

## Important

- Tests use the `node` environment by default.
- If in a feature worktree, run from that worktree root.
