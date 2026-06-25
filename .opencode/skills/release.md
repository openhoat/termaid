---
name: release
description: Create a new release with version bump and changelog
disable-model-invocation: false
title: "Release"
tags: [release, version, changelog, git]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Release

Create a new release for the project with version bump, changelog generation, commit, and tag.

## Steps

### 1. Determine Version Bump

Ask the user for the version bump type: `patch`, `minor`, or `major`. Or accept it as an argument.

### 2. Version Bump

```bash
npm version <patch|minor|major> --no-git-tag-version

```text
This updates the version in `package.json` without creating a git tag yet.

### 3. Run Validation

Run the full validation suite to ensure the project is healthy before releasing:

```bash
npm run validate

```text
If validation fails, fix the issues before proceeding.

### 4. Generate Changelog

```bash
npm run changelog

```text

### 5. Commit and Tag

```bash
VERSION=$(node -p "require('./package.json').version")
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: release v${VERSION}"
git tag -a "v${VERSION}" -m "Release v${VERSION}"

```text

### 6. Push (Optional)

If the user confirms, push the commit and tag:

```bash
git push
git push --tags

```text

## Important

- Must be on the `main` branch.
- Ensure all validation passes before releasing.
- Uses `npm version` directly (no custom bump-version script).
- Run from the project root.
