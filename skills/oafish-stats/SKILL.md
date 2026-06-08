---
name: oafish-stats
description: >
  Reports token savings for the current session. Reads Claude Code session
  JSONL directly - no estimates, real numbers. Delivered by the
  UserPromptSubmit hook; Claude never sees this prompt.
  Use when user says "oafish stats", "how many tokens saved", or invokes
  /oafish stats. Flags: --all (lifetime), --share (tweetable one-liner).
---

Token savings report for current session. Hook-delivered - never reaches Claude.

## Usage

- `/oafish stats` - current session
- `/oafish stats --all` - lifetime across all sessions
- `/oafish stats --share` - one-liner summary

## Output

```
Oafish Stats
──────────────────────────────────────
Session: …<path>
Mode:    full
Turns:   42
──────────────────────────────────────
Output tokens:              1,234
Cache-read tokens:          5,678
──────────────────────────────────────
Est. without oafish:        3,524
Est. tokens saved:          2,290 (~65%)
Est. saved (USD):          ~$0.0034
Compressed files:    1 file, ~150 tokens saved/session
──────────────────────────────────────
```

## Boundaries

Read-only. No writes except appending to `~/.claude/.oafish-history.jsonl` for lifetime tracking.
