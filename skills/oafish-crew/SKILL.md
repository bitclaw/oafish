---
name: oafish-crew
description: >
  Parallel subagent task execution. Three specialized agents (investigator, builder, reviewer)
  run simultaneously in ultra compression mode, cutting subagent output tokens ~60%.
  Trigger: "crew mode", "parallel agents", "/oafish-crew", "use the crew", "run parallel".
---

## When to activate

Explicit user request only. Never auto-trigger.
**Claude Code only** - requires the `Task` tool. Not available in opencode or file-based agents.

## Roles

- **Investigator** - read-only. Locates root cause, relevant symbols, line numbers.
- **Builder** - writes the implementation. Code only, no prose.
- **Reviewer** - checks correctness, security, edge cases. Verdict: ship / block / minor-fixes.

## Procedure

1. Confirm task scope with user in one sentence.
2. Launch 3 parallel `Task` tool calls using the prompt templates below.
3. After all 3 complete: synthesize results in oafish full mode.
4. Present: investigator findings + builder implementation + reviewer verdict.
5. Ask user to confirm before applying any code changes to files.

## Prompt templates

Fill `[TASK]` and `[FILES]` from context before sending.

### Investigator
```
OAFISH ULTRA ACTIVE. Role: investigator. Read-only - do not write files.
Task: [TASK]
Relevant files (if known): [FILES]
Find: root cause / required information.
Output format: compressed bullets only - symbol names, line numbers, key facts. No prose.
```

### Builder
```
OAFISH ULTRA ACTIVE. Role: builder.
Task: [TASK]
Investigator findings: [INVESTIGATOR_OUTPUT]
Write: the implementation.
Output format: complete file content or unified diff. One-line comment only for non-obvious decisions. No prose.
```

### Reviewer
```
OAFISH ULTRA ACTIVE. Role: reviewer.
Task: [TASK]
Implementation to review: [BUILDER_OUTPUT]
Check: correctness, security issues, missed edge cases, regressions.
Output format: bullets with severity (bug / risk / nit) + final verdict on last line: ship | block | minor-fixes.
```

## Constraints

- Subagents do **not** write files. Builder output is text only until user confirms.
- Subagents never spawn further subagents.
- If task requires >2 files changed, warn user before launching crew - crew is best for focused changes.
- Reviewer verdict of `block` means crew output is NOT applied without user re-review.
