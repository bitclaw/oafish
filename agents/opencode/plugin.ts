import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "@opencode-ai/plugin";
import { getDefaultMode, getFlagPath, readFlag, safeWriteFlag } from "../../hooks/src/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGIN_ROOT = path.resolve(__dirname, "..", "..");
const RULES_PATH = path.join(PLUGIN_ROOT, "rules", "oafish.md");
const SKILL_PATH = path.join(PLUGIN_ROOT, "skills", "oafish", "SKILL.md");

const MIN_LINES = 40;
const MIN_CHARS = 1500;

function loadRules(mode: string): string {
	try {
		const skill = fs.readFileSync(SKILL_PATH, "utf8");
		const body = skill.replace(/^---[\s\S]*?---\s*/, "");
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
		return `OAFISH MODE ACTIVE - level: ${mode}\n\n${filtered.join("\n")}`;
	} catch {
		// fall back to rules/oafish.md
	}
	try {
		return `OAFISH MODE ACTIVE - level: ${mode}\n\n${fs.readFileSync(RULES_PATH, "utf8")}`;
	} catch {
		return `OAFISH MODE ACTIVE - level: ${mode}\n\nRespond concise. Drop fluff. Keep full technical accuracy.`;
	}
}

function activeMode(): string | null {
	const flag = readFlag(getFlagPath());
	if (!flag || flag === "off") return null;
	return flag;
}

function isVerbose(text: string): boolean {
	return text.split("\n").length >= MIN_LINES || text.length >= MIN_CHARS;
}

function digestCode(text: string, toolName: string): string {
	const lines = text.split("\n");
	const fns: string[] = [];
	const imports: string[] = [];
	for (const line of lines) {
		const t = line.trim();
		if (/^import\s|^from\s|^const\s.*=\s*require/.test(t) && imports.length < 4)
			imports.push(t.slice(0, 60));
		if (
			/^(export\s+)?(async\s+)?function\s+\w|^(export\s+)?(abstract\s+)?class\s+\w/.test(t) &&
			fns.length < 8
		)
			fns.push(t.replace(/\{.*/, "").trim().slice(0, 70));
	}
	const parts = [`${lines.length}L`];
	if (fns.length) parts.push(`fns: ${fns.slice(0, 5).join(", ")}`);
	return `[oafish] ${toolName}: ${parts.join(" | ")}`;
}

export const OafishPlugin: Plugin = async (_ctx) => {
	// Write active flag on startup so hooks/statusline etc. know mode
	const mode = getDefaultMode();
	if (mode !== "off") safeWriteFlag(getFlagPath(), mode);

	return {
		"experimental.chat.system.transform": async (_input, output) => {
			const mode = activeMode();
			if (!mode) return;
			output.system.push(loadRules(mode));
		},

		"tool.execute.after": async (input, output) => {
			const mode = activeMode();
			if (!mode) return;
			if (!isVerbose(output.output)) return;

			const tool = input.tool;
			if (tool === "read" || tool === "Read") {
				output.output = digestCode(output.output, tool);
			} else if (tool === "bash" || tool === "Bash") {
				const lines = output.output.split("\n").filter(Boolean);
				const summary = lines[0]?.slice(0, 100) ?? "";
				output.output = `[oafish] Bash(${lines.length}L): ${summary}${lines.length > 1 ? " …" : ""}`;
			} else {
				// Generic compression: keep first 20 lines
				const lines = output.output.split("\n");
				output.output =
					`[oafish] ${tool}(${lines.length}L): ` +
					lines.slice(0, 20).join("\n") +
					(lines.length > 20 ? "\n…" : "");
			}
		},
	};
};

export default OafishPlugin;
