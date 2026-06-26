# Kanban Board

<!-- Format definitions: See .claude/rules/task_format.md -->

## 📝 Backlog

<!-- Monorepo Architecture -->
- [ ] **[ARCHITECTURE]** Monorepo: Setup structure - create `packages/`, configure NPM workspaces, create `tsconfig.base.json` (P2)
- [ ] **[ARCHITECTURE]** Monorepo: Extract `@termaid/core` - move LLM providers, types, prompts, utils to shared package (P2)
- [ ] **[ARCHITECTURE]** Monorepo: Migrate `@termaid/electron` - move to packages, update imports to use `@termaid/core` (P2)
- [ ] **[ARCHITECTURE]** Monorepo: Verify build - ensure all tests pass, app runs correctly, no regressions (P2)
- [ ] **[DEVOPS]** Monorepo: Configure CI/CD - separate workflows for each package, shared caching (P3)
- [ ] **[DOCS]** Monorepo: Update documentation - README, contribution guide, package-specific docs (P3)

<!-- Discord Bot (optional consumer of @termaid/core) -->
- [ ] **[FEAT]** Discord bot: Create `@termaid/discord-bot` package structure - bot class, command handling (P3)
- [ ] **[FEAT]** Discord bot: Implement commands - `!tb` (generate), `!tb explain`, `!tb interpret` (P3)

<!-- Context-Aware AI (Feature 2 - Suggestions contextuelles) -->
- [ ] **[UX]** Collect system context (cwd, OS, git status, project type, Docker availability) for AI command generation (P1)
- [ ] **[UX]** Inject system context into LLM prompts to produce environment-aware command suggestions (P1)
- [ ] **[UX]** Auto-refresh system context periodically and refresh before each command request (P1)

<!-- Error Auto-Correction (Feature 3a) -->
- [ ] **[FEAT]** Create fix-error prompt and backend service to auto-suggest command corrections on failure (P1)
- [ ] **[UX]** Display error correction suggestions in chat UI with one-click apply / dismiss (P2)

<!-- Command Workflows/Recipes (Feature 3b) -->
- [ ] **[FEAT]** Create recipe storage service (JSON) with CRUD operations for reusable command sequences (P2)
- [ ] **[FEAT]** Implement recipe execution engine with step-by-step progression and error handling (P2)
- [ ] **[UX]** Add recipe recording mode to capture command sequences during execution (P2)
- [ ] **[UX]** Build recipe management UI (list panel, editor, runner with progress) (P2)

## 🚧 In Progress

<!-- Context-Aware AI (Feature 2 - Sprint 1) -->
- [x] **[FEAT]** Collect system context (cwd, OS, git status, project type, Docker availability) for AI command generation
- [ ] **[UX]** Inject system context into LLM prompts to produce environment-aware command suggestions