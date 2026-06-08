# Contributing to oafish

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Bun](https://bun.sh) | latest | build + package manager |
| [uv](https://docs.astral.sh/uv/) | latest | Python package manager for benchmarks |
| Python | ≥3.14.4 | benchmark script |

uv manages Python automatically - `uv run` will download 3.14.4 if not present.

Benchmarks require `ANTHROPIC_API_KEY` - set via `export` or `.env.local` in the project root.

---

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
- **Skill changes** (`skills/*/SKILL.md`): restart the Claude Code session only - no build needed.

### Uninstall dev plugin

```bash
bash dev-install --uninstall
```

---

## Quality checks

```bash
make ci          # build + typecheck + lint (all at once)
make lint        # lint TypeScript + Python (report only)
make fix         # auto-fix TypeScript + Python in place
make build       # compile TypeScript → hooks/dist/
make typecheck   # TypeScript type-check only
make lint.ts     # biome only
make lint.py     # ruff only
```

All checks must pass (`make ci`) before opening a PR.

---

## Publishing to npm

### Rules

- **Never** run `npm publish` directly - always use the publish scripts which build, bump, tag, and push atomically.
- **Never** publish from an unclean working tree - commit or stash first.
- Choose the bump type deliberately before running:
  - `patch` - bug fixes, docs, tooling (0.3.0 → 0.3.1)
  - `minor` - new features, new agent support (0.3.0 → 0.4.0)
  - `major` - breaking changes to plugin API or install format (0.3.0 → 1.0.0)

### Workflow

```bash
# 1. Verify auth
npm whoami

# 2. Confirm current version
node -p "require('./package.json').version"

# 3. Run the appropriate script
bun run publish:patch   # bug fix
bun run publish:minor   # new feature
bun run publish:major   # breaking change
```

Each script runs in order: `npm whoami` → `bun run build` → `npm version <type>` → `git push --follow-tags` → `npm publish --access public`. If any step fails, the chain stops before the next destructive action.

### If auth fails (npm 404 error)

npm returns 404, not 401, for expired tokens. Fix:

```bash
npm login
npm whoami   # verify
```

### If you accidentally bumped the wrong version

The version bump is already committed and pushed. Options:

1. **Ship it** - publish the accidental version as-is, then immediately publish a corrective version with the right bump type.
2. **Yank it** - `npm deprecate oafish@<version> "published in error"`. Does not remove from registry but warns installers. Then publish the correct version.

npm does not allow unpublishing packages older than 72 hours. Don't try to revert the git tag - leave it and move forward.

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
| `hooks/dist/` | Compiled JS (committed - zero-dep install) |
| `hooks/statusline` | Bash script for Claude Code statusline badge |
| `skills/oafish/` | Main compression skill (lite/full/ultra) |
| `skills/oafish-commit/` | Commit message generator |
| `skills/oafish-review/` | Code review comments |
| `skills/oafish-help/` | Quick-reference card |
| `skills/oafish-stats/` | Session token savings reporter |
| `skills/oafish-index/` | CLAUDE.md indexer |
| `skills/oafish-crew/` | Parallel subagents (investigator/builder/reviewer) |
| `rules/oafish.md` | Rules file for file-based agents (Cursor, Windsurf, etc.) |
| `.claude-plugin/plugin.json` | Plugin manifest - hooks + skills registry |

### Single source of truth

Each skill's `SKILL.md` is the only file to edit for behavior changes. The SessionStart hook reads it at runtime - no duplication, no sync step needed.

---

## Relevant links

| Resource               | URL |
|------------------------|-----|
| Create plugins         | https://code.claude.com/docs/en/plugins |
| Plugin manifest schema | https://www.schemastore.org/claude-code-plugin-manifest.json |
| Marketplace schema     | https://www.schemastore.org/claude-code-marketplace.json |
