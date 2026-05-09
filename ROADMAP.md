# Roadmap

## v0.1 — shipped

- [x] Compression rules (`rules/oafish.md`) — lite / full / ultra
- [x] Claude Code plugin: SessionStart, UserPromptSubmit, PostToolUse hooks
- [x] PostToolUse compress hook — digests verbose Read/Bash/MCP outputs
- [x] 3-path installer: Claude Code plugin / file-based agents / skills registry
- [x] File-based agents: Cursor, Windsurf, Cline, Copilot, opencode, Gemini
- [x] Skills-based agents: Codex, Roo, Amp, Goose
- [x] Statusline badge
- [x] Bun + TypeScript source, compiled JS committed for zero-dep install
- [x] `oafish-commit` skill — Seven Rules commit message generator, no AI attribution

## v0.2 — next

- [x] **Input compression** (`oafish compress <file>`) — compress large files before feeding to agent context
- [ ] **MCP server** — `mcp__oafish__shrink` tool strips whitespace/boilerplate from MCP tool descriptions before they hit the context window
- [ ] **Session stats** — `/oafish stats` reports estimated tokens saved in current session
- [ ] **Deactivation persistence** — remember `stop oafish` across sessions (write off flag vs. just deleting active flag)
- [ ] **opencode native config** — write to opencode config directly, not just AGENTS.md
- [ ] **Better Cline detection** — current detection relies on extension directory scan; use Cline config file if available

## v0.3 — later

- [ ] **Windows installer** (PowerShell)
- [ ] **`/oafish explain`** — show current mode + what rules are active
- [ ] **Per-project config** — `.oafish` file in project root to set default mode without touching global settings
- [ ] **Token benchmark CLI** — run the before/after benchmark against a model, emit a report
- [ ] **More agents** — Continue, Aider, Zed AI, JetBrains AI Assistant

## Backlog / exploring

- [ ] **Auto-mode** — detect long sessions and suggest switching to ultra
- [ ] **Wenyan mode** — classical Chinese compression (extremely token-dense, niche but real)
- [ ] **Agent-specific rules** — slight rule variations per agent where behavior differs
- [ ] **`npx oafish`** — CLI entry point for install + compress + stats without curl pipe

---

Tracked issues: [github.com/bitclaw/oafish/issues](https://github.com/bitclaw/oafish/issues)
