---
title: "Subagents Rule"
description: "Defines when and how to use subagents for parallel execution of independent tasks"
tags: [subagents, parallel, automation]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Subagents Rule

## Objective

Defines when and how to use Claude Code subagents for parallel execution of independent tasks.

## When to use subagents

- Execute multiple independent tasks simultaneously
- Perform comprehensive testing across multiple components
- Generate extensive documentation for different codebase parts
- Run deep code analysis without blocking the main workflow
- Explore codebase for broader research tasks

## Available subagent types

| Subagent | Purpose | Tools |
| --- | --- | --- |
| `Bash` | Command execution | Bash |
| `Explore` | Fast codebase exploration | All except Task, Edit, Write, NotebookEdit |
| `Plan` | Architecture/implementation planning | All except Task, Edit, Write, NotebookEdit |
| `general-purpose` | Complex multi-step tasks | All |
| `claude-code-guide` | Claude Code CLI/SDK/API questions | Glob, Grep, Read, WebFetch, WebSearch |
| `statusline-setup` | Status line configuration | Read, Edit |

## Best practices

1. **Self-contained tasks**: Provide all necessary context in the prompt
2. **Clear deliverables**: Specify what the subagent should produce
3. **Parallelization**: Launch multiple subagents for independent tasks
4. **File context**: Always specify relevant files and directories
5. **Choose right type**:
   - `Bash`: Simple commands, git operations
   - `Explore`: Fast searches, pattern discovery
   - `Plan`: Architecture decisions (or use EnterPlanMode)
   - `general-purpose`: Complex multi-step tasks

## When NOT to use subagents

- Tasks requiring coordination with main agent
- Modifications to files currently being edited
- Critical operations needing immediate supervision
- Simple tasks completable in main workflow
- Tasks dependent on shared state

## Important rules

- Always provide sufficient context in prompt
- Verify subagent output before considering task complete
- Run quality checks on code modifications
- **Prefer direct tools** (Glob, Grep) for simple searches instead of Explore subagent
