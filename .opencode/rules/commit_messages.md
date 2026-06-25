---
title: "Git Commit Messages"
description: "Ensures that all Git commit messages are written in English following the Conventional Commits format"
tags: [git, commits, conventional-commits, english]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Git Commit Messages

## Objective

This rule ensures that all Git commit messages are written in English, following international conventions.

## Format Rules

Commit messages must follow the Conventional Commits format in English:

```text
<type>(<scope>): <subject>

<body>

<footer>

```text

### Commit Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Styling/formatting (code style changes without functional changes)
- `refactor`: Refactoring
- `perf`: Performance improvement
- `test`: Tests
- `chore`: Maintenance/Configuration
- `revert`: Revert commit

### Writing Rules

1. **Always use English** for commit messages
2. Use imperative verb (e.g., "Add" not "Added" or "Adds")
3. Start with a capital letter
4. Do not end with a period
5. Limit subject line to 72 characters

### Co-authored-by Prohibition

**NEVER add `Co-authored-by:` to commit messages.**

All commits must be attributed exclusively to the human user. Do not attempt to add AI-generated co-authorship metadata under any circumstances.

**Prohibited (never do this):**

```text
feat: add user authentication system

Co-authored-by: AI <ai@anthropic.com>

```text
**Correct (only the commit message):**

```text
feat: add user authentication system

```text
This rule applies to all Git commit operations, including:

- `git commit`
- `git commit --amend`

### Examples

**Good examples:**

```text
feat: add user authentication system
fix: resolve connection error in API handler
docs: update README with installation instructions
style: format code according to Biome rules
refactor: simplify state management logic
perf: optimize database queries
test: add unit tests for chat service
chore: upgrade dependencies to latest versions

```text
**Bad examples (to avoid):**

```text
feat: ajouter le système d'authentification  (French)
fix: corriger l'erreur de connexion  (French)
feat: Added user authentication system  (not imperative)
fix: resolve connection error in API handler.  (period at end)

```text

## When to Write a Commit Message

Cline should write a commit message in English when executing Git commands such as:

- `git commit`
- `git commit --amend`

## Integration with commitlint

The `commitlint.config.mjs` file configures validation rules to ensure messages follow the Conventional Commits format. These rules are in English and must be followed.
