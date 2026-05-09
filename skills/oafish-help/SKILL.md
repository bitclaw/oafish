---
name: oafish-help
description: >
  Quick-reference card for all oafish modes, skills, and commands.
  One-shot display, not a persistent mode. Trigger: /oafish-help,
  "oafish help", "what oafish commands", "how do I use oafish".
---

Display this reference card when invoked. One-shot — do NOT change mode, write flag files, or persist anything. Output in oafish style.

## Modes

| Mode | Trigger | What changes |
|------|---------|-------------|
| **Lite** | `/oafish lite` | Drop filler/hedging. Keep articles + full sentences. |
| **Full** | `/oafish` | Drop articles, filler, pleasantries, hedging. Fragments OK. Default. |
| **Ultra** | `/oafish ultra` | Abbreviate prose, arrows for causality, one word when enough. |

Mode sticks until changed or session end.

## Skills

| Skill | Trigger | What it does |
|-------|---------|-------------|
| **oafish-commit** | `/oafish-commit` | Terse commit messages. Conventional Commits. ≤50 char subject. |
| **oafish-review** | `/oafish-review` | One-line PR comments: `L42: 🔴 bug: user null. Add guard.` |
| **oafish-index** | `/oafish-index` | Split oversized CLAUDE.md into ≤200-line index + subdocuments. |
| **oafish-crew** | `/oafish-crew` | Parallel subagents (investigator/builder/reviewer) in ultra mode. |
| **oafish-stats** | `/oafish stats` | Session token savings report with USD estimate. |
| **oafish-help** | `/oafish-help` | This card. |

## Input Compression

Compress large context files before feeding to agent:

```bash
oafish compress <file.md>
```

Backs up original to `<file>.original.md`. Saves ~35-46% input tokens.

## Deactivate

Say "stop oafish" or "normal mode". Resume anytime with `/oafish`.

Deactivation persists across sessions — oafish stays off until you re-activate.

## Configure Default Mode

Default = `full`. Change it:

**Environment variable** (highest priority):
```bash
export OAFISH_DEFAULT_MODE=ultra
```

**Config file** (`~/.config/oafish/config.json`):
```json
{ "defaultMode": "lite" }
```

Set `"off"` to disable auto-activation on session start.

Resolution: env var > config file > `full`.

## MCP Shrink

Wrap any MCP server to compress tool descriptions before they hit context:

```jsonc
// settings.json
{
  "mcpServers": {
    "fs-shrunk": {
      "command": "node",
      "args": ["/path/to/oafish/hooks/dist/mcp-shrink.js", "--",
               "npx", "@modelcontextprotocol/server-filesystem", "/workspace"]
    }
  }
}
```

## More

Full docs: https://github.com/bitclaw/oafish
