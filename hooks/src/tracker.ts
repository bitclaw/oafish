#!/usr/bin/env node
// oafish — UserPromptSubmit hook
// Tracks mode switches, natural-language activation/deactivation, per-turn reinforcement

import fs from "node:fs";
import { getDefaultMode, getFlagPath, safeWriteFlag, readFlag, VALID_MODES, type Mode } from "./config.js";
import { getStats } from "./stats.js";

const flagPath = getFlagPath();

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
        if (mode !== "off") safeWriteFlag(flagPath, mode);
      }
    }

    // Natural-language deactivation
    if (
      /\b(stop|disable|deactivate|turn off)\b.*\boafish\b/i.test(prompt) ||
      /\boafish\b.*\b(stop|disable|deactivate|turn off)\b/i.test(prompt) ||
      /\bnormal mode\b/i.test(lower)
    ) {
      try { fs.unlinkSync(flagPath); } catch { /* already gone */ }
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
        try { fs.unlinkSync(flagPath); } catch { /* already gone */ }
      } else if (VALID_MODES.includes(arg as Mode) && arg !== "off") {
        safeWriteFlag(flagPath, arg as Mode);
      } else if (!arg) {
        const mode = getDefaultMode();
        if (mode !== "off") safeWriteFlag(flagPath, mode);
      }
    }

    // Per-turn reinforcement — keeps oafish active when other plugins inject competing instructions
    const activeMode = readFlag(flagPath);
    if (activeMode && activeMode !== "off") {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext:
            `OAFISH MODE ACTIVE (${activeMode}). ` +
            `Drop articles/filler/pleasantries/hedging. Fragments OK. ` +
            `Code/commits/security: write normal.`
        }
      }));
    }
  } catch { /* silent fail */ }
});
