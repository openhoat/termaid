---
title: "Debug Skill"
description: "Systematic debugging approach: reproduce, isolate, fix, verify — independent of technology stack."
name: debug
tags: [debug, troubleshooting, debugging, skill]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
disable-model-invocation: false
---

## Debug Skill

### Workflow

#### 1. Reproduce

- Get the exact steps, input data, and environment to reproduce the issue.
- Confirm the bug exists on `main` or the current branch.
- Note whether it's deterministic or intermittent.

#### 2. Isolate

- Use a binary search strategy: comment out half the code, check if the issue persists.
- Check inputs first (bad data), then logic (wrong algorithm), then outputs (display/formatting).
- Add targeted logging or use a debugger to narrow down the root cause.
- For intermittent issues, look for race conditions, unhandled async, or timing dependencies.

#### 3. Understand the Root Cause

- Once isolated, explain **why** it happens — not just **where**.
- Check if this is a single-point failure or a systemic pattern.

#### 4. Fix

- Write a **failing test** that reproduces the bug first (if applicable).
- Apply the minimal fix — change only what's needed to resolve the root cause.
- Verify no existing tests break.

#### 5. Verify

- Run the reproducing test and confirm it passes.
- Run the full test suite to check for regressions.
- If possible, deploy to a staging environment and test end-to-end.
- Document the root cause and fix for future reference.

### General Principles

- **One change at a time** — change one thing, test, move on.
- **Read the error message** — it often tells you exactly what's wrong and where.
- **Check recent changes** — if the bug is new, the last change is the prime suspect.
