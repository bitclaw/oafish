# oafish

Output compression for AI coding agents. Same answer, fewer tokens.

---

**Before**
> "Sure! I'd be happy to help you with that. The issue you're experiencing is likely caused by a missing null check in the authentication middleware. What's happening is that when the token is undefined, the code attempts to call `.split()` on it, which throws a TypeError. You'll want to add a guard before that line."

**After** (`/oafish`)
> "Auth middleware: token undefined → `.split()` throws. Add null guard before line 42."

~75% fewer output tokens. Full accuracy.

---

## Install

```bash
curl -fsSL https://oafish.bitclaw.com/install | bash
```

Detects which agents are installed and wires up each one automatically.

| Agent | Install method | Auto-activates |
|---|---|---|
| Claude Code | Plugin (hooks + skill) | Yes — every session |
| Cursor | `.cursor/rules/oafish.md` | Yes |
| Windsurf | `.windsurf/rules/oafish.md` | Yes |
| Cline | `.clinerules/oafish.md` | Yes |
| GitHub Copilot | `.github/copilot-instructions.md` | Yes |
| opencode | `~/.config/opencode/AGENTS.md` | Yes |
| Gemini CLI | `GEMINI.md` | Yes |
| Codex / Roo / Amp / Goose | `npx skills add bitclaw/oafish` | On invoke |

Or copy `rules/oafish.md` manually into any agent's rules directory.

---

## Usage

```
/oafish           activate (full mode)
/oafish lite      professional tight — keeps full sentences
/oafish ultra     maximum compression — arrows, abbreviations
stop oafish       deactivate
normal mode      deactivate
```

Mode persists across turns. No drift. Deactivates only on explicit command.

For Codex, invoke oafish with `@...`, not `/...`. `@oafish` can be ambiguous in
this repo because Codex also discovers repo-local skills. To force the plugin
surface, use `@plugins/oafish` or a specific skill such as
`@plugins/oafish:oafish-commit`.

---

## Intensity levels

| Level | What changes | Example |
|---|---|---|
| `lite` | No filler/hedging. Full sentences. | "Your component re-renders because you create a new object reference each render." |
| `full` | Drop articles, fragments OK. | "New object ref each render. Inline prop = re-render. Wrap in `useMemo`." |
| `ultra` | Abbreviations, arrows for causality. | "Inline prop → new ref → re-render. `useMemo`." |

Auto-clarity: oafish suspends for security warnings, destructive operations, and anywhere compression risks misread. Resumes after.

---

## How it works

For Claude Code, oafish installs three hooks:

- **SessionStart** (`activate`) — injects compression rules at session open, writes active mode to `~/.config/oafish/.active`
- **UserPromptSubmit** (`tracker`) — handles `/oafish` commands, reinforces mode each turn
- **PostToolUse** (`compress`) — digests verbose `Read`/`Bash`/MCP outputs before they fill context

The compress hook is the high-leverage part: large file reads and bash output can consume thousands of context tokens per call. oafish intercepts them and injects a terse digest instead:

```
[oafish] Read: auth.ts — 312L | ts | fns: login, logout, validateToken, refreshSession
[oafish] Bash: npm test — 47 passing, 2 failing: auth.test.ts:88, user.test.ts:112
```

For file-based agents (Cursor, Windsurf, etc.), the rules file is written directly — no hooks, same compression behavior via prompt rules.

---

## Benchmarks

Benchmarks measure token reduction against a live model.

```bash
export ANTHROPIC_API_KEY=sk-...   # or add to .env.local
uv run benchmarks/run.py
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for prerequisites.

---

## Build from source

Requires [Bun](https://bun.sh).

```bash
bun install
bun run build       # compiles hooks/src/*.ts → hooks/dist/*.js
```

Hook source is TypeScript (`hooks/src/`). Compiled JS is committed to `hooks/dist/` so installs require no build step on the user's machine.

---

## License

MIT
