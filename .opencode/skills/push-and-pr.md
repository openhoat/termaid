---
name: push-and-pr
description: Push branch and create a pull request
disable-model-invocation: false
title: "Push and Create PR"
tags: [git, push, pull-request, github]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Push and Create PR

Push the current branch to the remote and create a pull request using GitHub CLI.

## Steps

### 1. Push Branch

```bash
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"

```text

### 2. Create Pull Request

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'

## Summary

- Description of changes

## Test plan

- [ ] Validation passes (`npm run validate`)
- [ ] Tests pass (`npm run test`)

EOF
)"

```text

## Guidelines

- Infer the PR title from the branch name and recent commit messages.
- Write a clear summary of the changes in the PR body.
- Include a test plan checklist.
- If the branch is already pushed and up-to-date, skip the push step.

## Important

- The main worktree is the project root (main branch).
- Feature worktrees are at `../<project-name>-<name>` relative to main.
- Use `gh` CLI for PR creation - ensure it is available.
