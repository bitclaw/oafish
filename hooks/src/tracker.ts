#!/usr/bin/env node
// terse — UserPromptSubmit hook
// Tracks mode switches, natural-language activation/deactivation, per-turn reinforcement

import fs from "node:fs";
import { getDefaultMode, getFlagPath, safeWriteFlag, readFlag, VALID_MODES, type Mode } from "./config.js";

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
      /\b(activate|enable|turn on|start|use)\b.*\bterse\b/i.test(prompt) ||
      /\bterse\b.*\b(mode|on|activate|enable)\b/i.test(prompt) ||
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
      /\b(stop|disable|deactivate|turn off)\b.*\bterse\b/i.test(prompt) ||
      /\bterse\b.*\b(stop|disable|deactivate|turn off)\b/i.test(prompt) ||
      /\bnormal mode\b/i.test(lower)
    ) {
      try { fs.unlinkSync(flagPath); } catch { /* already gone */ }
    }

    // Slash command: /terse [lite|full|ultra|off]
    if (lower.startsWith("/terse")) {
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

    // Per-turn reinforcement — keeps terse active when other plugins inject competing instructions
    const activeMode = readFlag(flagPath);
    if (activeMode && activeMode !== "off") {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext:
            `TERSE MODE ACTIVE (${activeMode}). ` +
            `Drop articles/filler/pleasantries/hedging. Fragments OK. ` +
            `Code/commits/security: write normal.`
        }
      }));
    }
  } catch { /* silent fail */ }
});
