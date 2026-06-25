---
name: run-validation
description: Run full project validation (QA, typecheck, tests)
disable-model-invocation: false
title: "Run Validation"
tags: [validation, qa, typescript, tests]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Run Validation

Run the full validation pipeline for the project.

## Command

```bash
npm run validate

```text
This runs the following checks in sequence:

1. **QA** - Biome linting and formatting checks
2. **Typecheck** - TypeScript type checking with `tsc --noEmit`
3. **Test** - Unit tests

## On Failure

Analyze the output carefully and identify which step failed:

- **QA failures**: Suggest running `npm run qa:fix` to auto-fix linting and formatting issues. Report any remaining issues that cannot be auto-fixed.
- **Typecheck failures**: List each type error with file, line, and a clear explanation of the issue and how to fix it.
- **Test failures**: List each failing test with the test name, expected vs actual values, and suggest fixes.

## Important

- Always run validation from the project root (or the current worktree path).
- If in a feature worktree, run from that worktree root.
