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

## v0.2 — shipped

- [x] **Input compression** (`oafish compress <file>`) — compress large files before feeding to agent context
- [x] **MCP server** (`oafish mcp-shrink`) — stdio proxy compresses MCP tool/prompt/resource descriptions before they hit the context window
- [x] **Session stats** — `/oafish stats` reports estimated tokens saved in current session
- [x] **Deactivation persistence** — `stop oafish` writes `.off` flag; survives session restart until user re-activates
- [x] **Context monitor** — per-turn warning at 60%/80% context fill; auto-suggests /compact and /oafish ultra
- [x] **CLAUDE.md indexer** (`/oafish-index`) — splits oversized CLAUDE.md into ≤200-line master index + domain subdocuments
- [x] **oafish-crew** (`/oafish-crew`) — parallel subagents (investigator/builder/reviewer) in ultra mode
- [x] **Native opencode plugin** — TypeScript plugin using `experimental.chat.system.transform` + `tool.execute.after`; npm-installable as `"plugin": ["oafish"]` in `opencode.json`
- [x] **Native Codex CLI plugin** — `.codex-plugin/` manifest + `hooks/hooks.json`; reuses existing skills + hook binaries; `codex plugin marketplace add bitclaw/oafish`
- [x] **`agents/` repo structure** — TypeScript-native plugins live under `agents/<agent>/`; scales cleanly to 10+ agents
- [x] **Multi-agent dev-install** — `dev-install --agent claude|opencode|codex` for local development against any supported agent
- [x] **Versioned publish scripts** — `bun run publish:patch/minor/major` bumps version, runs build, pushes tag, publishes; auth-gated with `npm whoami`
- [ ] **Better Cline detection** — current detection relies on extension directory scan; use Cline config file if available

## v0.3 — next (prioritized by impact)

### P0 — highest leverage

- [ ] **Session deduplication** — PostToolUse tracks a hash of every tool output per session; re-reads of unchanged files inject `[unchanged since call #N]` instead of full content; changed files inject a compact diff. Only possible from the hook layer — caveman has no PostToolUse hooks at all. Biggest single token win in long sessions.

- [ ] **Eval harness with published benchmarks** — Three-arm benchmark: baseline / terse prompt / oafish skill; measures real token counts via Claude API; publishes results to `benchmarks/results/`. Credibility gap vs competitors who publish numbers. Required to back any "~75% reduction" claim with proof.

### P1 — strong differentiation

- [ ] **Compaction-aware compression** — Hook into context summarization so the compacted summary itself is oafish-compressed. opencode: `experimental.session.compacting` hook. Claude Code: `/oafish-compact` skill wrapping `/compact` with injected compression prompt. Denser summaries = longer effective sessions before next compaction.

- [ ] **Per-project `.oafish` config** — `.oafish` file in project root overrides global mode and config. Detected on `SessionStart`. Lets teams commit project-specific compression settings.

- [ ] **Input/prompt compression via UserPromptSubmit** — When user pastes >N lines into a prompt, auto-compress before it hits the model. Completes both sides of compression (currently output-only); matches caveman's described L01 layer.

### P2 — ecosystem / moat

- [ ] **Cross-agent state visibility** — Since all agents share `~/.config/oafish/`, expose a live view: which agents are active, current mode per agent, combined token savings across the stack. Surface via `/oafish stats --agents` and a statusline variant.

- [ ] **oafish-mem** — Lightweight cross-session memory: append-only `~/.config/oafish/mem.jsonl`, accessible via `/oafish-mem add` and `/oafish-mem recall <query>` skills. Keyword search only (no vector, no SQLite). Oafish-compressed at write time. Works in every agent oafish supports — not tied to one CLI.

- [ ] **Compression schema standard** — Machine-readable `compression.schema.json` defining the oafish compression protocol with versioning and field-level attestation. Makes oafish implementable by other tools; positions it as the open standard rather than one of many compression plugins.

## Backlog / exploring

- [ ] **Windows installer** (PowerShell)
- [ ] **`/oafish explain`** — show current mode + what rules are active
- [ ] **More agents** — Continue, Aider, Zed AI, JetBrains AI Assistant, Ampcode, Gemini CLI native plugin
- [ ] **Wenyan mode** — classical Chinese compression (extremely token-dense, niche)
- [ ] **Agent-specific rule variations** — slight rule differences per agent where behavior differs
- [ ] **`npx oafish`** — CLI entry point for install + compress + stats without curl pipe
- [ ] **Auto-mode escalation** — automatically step up intensity as context fills (beyond current warnings)

---

Tracked issues: [github.com/bitclaw/oafish/issues](https://github.com/bitclaw/oafish/issues)
