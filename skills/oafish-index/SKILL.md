---
name: oafish-index
description: >
  Restructures an oversized CLAUDE.md into a lean master index (≤200 lines) plus
  domain-specific subdocuments. Reduces input tokens that load every session.
  Trigger: "index my CLAUDE.md", "split CLAUDE.md", "CLAUDE.md too long",
  "CLAUDE.md over 300 lines", "/oafish-index".
---

## Purpose

CLAUDE.md loads on every session start. Every extra line = extra input tokens, every session.
Target: ≤200 lines for the master index, ≤150 lines per subdocument.

## Convention

**Master index (`CLAUDE.md`):**
- Project overview ≤20 lines
- Architecture summary ≤15 lines
- `## Index` section listing each subdocument with a one-line summary
- Hard cap: 200 lines

**Subdocuments (`CLAUDE-<domain>.md`):**
- Domains: `frontend`, `api`, `db`, `infra`, `testing`, `deploy`, `decisions`
- First line: `<!-- parent: CLAUDE.md -->`
- Hard cap: 150 lines each

## Procedure

1. Read `CLAUDE.md`. Count lines.
   - If ≤200 lines: report "CLAUDE.md is N lines - within budget. No indexing needed."
   - If >200 lines: continue.

2. Identify all `##` sections. Group into domain buckets based on content topic.

3. For each domain bucket exceeding 30 lines: draft a `CLAUDE-<domain>.md` file with the
   `<!-- parent: CLAUDE.md -->` header preserved.

4. Draft a new `CLAUDE.md` as master index:
   - Keep project overview and architecture summary
   - Replace bulky sections with one-line summaries pointing to subdocuments
   - Add `## Index` section listing all subdocuments

5. Show the proposed file list and line counts. Ask user to confirm before writing.

6. Write files only after confirmation.

7. After write: verify `CLAUDE.md` is ≤200 lines. Report final line count.

## Constraints

- Never lose content - every line in the original must appear somewhere in the output.
- Never compress code blocks, URLs, file paths, or commands.
- Subdocuments are standalone readable files, not just fragments.
- Do not create more than 7 subdocument files.
- If the entire CLAUDE.md fits in one domain, do not split - just compress with `/oafish compress`.
