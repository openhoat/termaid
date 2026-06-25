---
name: complete-task
description: Complete current task in feature worktree
disable-model-invocation: false
title: "Complete Task"
tags: [task, completion, pr, git]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Complete Task

Finalize and submit the current task from a feature worktree.

## Prerequisites

- Must be in a feature worktree (e.g., `../<project-name>-<feature>` relative to main).
- **Error if on `main` branch** - this skill is only for feature branches.

## Steps

### 1. Verify Branch

```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" = "main" ]; then
  echo "ERROR: Cannot complete task from main branch. Switch to a feature worktree."
  exit 1
fi

```text

### 2. Run Validation

```bash
npm run validate

```text
Fix any issues that arise. All checks must pass before proceeding.

### 3. Stage and Commit

```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" =~ ^feat/ ]]; then TYPE="feat"
elif [[ "$BRANCH" =~ ^fix/ ]]; then TYPE="fix"
elif [[ "$BRANCH" =~ ^refactor/ ]]; then TYPE="refactor"
elif [[ "$BRANCH" =~ ^chore/ ]]; then TYPE="chore"
elif [[ "$BRANCH" =~ ^docs/ ]]; then TYPE="docs"
elif [[ "$BRANCH" =~ ^test/ ]]; then TYPE="test"
elif [[ "$BRANCH" =~ ^perf/ ]]; then TYPE="perf"
else TYPE="chore"
fi
git add <relevant-files>
git commit -m "${TYPE}: description of completed work"

```text
Use conventional commit types (feat, fix, refactor, docs, test, chore, perf) derived from the branch prefix.

### 4. Push

```bash
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"

```text

### 5. Create Pull Request

```bash
gh pr create --title "feat: task title" --body "$(cat <<'EOF'

## Summary

- Description of changes

## Test plan

- [ ] Validation passes
- [ ] Tests pass

EOF
)"

```text

## Important

- The main worktree is the project root (main branch).
- Feature worktrees are at `../<project-name>-<feature>` relative to main.
- Always validate before committing.
- Never run this on the `main` branch.
- **After PR merge**: Switch to main and run `/cleanup-worktree <name>` to update KANBAN, regenerate changelog, and remove the worktree.
