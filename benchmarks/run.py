#!/usr/bin/env python3
"""
oafish benchmark — measures real token savings across all intensity modes.

Calls the Anthropic API directly. Token counts come from the API response,
not estimated. Results stored as JSON in benchmarks/results/.

Usage:
    uv run python benchmarks/run.py
    uv run python benchmarks/run.py --dry-run
    uv run python benchmarks/run.py --trials 5 --model claude-sonnet-4-5
    uv run python benchmarks/run.py --update-readme

Requirements:
    uv (https://docs.astral.sh/uv/) — handles Python 3.14.4+ automatically
    ANTHROPIC_API_KEY env var (or .env.local file)
"""

# /// script
# requires-python = ">=3.14.4"
# dependencies = ["anthropic>=0.95.0", "python-dotenv"]
# ///

from __future__ import annotations

import argparse
import hashlib
import json
import re
import statistics
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).parent.parent
PROMPTS_FILE = ROOT / "benchmarks" / "prompts.json"
SKILL_FILE = ROOT / "skills" / "oafish" / "SKILL.md"
RESULTS_DIR = ROOT / "benchmarks" / "results"
README_FILE = ROOT / "README.md"

MODES = ["baseline", "lite", "full", "ultra"]

MODEL_DEFAULT = "claude-haiku-4-5-20251001"

SYSTEM_BASE = "You are a helpful assistant."

# Injected before SKILL.md content for each mode — matches what SessionStart hook does
MODE_PREFIX = {
    "baseline": None,
    "lite": "OAFISH MODE ACTIVE — level: lite\n\n",
    "full": "OAFISH MODE ACTIVE — level: full\n\n",
    "ultra": "OAFISH MODE ACTIVE — level: ultra\n\n",
}

README_START = "<!-- BENCHMARK-TABLE-START -->"
README_END = "<!-- BENCHMARK-TABLE-END -->"


def load_env() -> None:
    env_file = ROOT / ".env.local"
    if env_file.exists():
        from dotenv import load_dotenv

        load_dotenv(env_file)


def load_skill_content(mode: str) -> str | None:
    if mode == "baseline":
        return None
    raw = SKILL_FILE.read_text()
    body = re.sub(r"^---[\s\S]*?---\s*", "", raw)
    # Filter intensity table and examples to active level only (matches activate.ts)
    lines = []
    for line in body.splitlines():
        table_row = re.match(r"^\|\s*\*\*(\S+?)\*\*\s*\|", line)
        if table_row:
            if table_row.group(1).lower() == mode:
                lines.append(line)
            continue
        example_line = re.match(r"^- (\S+?):\s", line)
        if example_line:
            if example_line.group(1).lower() == mode:
                lines.append(line)
            continue
        lines.append(line)
    prefix = MODE_PREFIX[mode]
    return prefix + "\n".join(lines)


def build_system(mode: str) -> str:
    skill = load_skill_content(mode)
    if not skill:
        return SYSTEM_BASE
    return f"{SYSTEM_BASE}\n\n{skill}"


def call_api(client, model: str, system: str, prompt: str, dry_run: bool) -> dict:
    if dry_run:
        return {"input_tokens": 0, "output_tokens": 0, "content": "[dry-run]"}
    for attempt in range(3):
        try:
            resp = client.messages.create(
                model=model,
                max_tokens=2048,
                temperature=0,
                system=system,
                messages=[{"role": "user", "content": prompt}],
            )
            return {
                "input_tokens": resp.usage.input_tokens,
                "output_tokens": resp.usage.output_tokens,
                "content": resp.content[0].text if resp.content else "",
            }
        except Exception as e:
            if attempt == 2:
                raise
            wait = 5 * (2**attempt)
            print(f"    retry {attempt + 1}/3 after {wait}s ({e})", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError("unreachable")


def median(vals: list[int]) -> float:
    return statistics.median(vals) if vals else 0.0


def run_benchmark(args: argparse.Namespace) -> dict:
    if not args.dry_run:
        import anthropic

    prompts = json.loads(PROMPTS_FILE.read_text())
    skill_sha = hashlib.sha256(SKILL_FILE.read_text().encode()).hexdigest()[:12]

    client = anthropic.Anthropic() if not args.dry_run else None  # type: ignore[name-defined]
    systems = {mode: build_system(mode) for mode in MODES}

    # results[mode][prompt_id] = list of {input_tokens, output_tokens}
    results: dict[str, dict[str, list[dict]]] = {m: {} for m in MODES}

    total_calls = len(prompts) * len(MODES) * args.trials
    call_n = 0

    for p in prompts:
        pid = p["id"]
        prompt_text = p["prompt"]
        print(f"\n  {pid}")
        for mode in MODES:
            results[mode][pid] = []
            sys_prompt = systems[mode]
            for trial in range(args.trials):
                call_n += 1
                print(f"    [{call_n}/{total_calls}] {mode} trial {trial + 1}", end="\r")
                r = call_api(client, args.model, sys_prompt, prompt_text, args.dry_run)
                results[mode][pid].append(r)
                if not args.dry_run:
                    time.sleep(0.4)
        print()

    # Build summary rows
    rows = []
    for p in prompts:
        pid = p["id"]
        row = {"id": pid, "category": p["category"], "prompt": p["prompt"][:80]}
        baseline_out = median([r["output_tokens"] for r in results["baseline"][pid]])
        row["baseline_output"] = round(baseline_out)
        for mode in ["lite", "full", "ultra"]:
            mode_out = median([r["output_tokens"] for r in results[mode][pid]])
            savings = (1 - mode_out / baseline_out) * 100 if baseline_out else 0
            row[f"{mode}_output"] = round(mode_out)
            row[f"{mode}_savings_pct"] = round(savings, 1)
        rows.append(row)

    # Aggregate stats per mode
    summary: dict[str, dict] = {}
    for mode in ["lite", "full", "ultra"]:
        savings_all = [r[f"{mode}_savings_pct"] for r in rows]
        summary[mode] = {
            "avg_savings_pct": round(statistics.mean(savings_all), 1),
            "median_savings_pct": round(statistics.median(savings_all), 1),
            "min_savings_pct": round(min(savings_all), 1),
            "max_savings_pct": round(max(savings_all), 1),
        }

    return {
        "meta": {
            "generated": datetime.now(UTC).isoformat(),
            "model": args.model,
            "trials": args.trials,
            "skill_md_sha": skill_sha,
            "dry_run": args.dry_run,
        },
        "summary": summary,
        "rows": rows,
        "raw": results,
    }


def format_table(data: dict) -> str:
    rows = data["rows"]
    summary = data["summary"]
    model = data["meta"]["model"]
    date = data["meta"]["generated"][:10]
    trials = data["meta"]["trials"]

    lines = [
        f"_Model: `{model}` · {trials} trials per prompt · {date}_",
        "",
        "| Prompt | Baseline | Lite | Full | Ultra |",
        "|--------|----------|------|------|-------|",
    ]
    for r in rows:
        b = r["baseline_output"]
        lite = f"{r['lite_output']} ({r['lite_savings_pct']:+.0f}%)"
        full = f"{r['full_output']} ({r['full_savings_pct']:+.0f}%)"
        ultra = f"{r['ultra_output']} ({r['ultra_savings_pct']:+.0f}%)"
        # Negate to show as savings (positive = fewer tokens)
        lite = f"{r['lite_output']} (-{r['lite_savings_pct']:.0f}%)"
        full = f"{r['full_output']} (-{r['full_savings_pct']:.0f}%)"
        ultra = f"{r['ultra_output']} (-{r['ultra_savings_pct']:.0f}%)"
        lines.append(f"| {r['id']} | {b} | {lite} | {full} | {ultra} |")

    lines += [
        "",
        "**Average savings vs baseline:**",
        "",
        "| Mode | Avg | Median | Min | Max |",
        "|------|-----|--------|-----|-----|",
    ]
    for mode in ["lite", "full", "ultra"]:
        s = summary[mode]
        lines.append(
            f"| {mode} | -{s['avg_savings_pct']}% | -{s['median_savings_pct']}% "
            f"| -{s['min_savings_pct']}% | -{s['max_savings_pct']}% |"
        )
    return "\n".join(lines)


def update_readme(table: str) -> None:
    text = README_FILE.read_text()
    if README_START not in text or README_END not in text:
        print(
            f"  README missing markers {README_START!r} / {README_END!r}. "
            "Add them to inject the table.",
            file=sys.stderr,
        )
        return
    before = text[: text.index(README_START) + len(README_START)]
    after = text[text.index(README_END) :]
    README_FILE.write_text(f"{before}\n\n{table}\n\n{after}")
    print(f"  Updated {README_FILE.name}")


def main() -> None:
    parser = argparse.ArgumentParser(description="oafish benchmark")
    parser.add_argument("--dry-run", action="store_true", help="skip API calls")
    parser.add_argument("--trials", type=int, default=3)
    parser.add_argument("--model", default=MODEL_DEFAULT)
    parser.add_argument("--update-readme", action="store_true")
    args = parser.parse_args()

    load_env()

    if not args.dry_run:
        import os

        if not os.environ.get("ANTHROPIC_API_KEY"):
            sys.exit("ANTHROPIC_API_KEY not set. Add to .env.local or export.")

    print(f"oafish benchmark — {args.model} — {args.trials} trials")
    print(f"Modes: {MODES}")
    print(f"Prompts: {PROMPTS_FILE.name}")
    if args.dry_run:
        print("  [dry-run — no API calls]")

    data = run_benchmark(args)

    # Save results
    RESULTS_DIR.mkdir(exist_ok=True)
    ts = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    out_file = RESULTS_DIR / f"{ts}-{args.model}.json"
    if not args.dry_run:
        out_file.write_text(json.dumps(data, indent=2))
        print(f"\n  Saved: {out_file.relative_to(ROOT)}")

    table = format_table(data)
    print(f"\n{table}")

    if args.update_readme and not args.dry_run:
        update_readme(table)


if __name__ == "__main__":
    main()
