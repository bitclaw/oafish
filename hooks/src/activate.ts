#!/usr/bin/env node
// terse — SessionStart hook
// 1. Writes active mode flag
// 2. Injects terse ruleset as session context
// 3. Nudges statusline setup if missing

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { getDefaultMode, getFlagPath, safeWriteFlag } from "./config.js";

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
const settingsPath = path.join(claudeDir, "settings.json");
const flagPath = getFlagPath();
const mode = getDefaultMode();

if (mode === "off") {
  try { fs.unlinkSync(flagPath); } catch { /* already gone */ }
  process.stdout.write("OK");
  process.exit(0);
}

safeWriteFlag(flagPath, mode);

// Read SKILL.md — single source of truth.
// Plugin installs: __dirname = <plugin_root>/hooks/dist/, SKILL.md at <plugin_root>/skills/terse/SKILL.md
let skillContent = "";
try {
  skillContent = fs.readFileSync(
    path.join(__dirname, "..", "..", "skills", "terse", "SKILL.md"),
    "utf8"
  );
} catch { /* standalone — use fallback */ }

let output: string;

if (skillContent) {
  const body = skillContent.replace(/^---[\s\S]*?---\s*/, "");

  // Filter intensity table + examples to active level only
  const filtered = body.split("\n").reduce<string[]>((acc, line) => {
    const tableRow = line.match(/^\|\s*\*\*(\S+?)\*\*\s*\|/);
    if (tableRow) {
      if (tableRow[1] === mode) acc.push(line);
      return acc;
    }
    const exampleLine = line.match(/^- (\S+?):\s/);
    if (exampleLine) {
      if (exampleLine[1] === mode) acc.push(line);
      return acc;
    }
    acc.push(line);
    return acc;
  }, []);

  output = `TERSE MODE ACTIVE — level: ${mode}\n\n${filtered.join("\n")}`;
} else {
  output =
    `TERSE MODE ACTIVE — level: ${mode}\n\n` +
    `Respond concise. Drop fluff. Keep full technical accuracy.\n\n` +
    `Drop: articles, filler (just/really/basically/simply), pleasantries, hedging. ` +
    `Fragments OK. Short synonyms. Technical terms exact. Code unchanged.\n\n` +
    `Pattern: [thing] [action] [reason]. [next step].\n\n` +
    `Auto-clarity: drop terse for security warnings, irreversible ops, ambiguous sequences. Resume after.\n\n` +
    `"stop terse" or "normal mode" to revert. Level: ${mode}. Switch: /terse lite|full|ultra.`;
}

// Nudge statusline setup if not configured
try {
  let hasStatusline = false;
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    if (settings.statusLine) hasStatusline = true;
  }
  if (!hasStatusline) {
    const scriptPath = path.join(__dirname, "..", "statusline");
    const cmd = `bash "${scriptPath}"`;
    const snippet = `"statusLine": { "type": "command", "command": ${JSON.stringify(cmd)} }`;
    output +=
      `\n\nSTATUSLINE SETUP NEEDED: terse includes a statusline badge ([TERSE], [TERSE:ULTRA]). ` +
      `Not configured yet. Add to ${settingsPath}: ${snippet}. ` +
      `Offer to set this up for user on first interaction.`;
  }
} catch { /* silent fail */ }

process.stdout.write(output);
