.PHONY: help
help: ## Show available targets
	@grep -E '^[a-zA-Z_.]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-22s\033[0m %s\n", $$1, $$2}'

# ── build ─────────────────────────────────────────────────────────────────

.PHONY: build
build: ## Compile TypeScript hooks → hooks/dist/
	@bun run build

.PHONY: typecheck
typecheck: ## Type-check TypeScript (no emit)
	@bun run typecheck

# ── lint (report only — exits non-zero on issues) ─────────────────────────

.PHONY: lint
lint: lint.ts lint.py lint.sh ## Lint all (TypeScript + Python + shell)

.PHONY: lint.ts
lint.ts: ## Biome lint + format check
	@bun run lint

.PHONY: lint.py
lint.py: ## Ruff lint + format check
	@uvx ruff check benchmarks/
	@uvx ruff format --check benchmarks/

.PHONY: lint.sh
lint.sh: ## Shellcheck bash scripts
	@shellcheck install dev-install hooks/statusline

# ── fix (auto-fix in place) ───────────────────────────────────────────────

.PHONY: fix
fix: fix.ts fix.py ## Auto-fix all (TypeScript + Python)

.PHONY: fix.ts
fix.ts: ## Biome auto-fix (lint + format)
	@bun run fix

.PHONY: fix.py
fix.py: ## Ruff auto-fix (lint + format)
	@uvx ruff check --fix benchmarks/
	@uvx ruff format benchmarks/

# ── ci ────────────────────────────────────────────────────────────────────

.PHONY: ci
ci: build typecheck lint ## Full CI check (build + typecheck + lint)

# ── benchmark ─────────────────────────────────────────────────────────────

.PHONY: benchmark.dry
benchmark.dry: ## Benchmark dry-run (no API calls)
	@uv run python benchmarks/run.py --dry-run

.PHONY: benchmark
benchmark: ## Run full benchmark (requires ANTHROPIC_API_KEY)
	@uv run python benchmarks/run.py
