#!/usr/bin/env node
// oafish - PostToolUse hook
// Compresses verbose tool outputs to keep context window lean.
// For MCP tools: replaces output via updatedMCPToolOutput.
// For all tools: injects an oafish digest via additionalContext.

import { getFlagPath, readFlag } from "./config.js";

const MIN_LINES = 40;
const MIN_CHARS = 1500;

interface HookInput {
	hook_event_name: string;
	tool_name: string;
	tool_input: Record<string, unknown>;
	tool_response: unknown;
}

function isMcpTool(name: string): boolean {
	return name.startsWith("mcp__");
}

function extractText(response: unknown): string {
	if (typeof response === "string") return response;
	if (response && typeof response === "object") {
		const r = response as Record<string, unknown>;
		if (typeof r.output === "string") return r.output;
		if (typeof r.stdout === "string") return r.stdout;
		if (typeof r.content === "string") return r.content;
		try {
			return JSON.stringify(response);
		} catch {
			return "";
		}
	}
	return String(response ?? "");
}

function isVerbose(text: string): boolean {
	return text.split("\n").length >= MIN_LINES || text.length >= MIN_CHARS;
}

// Extract key structural lines from source code
function digestCode(text: string, filename: string): string {
	const lines = text.split("\n");
	const lineCount = lines.length;
	const ext = filename.split(".").pop() ?? "";

	const fns: string[] = [];
	const imports: string[] = [];

	for (const line of lines) {
		const t = line.trim();
		// Imports
		if (
			/^import\s|^from\s|^const\s.*=\s*require/.test(t) &&
			imports.length < 4
		) {
			imports.push(t.slice(0, 60));
		}
		// Function / class / method signatures
		if (
			/^(export\s+)?(async\s+)?function\s+\w|^(export\s+)?(abstract\s+)?class\s+\w|^\s*(public|private|protected|static|async)?\s*(async\s+)?\w+\s*\(/.test(
				t,
			) &&
			fns.length < 8
		) {
			fns.push(t.replace(/\{.*/, "").trim().slice(0, 70));
		}
	}

	const parts: string[] = [`${lineCount}L`];
	if (ext) parts.push(ext);
	if (fns.length) parts.push(`fns: ${fns.slice(0, 5).join(", ")}`);

	return `[oafish] Read: ${filename} - ${parts.join(" | ")}`;
}

// Digest bash output
function digestBash(response: unknown, _cmd: string): string {
	const r = response as Record<string, unknown>;
	const stdout = String(r.stdout ?? "");
	const stderr = String(r.stderr ?? "");
	const code = r.returnCode ?? r.exit_code ?? r.exitCode ?? 0;

	const lines = stdout.split("\n").filter(Boolean);
	const errLines = stderr.split("\n").filter(Boolean);

	if (Number(code) !== 0) {
		const relevant = [...errLines, ...lines.slice(-5)].slice(0, 8);
		return `[oafish] Bash(exit ${code}): ${relevant.join(" | ").slice(0, 200)}`;
	}

	// Detect test output
	const testMatch = stdout.match(
		/(\d+)\s+pass(?:ing)?[^\n]*(\d+\s+fail(?:ing)?)?/i,
	);
	if (testMatch) {
		return `[oafish] Bash: ${testMatch[0].trim()}`;
	}

	// Generic: first line + line count
	const summary = lines[0]?.slice(0, 100) ?? "";
	return `[oafish] Bash(${lines.length}L): ${summary}${lines.length > 1 ? " …" : ""}`;
}

// Compress MCP JSON output - strip whitespace, keep key scalar values
function compressMcp(response: unknown): string {
	try {
		const text =
			typeof response === "string" ? response : JSON.stringify(response);
		// Strip excessive whitespace and truncate
		return text.replace(/\s+/g, " ").slice(0, 800);
	} catch {
		return String(response).slice(0, 800);
	}
}

let input = "";
process.stdin.on("data", (chunk: Buffer) => {
	input += chunk;
});
process.stdin.on("end", () => {
	try {
		const data: HookInput = JSON.parse(input);
		const { tool_name, tool_input, tool_response } = data;

		// No-op when oafish inactive
		const mode = readFlag(getFlagPath());
		if (!mode || mode === "off") process.exit(0);

		const text = extractText(tool_response);
		if (!isVerbose(text)) process.exit(0);

		let additionalContext: string | undefined;
		let updatedMCPToolOutput: unknown;

		if (tool_name === "Read") {
			const filename =
				String(tool_input.file_path ?? tool_input.path ?? "file")
					.split("/")
					.pop() ?? "file";
			additionalContext = digestCode(text, filename);
		} else if (tool_name === "Bash") {
			additionalContext = digestBash(
				tool_response,
				String(tool_input.command ?? "").slice(0, 60),
			);
		} else if (isMcpTool(tool_name)) {
			const compressed = compressMcp(tool_response);
			additionalContext = `[oafish] ${tool_name}: ${compressed}`;
			updatedMCPToolOutput = compressed;
		}

		if (!additionalContext) process.exit(0);

		const out: Record<string, unknown> = {
			hookSpecificOutput: {
				hookEventName: "PostToolUse",
				additionalContext,
				...(updatedMCPToolOutput !== undefined ? { updatedMCPToolOutput } : {}),
			},
		};
		process.stdout.write(JSON.stringify(out));
	} catch {
		/* silent fail */
	}
});
