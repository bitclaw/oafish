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

## v0.3 — next (easiest wins first, then differentiation, then moat)

### Quick wins — next session

- [ ] **Live compression ratio in statusline** — `[OAFISH 71%]` instead of `[OAFISH]`; real token savings % from current session surfaced each turn. Stats + statusline already exist — small delta. Every screenshot becomes marketing.

- [ ] **`/oafish explain`** — show current mode, active rules summary, and session compression ratio. Single skill, no hook changes needed.

- [ ] **Per-project `.oafish` config** — `.oafish` file in project root overrides global mode, intensity, and budget. Detected on `SessionStart`. Teams can commit project-specific compression settings.

### P0 — highest leverage

- [ ] **Session deduplication** — PostToolUse tracks a hash of every tool output per session; re-reads of unchanged files inject `[unchanged since call #N]` instead of full content; changed files inject a compact diff. Only possible from the hook layer — competitors have no PostToolUse hooks at all. Biggest single token win in long sessions.

- [ ] **Context budget mode** — `"budget": 50000` in `.oafish` or `OAFISH_BUDGET` env var; oafish auto-manages intensity to hit it (lite at 30%, full at 55%, ultra at 75%, dedup + aggressive at 85%). Deterministic session cost for CI/API budget use cases. Nobody else has this.

- [ ] **Eval harness with published benchmarks** — Three-arm benchmark: baseline / terse prompt / oafish skill; measures real token counts via Claude API; publishes results to `benchmarks/results/`. Required to back any "~75% reduction" claim with proof. Credibility driver.

### P1 — strong differentiation

- [ ] **Compaction-aware compression** — Hook into context summarization so the compacted summary itself is oafish-compressed. opencode: `experimental.session.compacting` hook. Claude Code: `/oafish-compact` skill wrapping `/compact` with injected compression prompt. Denser summaries = longer effective sessions before next compaction.

- [ ] **Input/prompt compression via UserPromptSubmit** — When user pastes >N lines into a prompt, auto-compress before it hits the model. Completes both sides of compression (currently output-only).

- [ ] **Team compression via pre-commit hook** — Auto-compress `CLAUDE.md`, `.cursorrules`, `AGENTS.md` on commit so anyone cloning gets pre-compressed context files. Oafish becomes repo infrastructure, not just per-developer tooling.

- [ ] **Adaptive compression** — Track what the model echoes back vs ignores across a session; tighten compression on content the model never references, ease off on content that triggers re-reads. No LLM needed — pattern matching on session behavior. Static rules are the ceiling for competitors; adaptive rules are oafish's floor.

### P2 — ecosystem / moat

- [ ] **Compression proxy API** — Local HTTP proxy at `localhost:PORT`; any tool with a configurable API base URL (LangChain, custom scripts, any API client) routes through oafish. Compresses system prompts before they leave your machine, tool results before they enter the next message. Makes oafish useful to everyone writing LLM code, not just users of supported agents.

- [ ] **Cross-agent state visibility** — Expose a live view of all oafish-active agents via `~/.config/oafish/`; current mode per agent, combined savings across the stack. Surface via `/oafish stats --agents`.

- [ ] **oafish-mem** — Lightweight cross-session memory: append-only `~/.config/oafish/mem.jsonl`, accessible via `/oafish-mem add` and `/oafish-mem recall <query>` skills. Keyword search, no vector/SQLite. Oafish-compressed at write time. Works in every supported agent.

- [ ] **Compression schema standard** — Machine-readable `compression.schema.json` defining the oafish protocol with versioning and field-level attestation. Positions oafish as the open standard other tools implement against.

## Backlog / exploring

- [ ] **Windows installer** (PowerShell)
- [ ] **More agents** — Continue, Aider, Zed AI, JetBrains AI Assistant, Ampcode, Gemini CLI native plugin
- [ ] **Wenyan mode** — classical Chinese compression (extremely token-dense, niche)
- [ ] **Agent-specific rule variations** — slight rule differences per agent where behavior differs
- [ ] **`npx oafish`** — CLI entry point for install + compress + stats without curl pipe
- [ ] **Auto-mode escalation** — automatically step up intensity as context fills (beyond current warnings)

---

Tracked issues: [github.com/bitclaw/oafish/issues](https://github.com/bitclaw/oafish/issues)
