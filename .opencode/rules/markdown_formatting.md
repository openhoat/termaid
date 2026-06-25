---
title: "Markdown Formatting Rule"
description: "Defines standard markdown formatting rules to ensure consistency across all markdown files in the project"
tags: [markdown, formatting, style]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Markdown Formatting Rule

## Objective

Defines standard markdown formatting rules to ensure consistency across all markdown files in the project.

## Blank Lines Rule

**No unnecessary blank lines except the last one.**

When editing or creating markdown files:

- **Do not** add consecutive blank lines between paragraphs or sections
- **Do not** add blank lines at the end of a file (except ONE blank line at the very end)
- Use **exactly one blank line** between paragraphs or sections
- Use **exactly one blank line** after headings

### Examples

**Correct:**

```markdown

# Title

Content paragraph 1.

Content paragraph 2.

## Subtitle

More content.

```text

```text
Last line of content.

```text
**Incorrect:**

```markdown

# Title


Content paragraph 1.


Content paragraph 2.


## Subtitle


More content.

```text

```text
Last line of content.


```text

## Application

This rule applies to:

- All `.md` files in the project root
- All `.md` files in `content/` directory
- All `.md` files in subdirectories (docs, etc.)

## Enforcement

When editing markdown files:

- Ensure no consecutive blank lines are introduced
- Ensure exactly one blank line at the end of files
- Ensure proper spacing between sections and paragraphs
