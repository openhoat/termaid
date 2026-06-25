---
title: "Language Rule"
description: "Ensures that all public content in the project is written in English for international accessibility and GitHub publication"
tags: [language, english, documentation, internationalization]
version: "1.0.0"
compatibility: [opencode, claude-code, cline]
---

## Language Rule

## Objective

This rule ensures that all public content in the project is written in English for international accessibility and GitHub publication.

## Scope

All content in the project must be in English, except for specific exceptions:

### Must be in English

- **Documentation files**: README.md, CHANGELOG.md, KANBAN.md, etc.
- **Code comments**: All comments in TypeScript, JavaScript, and other code files
- **Cline rules and workflows**: All files in `contents/` directory
- **Test files**: All test descriptions, assertions, and comments
- **Configuration files**: .env.example, package.json descriptions, etc.
- **Git commit messages**: Must follow Conventional Commits in English (see commit_messages.md)

### Exceptions (must remain in French)

- **Localization files**: French translation files for the application UI
- **Application UI strings**: The actual French text in localization files

### Technical terms

Technical terms and proper nouns should remain in their original language:

- Variable names, function names, class names
- API names, library names, framework names
- Brand names, product names
- Technical acronyms and abbreviations

## When to verify

After each file creation or modification:

1. Check that all text content is in English
2. Verify comments are in English
3. Ensure documentation follows English grammar and spelling

## Verification checklist

Before marking a task as complete, verify:

- [ ] All user-facing text is in English
- [ ] All code comments are in English
- [ ] Documentation files are in English
- [ ] Configuration file descriptions are in English
- [ ] Test descriptions and assertions are in English
- [ ] Only localization files contain French text

## Common French words to avoid

Watch out for these common French words in your content:

**Articles**: le, la, les, un, une, des
**Prepositions**: pour, avec, dans, sur, vers, sans, par
**Conjunctions**: et, ou, mais, donc, car, ni
**Pronouns**: il, elle, on, nous, vous, ils, elles
**Verbs**: être, avoir, faire, aller, voir, prendre, mettre, dire, savoir, pouvoir, vouloir
**Adjectives**: très, assez, peu, beaucoup, trop, tel, tel

## Examples

### Correct (English)

```typescript
// Check if the user is authenticated
if (user.isAuthenticated) {
  // Redirect to dashboard
  redirectTo('/dashboard')
}

```text

### Incorrect (French)

```typescript
// Vérifier si l'utilisateur est authentifié
if (user.isAuthenticated) {
  // Rediriger vers le dashboard
  redirectTo('/dashboard')
}

```text

## Impact on GitHub

This rule ensures:

- International contributors can understand the project
- The project is accessible to non-French speakers
- Consistent documentation across all files
- Professional appearance for open source publication

## Enforcement

This rule should be considered as important as:

- Code quality checks
- Test coverage requirements
- Git commit message standards

Any violation of this rule should be corrected before marking a task as complete.

## Conversation Language Preference

Always respond in French to the user, unless the user explicitly requests another language.

- Use French for all responses, explanations, and clarifications
- Technical terms, code, and proper names should remain in their original language
- File paths, command examples, and configuration should use their original format
- If the user switches to English or another language, follow their preference

**Example:**

- Correct (French): "Je vais créer le fichier de configuration pour vous."
- Incorrect (English): "I will create the configuration file for you."
- Technical terms: "Utilisez le hook `useState` pour gérer l'état dans React."

## Note

This rule does not affect:

- The application's internal internationalization (i18n) system
- User-facing UI text translations
- Technical terms and proper nouns
- Variable and function names (which follow coding conventions)
