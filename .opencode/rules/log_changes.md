---
title: "Log Changes"
description: "Ensures all project changes are tracked in CHANGELOG.md"
tags: [changelog, git, documentation]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Log Changes

## Objective

Ensures all project changes are tracked in `/CHANGELOG.md`.

## CHANGELOG.md Generation

**IMPORTANT**: `CHANGELOG.md` is **ALWAYS auto-generated** using `npm run changelog`. It is **NEVER edited manually** by Cline.

## When to regenerate

The `CHANGELOG.md` is regenerated **ONLY** on the `main` branch during the post-merge cleanup phase (`/cleanup-worktree`).

**Workflow:**

1. **Feature branches**: Do NOT generate or modify `CHANGELOG.md`
2. **After PR merge**: On `main`, run `npm run changelog` to regenerate from git history
3. **Commit to main**: Include the regenerated `CHANGELOG.md` in the maintenance commit

## Commands

```bash

# Regenerate CHANGELOG.md from git commit history
npm run changelog

# Commit the updated changelog
git add CHANGELOG.md
git commit -m "chore(release): update kanban and changelog post-merge"

```text

## Format

See `rules/task_format.md` for complete tag/emoji definitions.

The changelog generator automatically creates entries with format:
`**[HH:MM:SS] Emoji [TAG]** Description`

Common tags: `✨ [FEAT]`, `🐛 [FIX]`, `♻️ [REFACTOR]`, `⚡ [PERF]`, `📝 [DOCS]`, `🎨 [STYLE]`, `✅ [TEST]`, `🔧 [CHORE]`

## Important Rules

- **DO NOT manually edit CHANGELOG.md** - always use `npm run changelog`
- **Only regenerate on main branch** after PR merge
- **Never generate in feature branches**
- The changelog is derived from git commit messages, so use proper Conventional Commits format
