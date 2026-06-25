---
name: run-build
description: Run TypeScript build
disable-model-invocation: false
title: "Run Build"
tags: [build, typescript, compilation]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Run Build

Build the project using TypeScript compilation.

## Command

```bash
npm run build

```text
This runs `tsc` to compile the TypeScript source code.

## On Failure

Analyze the TypeScript compiler output:

1. List each compilation error with file path, line number, and error message.
2. Explain the issue clearly.
3. Suggest a fix for each error.

## Important

- If in a feature worktree, run from that worktree root.
