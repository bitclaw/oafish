---
name: oafish-commit
description: >
  Commit message generator from current branch diff. Output text only — never
  runs git commit or git push. Use when user says "write a commit", "commit
  message", "generate commit", "/commit", or invokes /oafish-commit.
---

Generate commit message from current branch changes. Output text only.

## Steps

1. Run `git diff main...HEAD` — see all branch changes. Empty → fall back to `git diff --cached`, then `git diff`.
2. Analyze diff. Draft message using Seven Rules below.
3. Output in fenced code block.

## The Seven Rules

1. Separate subject from body with blank line
2. Limit subject to 50 characters
3. Capitalize the subject line
4. Do not end subject line with a period
5. Imperative mood: "Add", "Fix", "Remove" — not "Added", "Fixes", "Removed"
6. Wrap body at 72 characters
7. Body explains *what* and *why*, not how

## Additional Rules

- Be concise — no repetition or verbosity
- Reflect only work done on current branch
- Output commit message text only — never run git commit or push

## What NEVER goes in

- "Generated with Claude Code", "Co-Authored-By: Claude", or any AI/tool attribution
- Any tool or agent name (opencode, Cursor, Windsurf, Cline, Copilot, Gemini, etc.)
- "This commit does X", "I", "we", "now", "currently" — diff says what
- Emoji (unless project already uses them)

## Examples

Simple fix:
```
Fix null pointer in user auth middleware
```

New feature with why:
```
Add profile endpoint for mobile client

Mobile cold-launch needs profile data without full user
payload to reduce LTE bandwidth. Full user endpoint stays.

Closes #128
```

Breaking change:
```
Rename /v1/orders to /v1/checkout

BREAKING CHANGE: clients on /v1/orders must migrate before
2026-06-01. Old route returns 410 after that date.
```

## Boundaries

Outputs commit message text only. Does not stage, commit, or push.
