#!/usr/bin/env node
// oafish — UserPromptSubmit hook
// Tracks mode switches, natural-language activation/deactivation, per-turn reinforcement

import fs from "node:fs";
import { getDefaultMode, getFlagPath, getOffFlagPath, safeWriteFlag, readFlag, VALID_MODES, type Mode } from "./config.js";
import { getStats } from "./stats.js";

const flagPath = getFlagPath();
const offFlagPath = getOffFlagPath();

function activate(mode: Mode): void {
  try { fs.unlinkSync(offFlagPath); } catch { /* ok */ }
  safeWriteFlag(flagPath, mode);
}

function deactivate(): void {
  try { fs.unlinkSync(flagPath); } catch { /* already gone */ }
  safeWriteFlag(offFlagPath, "off");
}

function monitorContext(transcriptPath: string | undefined, activeMode: string): string | null {
  if (!transcriptPath) return null;
  try {
    const bytes = fs.statSync(transcriptPath).size;
    // 4 bytes/token rough est; JSONL metadata overhead → 0.55 correction
    const tokenEst = Math.round(bytes / 4 * 0.55);
    const limit = 200_000;
    const pct = tokenEst / limit;
    if (pct >= 0.80) {
      const extra = activeMode !== "ultra" ? " Switch /oafish ultra to extend session." : "";
      return `[oafish] Context ~${Math.round(pct * 100)}% full (~${tokenEst.toLocaleString()} tokens). Run /compact now.${extra}`;
    }
    if (pct >= 0.60) {
      return `[oafish] Context ~${Math.round(pct * 100)}% full (~${tokenEst.toLocaleString()} tokens). Consider /compact soon.`;
    }
  } catch { /* silent */ }
  return null;
}

let input = "";
process.stdin.on("data", (chunk: Buffer) => { input += chunk; });
process.stdin.on("end", () => {
  try {
    const data = JSON.parse(input);
    const prompt: string = (data.prompt || "").trim();
    const lower = prompt.toLowerCase();

    // Natural-language activation
    if (
      /\b(activate|enable|turn on|start|use)\b.*\boafish\b/i.test(prompt) ||
      /\boafish\b.*\b(mode|on|activate|enable)\b/i.test(prompt) ||
      /\bless tokens\b/i.test(prompt) ||
      /\bbe brief\b/i.test(prompt)
    ) {
      if (!/\b(stop|disable|turn off|deactivate)\b/i.test(prompt)) {
        const mode = getDefaultMode();
        if (mode !== "off") activate(mode);
      }
    }

    // Natural-language deactivation
    if (
      /\b(stop|disable|deactivate|turn off)\b.*\boafish\b/i.test(prompt) ||
      /\boafish\b.*\b(stop|disable|deactivate|turn off)\b/i.test(prompt) ||
      /\bnormal mode\b/i.test(lower)
    ) {
      deactivate();
    }

    // Slash command: /oafish stats [--all] [--share]
    if (lower.startsWith("/oafish stats") || lower.startsWith("/oafish-stats")) {
      const activeMode = readFlag(flagPath) ?? "full";
      const statsArgs = lower.split(/\s+/);
      const statsText = getStats({
        transcriptPath: data.transcript_path as string | undefined,
        sessionId: data.session_id as string | undefined,
        mode: activeMode,
        all: statsArgs.includes("--all"),
        share: statsArgs.includes("--share"),
      });
      process.stdout.write(JSON.stringify({ decision: "block", reason: statsText }));
      process.exit(0);
    }

    // Slash command: /oafish [lite|full|ultra|off]
    if (lower.startsWith("/oafish")) {
      const parts = lower.split(/\s+/);
      const arg = parts[1] || "";

      if (arg === "off" || arg === "stop" || arg === "disable") {
        deactivate();
      } else if (VALID_MODES.includes(arg as Mode) && arg !== "off") {
        activate(arg as Mode);
      } else if (!arg) {
        const mode = getDefaultMode();
        if (mode !== "off") activate(mode);
      }
    }

    // Per-turn reinforcement — keeps oafish active when other plugins inject competing instructions
    const activeMode = readFlag(flagPath);
    if (activeMode && activeMode !== "off") {
      const contextWarn = monitorContext(data.transcript_path as string | undefined, activeMode);
      const reinforcement =
        `OAFISH MODE ACTIVE (${activeMode}). ` +
        `Drop articles/filler/pleasantries/hedging. Fragments OK. ` +
        `Code/commits/security: write normal.`;
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: contextWarn ? `${reinforcement}\n${contextWarn}` : reinforcement
        }
      }));
    }
  } catch { /* silent fail */ }
});
