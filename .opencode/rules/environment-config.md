---
title: "Environment Configuration"
description: "Conventions for environment variables: scope separation, runtime validation, secrets management, and .env.example maintenance."
tags: [environment, configuration, env, secrets, dotenv]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Environment Configuration

### Variable Naming

- Use **UPPER_SNAKE_CASE** for all environment variables.
- Prefix with the project or module name: `MYAPP_DB_HOST`, `MYAPP_AUTH_SECRET`.
- Group related vars with a common prefix.

### Scope Separation

| Scope | File | Purpose |
| ----- | ---- | ------- |
| Local dev | `.env` | Not committed, developer-specific overrides |
| Example | `.env.example` | Committed, documented template |
| CI | CI secrets UI | Set per pipeline |
| Production | Infra secrets store | Vault, AWS Secrets Manager, etc. |

### Runtime Validation

- Validate all required vars **at startup**, not lazily.
- Use a validation library (Zod, Joi, etc.) or a lightweight schema.
- Fail fast with a clear message listing all missing/invalid vars.

### Secrets

- Never commit `.env` files.
- Never log secret values (redact in logs, error messages, and stack traces).
- Use `.env.local` for machine-specific overrides (added to `.gitignore`).
- Rotate secrets regularly — use short-lived credentials when possible.

### .env.example

- Keep it in sync with the actual `.env` — automated test to verify.
- Include all variables with a comment describing each one.
- Mark optional vars with a default value or an `(optional)` comment.
