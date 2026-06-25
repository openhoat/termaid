---
title: "Code Intelligence"
description: "Defines best practices for code navigation using LSP features for efficient code analysis and refactoring"
tags: [lsp, navigation, typescript, tooling]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Code Intelligence

## Objective

This rule defines best practices for code navigation using LSP (Language Server Protocol) features, ensuring efficient and accurate code analysis and refactoring.

## LSP Tools Preference

Prefer LSP over Grep/Glob/Read for code navigation:

- `goToDefinition` / `goToImplementation` to jump to source
- `findReferences` to see all usages across the codebase
- `workspaceSymbol` to find where something is defined
- `documentSymbol` to list all symbols in a file
- `hover` for type info without reading the file
- `incomingCalls` / `outgoingCalls` for call hierarchy

## When to Use LSP vs Grep/Glob

### Use LSP for

- Finding definitions and implementations
- Finding references and usages
- Understanding type information
- Call hierarchy analysis
- Symbol navigation

### Use Grep/Glob only for

- Text/pattern searches in comments
- String searches
- Config value searches
- Any search where LSP doesn't help

## Best Practices

### Before Refactoring

Before renaming or changing a function signature, use `findReferences` to find all call sites first.

### After Code Changes

After writing or editing code, check LSP diagnostics before moving on. Fix any type errors or missing imports immediately.

## Workflow Integration

1. **Navigation**: Use LSP features to navigate the codebase efficiently
2. **Refactoring**: Find all references before making changes
3. **Validation**: Check diagnostics after modifications
4. **Efficiency**: Avoid reading entire files when LSP can provide targeted information
