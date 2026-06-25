---
name: workflow-commit
description: Complete commit workflow with validation, changelog, and kanban update
disable-model-invocation: false
title: "Workflow Commit"
tags: [commit, workflow, validation, git]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Workflow Commit

Complete commit workflow: validate, commit, update changelog, and update kanban. Must be run from a feature worktree.

## Prerequisites

- Must be in a feature worktree (e.g., `../<project-name>-<feature>` relative to main).
- Must NOT be on `main` branch.

## Steps

### 1. Validate

```bash
npm run validate

```text
All checks must pass before proceeding. Fix any issues.

### 2. Commit Changes

```bash
git add <relevant-files>
git commit -m "<conventional-commit-message>"

```text
Use conventional commit format (feat, fix, refactor, docs, chore, etc.).

### 3. Update Changelog

> **Note**: CHANGELOG.md is only regenerated on the `main` branch after PR merge
> (see `rules/log_changes.md`). **Skip this step in feature worktrees.**

### 4. Update KANBAN

If the task status needs updating, modify `KANBAN.md` on the main worktree:

- Update task progress notes if applicable.

## Important

- The main worktree is the project root (main branch).
- Feature worktrees are at `../<project-name>-<feature>` relative to main.
- Always validate before committing.
- Use conventional commit messages.
