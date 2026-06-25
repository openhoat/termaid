---
name: analyze-quality-report
description: Analyze Biome linting and formatting output
disable-model-invocation: false
title: "Analyze Quality Report"
tags: [quality, biome, linting, analysis]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Analyze Quality Report

Analyze the output of Biome (linting and formatting) for the project.

## Command

```bash
npm run qa 2>&1

```text

## Analysis

When analyzing Biome output:

1. **Categorize issues** by type:
   - Formatting issues (spacing, indentation, line length)
   - Lint errors (unused variables, missing types, etc.)
   - Code style violations

1. **Prioritize** by severity:
   - Errors (must fix)
   - Warnings (should fix)
   - Info (nice to fix)

1. **Suggest fixes**:
   - For auto-fixable issues: `npm run qa:fix`
   - For manual fixes: provide specific code changes

1. **Summary**: Provide a count of issues by category and an overall health assessment.

## Important

- The project uses Biome for linting and formatting.
- Auto-fix command: `npm run qa:fix`.
- Run from the project root or feature worktree root.
