---
name: generate-changelog
description: Regenerate the CHANGELOG.md file
disable-model-invocation: false
title: "Generate Changelog"
tags: [changelog, git, generation]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Generate Changelog

Regenerate the CHANGELOG.md file for the project.

## Command

```bash
npm run changelog

```text
This regenerates `CHANGELOG.md` based on the git commit history using conventional commits.

## Post-Generation

After generating, review the output:

1. Verify the changelog entries are correct.
2. Check that the formatting is consistent.
3. The file is at `CHANGELOG.md` in the project root.

## Important

- Run from the main worktree (main branch).
- This should typically be run on the `main` branch after merges.
