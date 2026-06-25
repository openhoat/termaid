---
title: "Structured Logging"
description: "Structured logging principles: log levels, output format, contextual data, PII protection, and secrets scrubbing."
tags: [logging, observability, structured-logging, best-practices]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Structured Logging

### Log Levels

| Level | When to Use |
| ----- | ----------- |
| `ERROR` | Unhandled or unexpected errors requiring immediate attention |
| `WARN` | Recoverable issues, deprecated usage, degraded behavior |
| `INFO` | Key lifecycle events: startup, shutdown, successful operations |
| `DEBUG` | Detailed diagnostic information (disabled in production) |
| `TRACE` | Very fine-grained flow tracking (disabled by default everywhere) |

### Output Format

- Emit logs as **structured JSON** (one object per line) in production.
- Each log entry must include: `timestamp`, `level`, `message`, `context`.
- Use a consistent schema across the entire project.

### Contextual Data

Always attach relevant context:

```json
{
  "timestamp": "2025-06-25T12:00:00.000Z",
  "level": "ERROR",
  "message": "Failed to process payment",
  "context": {
    "correlationId": "abc-123",
    "operation": "checkout.pay",
    "userId": "usr_456",
    "amount": 4999
  }
}
```

### What NOT to Log

- **Secrets**: passwords, tokens, API keys, database credentials
- **PII**: email addresses, phone numbers, full names (log a hashed or masked reference)
- **Raw request bodies** in production (enable only for debugging and redact sensitive fields)
- **Stack traces** that contain secrets or PII in variable values

### Tooling

Use a logging library (Pino, Winston, structlog, etc.) — never `console.log` in production code.
