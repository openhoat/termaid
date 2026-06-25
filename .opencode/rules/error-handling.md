---
title: "Error Handling Principles"
description: "Generic error handling principles: typed errors, error boundaries, contextual logging, and recovery patterns."
tags: [error-handling, errors, robustness, logging]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Error Handling Principles

### Typed Errors

- Use **typed/custom error classes** instead of generic `Error` or string messages.
- Include a machine-readable `code` and a human-readable `message`.
- Preserve the original cause via a `cause` property.

### Error Boundaries

- Define clear boundaries between modules/systems.
- Catch errors at boundary edges (HTTP handlers, event consumers, job workers).
- Translate internal errors into a consistent external format at the boundary.

### Contextual Logging

- Always log errors with **surrounding context** (operation, input, correlation ID).
- Log at the closest catch point, not at every intermediate re-throw.

### Recovery Patterns

| Pattern | When to Use |
| ------- | ----------- |
| Retry | Transient failures (network timeouts, DB deadlocks) |
| Fallback | Non-critical features that can degrade gracefully |
| Circuit breaker | Repeated failures on the same dependency |
| Fail fast | Invalid inputs, preconditions, or configuration errors |

### What Not to Do

- Never catch an error just to log and re-throw without adding context.
- Never use exceptions for control flow.
- Never expose stack traces or internal details to end users.
