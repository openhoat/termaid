---
title: "Project Structure Conventions"
description: "Standard conventions for project directory organization, file naming, and separation of concerns."
tags: [project-structure, conventions, architecture, organization]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Project Structure Conventions

### Directory Organization

- Group by **domain** or **feature**, not by technical role (prefer `features/checkout/` over `controllers/`, `services/`, `repos/`).
- Keep a flat `src/` or `lib/` root — no more than 2-3 levels deep.
- Place shared utilities in `src/shared/`, `src/lib/`, or `src/utils/`.
- Place configuration in `config/` at the project root.

### File Naming

- Use **kebab-case** for file names: `user-service.ts`, `checkout-page.tsx`.
- One concept per file — avoid god files.
- Test files mirror source: `src/user-service.ts` → `src/user-service.test.ts`.
- Suffix by role: `.service.ts`, `.controller.ts`, `.hook.ts`, `.test.ts`, `.spec.ts`.

### Module Boundaries

- A module exposes a single public API through an `index.ts` barrel file.
- Internal implementation files are prefixed with `_` or placed in an `internal/` subfolder.

### Configuration Files

- Keep config at project root: `tsconfig.json`, `package.json`, `.env`, `.gitignore`, CI configs.
- Group related config in dedicated files (e.g., `jest.config.cjs`, `biome.json`).

### What This Rule Is Not

This is a **generic baseline** — the project's own conventions always take precedence. Adapt to the framework's conventions when applicable (Next.js pages router, NestJS modules, etc.).
