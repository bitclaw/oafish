# Contributing to oafish

## Local dev install (Claude Code)

Changes to hooks require a build step. Changes to skills (`SKILL.md` files) do not.

### 1. Install dependencies and build

```bash
bun install
bun run build
```

### 2. Register the local plugin

Run the dev-install script once:

```bash
bash dev-install
```

This registers your local repo as the `oafish` plugin in Claude Code without touching the network. Restart Claude Code after running it.

### 3. Verify

Start a new Claude Code session. You should see `OAFISH MODE ACTIVE` in the session context. Run `/oafish-help` to confirm all skills loaded.

### 4. Iterating

- **Hook changes** (`hooks/src/*.ts`): run `bun run build`, restart the Claude Code session.
- **Skill changes** (`skills/*/SKILL.md`): restart the Claude Code session only — no build needed.

### Uninstall dev plugin

```bash
bash dev-install --uninstall
```

---

## Quality checks

```bash
bun run build      # compile TypeScript → hooks/dist/
bun run typecheck  # type-check without emitting
bun run check      # biome lint + format
```

All three must pass before opening a PR.

---

## PR guidelines

- One focused change per PR.
- Skill changes: include before/after example showing the behavior difference.
- Hook changes: describe what the hook does differently and why.
- Run all three quality checks locally first.

---

## Project structure

| Path | Purpose |
|------|---------|
| `hooks/src/` | TypeScript source for Claude Code hooks |
| `hooks/dist/` | Compiled JS (committed — zero-dep install) |
| `hooks/statusline` | Bash script for Claude Code statusline badge |
| `skills/oafish/` | Main compression skill (lite/full/ultra) |
| `skills/oafish-commit/` | Commit message generator |
| `skills/oafish-review/` | Code review comments |
| `skills/oafish-help/` | Quick-reference card |
| `skills/oafish-stats/` | Session token savings reporter |
| `skills/oafish-index/` | CLAUDE.md indexer |
| `skills/oafish-crew/` | Parallel subagents (investigator/builder/reviewer) |
| `rules/oafish.md` | Rules file for file-based agents (Cursor, Windsurf, etc.) |
| `.claude-plugin/plugin.json` | Plugin manifest — hooks + skills registry |

### Single source of truth

Each skill's `SKILL.md` is the only file to edit for behavior changes. The SessionStart hook reads it at runtime — no duplication, no sync step needed.
