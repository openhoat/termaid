---
name: start-task
description: Start a task from backlog with full lifecycle management
disable-model-invocation: false
title: "Start Task"
tags: [task, kanban, worktree, git]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Start Task

Full task lifecycle: select a task from the backlog, set up a feature worktree, implement, validate, and prepare for PR.

## Steps

### 1. Select Task from Backlog

- Read `./KANBAN.md`.
- Display the Backlog section and let the user select a task (or accept a task name as argument).
- Move the selected task from **Backlog** to **In Progress** in KANBAN.md (local change only, not committed).

### 2. Create Feature Branch and Worktree

```bash
git checkout main
git pull
BRANCH_NAME="feat/<task-slug>"
git branch "$BRANCH_NAME"
git worktree add ../<project-name>-<task-slug> "$BRANCH_NAME"

```text

### 3. Copy Local Files

Copy local files listed in `.worktree-sync` from the main worktree to the new worktree:

```bash
if [ -f ".worktree-sync" ]; then
  while IFS= read -r file; do
    [[ "$file" =~ ^#.*$ ]] && continue
    [[ -z "$file" ]] && continue
    if [ -f "$file" ]; then
      mkdir -p "../<project-name>-<task-slug>/$(dirname "$file")"
      cp "$file" "../<project-name>-<task-slug>/$file"
    fi
  done < .worktree-sync
fi

```text

### 4. Implement

- Switch to the worktree: `../<project-name>-<task-slug>`
- Implement the task changes.

### 5. Validate

```bash
cd ../<project-name>-<task-slug> && npm run validate

```text
Fix any issues found during validation.

### 6. Commit and Push

```bash
cd ../<project-name>-<task-slug>
git add <relevant-files>
git commit -m "feat: description of the task"
git push -u origin "$BRANCH_NAME"

```text

### 7. Create Pull Request

```bash
cd ../<project-name>-<task-slug>
gh pr create --title "feat: task title" --body "Description of changes"

```text

## Important

- The main worktree is the project root (main branch).
- Feature worktrees go to `../<project-name>-<task-slug>` relative to main.
- KANBAN.md is updated locally but NOT committed at task start - it will be committed during cleanup after PR merge.
- Run `npm install` in the new worktree if needed.
