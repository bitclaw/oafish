#!/usr/bin/env node
// oafish — MCP shrink server
// Stdio JSON-RPC proxy that wraps any upstream MCP server and compresses
// tool/prompt/resource description fields before they hit the context window.
// Zero API calls — regex-only compression, ~1ms per tools/list response.
//
// Usage:
//   node mcp-shrink.js -- <upstream-cmd> [args...]
//
// Example settings.json entry:
//   "mcpServers": {
//     "fs-shrunk": {
//       "command": "node",
//       "args": ["/path/to/oafish/hooks/dist/mcp-shrink.js", "--",
//                "npx", "@modelcontextprotocol/server-filesystem", "/workspace"]
//     }
//   }

import { spawn } from "node:child_process";

const FIELDS_ENV = process.env.OAFISH_SHRINK_FIELDS ?? "description";
const SHRINK_FIELDS = new Set(
	FIELDS_ENV.split(",")
		.map((s) => s.trim())
		.filter(Boolean),
);
const MAX_DESC = 120;
const DEBUG = process.env.OAFISH_SHRINK_DEBUG === "1";

// ── protected patterns — never touch these segments ──────────────────────────

const PROTECTED: RegExp[] = [
	/```[\s\S]*?```/g,
	/`[^`\n]+`/g,
	/https?:\/\/\S+/gi,
	/\b[\w.-]+[/\\][\w./\\-]+/g,
];

//  = Unicode private-use area — safe sentinel, never appears in real MCP descriptions
const SENTINEL_PREFIX = "P";
const SENTINEL_SUFFIX = "";
const SENTINEL_RE = /P(\d+)/g;

function withProtected(text: string, fn: (s: string) => string): string {
	const sentinels: string[] = [];
	let i = 0;
	let result = text;

	for (const re of PROTECTED) {
		result = result.replace(re, (match) => {
			const key = `${SENTINEL_PREFIX}${i++}${SENTINEL_SUFFIX}`;
			sentinels.push(match);
			return key;
		});
	}

	result = fn(result);

	let si = 0;
	result = result.replace(SENTINEL_RE, () => sentinels[si++] ?? "");
	return result;
}

// ── compression ───────────────────────────────────────────────────────────────

const FILLERS =
	/\b(just|really|basically|actually|simply|quite|very|please|note that|keep in mind|make sure|be sure|remember to|you can|you should|feel free to|in order to|so that you can|this (tool|function|method|endpoint|command) (will|allows?|lets?|helps?|can|enables?))\b/gi;

const ARTICLES = /\b(a|an|the)\s+/g;

function shrinkDescription(desc: string): string {
	if (!desc || typeof desc !== "string") return desc;

	return withProtected(desc, (text) => {
		// Take first paragraph only (drop trailing verbose explanations)
		const firstPara = text.split(/\n\n/)[0] ?? text;
		// Take first sentence
		const firstSentence = firstPara.split(/(?<=[.!?])\s+/)[0] ?? firstPara;

		let out = firstSentence
			.replace(FILLERS, " ")
			.replace(ARTICLES, " ")
			.replace(/\s{2,}/g, " ")
			.trim();

		if (out.length > MAX_DESC) out = `${out.slice(0, MAX_DESC - 1)}…`;
		return out;
	});
}

function shrinkObj(obj: unknown): unknown {
	if (!obj || typeof obj !== "object") return obj;
	if (Array.isArray(obj)) return obj.map(shrinkObj);

	const record = obj as Record<string, unknown>;
	const result: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(record)) {
		if (SHRINK_FIELDS.has(k) && typeof v === "string") {
			const original = v;
			const compressed = shrinkDescription(v);
			result[k] = compressed;
			if (DEBUG && compressed !== original) {
				process.stderr.write(
					`[oafish-shrink] ${k}: ${original.length}c → ${compressed.length}c\n`,
				);
			}
		} else {
			result[k] = shrinkObj(v);
		}
	}
	return result;
}

// ── JSON-RPC message handling ─────────────────────────────────────────────────

function processMessage(msg: Record<string, unknown>): Record<string, unknown> {
	// Only shrink successful responses that match target methods
	// JSON-RPC responses have "result" but no "method"; we need to track pending requests
	// to know which method a response belongs to. Simple approach: shrink any response
	// that contains "tools", "prompts", or "resources" arrays.
	if (!msg.result || typeof msg.result !== "object") return msg;
	const result = msg.result as Record<string, unknown>;

	const hasTarget =
		Array.isArray(result.tools) ||
		Array.isArray(result.prompts) ||
		Array.isArray(result.resources) ||
		Array.isArray(result.resourceTemplates);

	if (!hasTarget) return msg;

	return { ...msg, result: shrinkObj(result) } as Record<string, unknown>;
}

// ── stdio proxy ───────────────────────────────────────────────────────────────

const sepIdx = process.argv.indexOf("--");
if (sepIdx === -1 || sepIdx >= process.argv.length - 1) {
	process.stderr.write(
		"oafish-shrink: usage: node mcp-shrink.js -- <cmd> [args...]\n",
	);
	process.exit(1);
}

const upstreamArgs = process.argv.slice(sepIdx + 1);
const upstream = spawn(upstreamArgs[0], upstreamArgs.slice(1), {
	stdio: ["pipe", "pipe", "inherit"],
});

upstream.on("error", (err) => {
	process.stderr.write(`[oafish-shrink] upstream error: ${err.message}\n`);
	process.exit(1);
});

upstream.on("exit", (code) => {
	process.exit(code ?? 0);
});

// Client stdin → upstream stdin (all requests pass through unchanged)
process.stdin.pipe(upstream.stdin);

// Upstream stdout → process stdout (intercept + compress tool lists)
let upstreamBuf = "";
upstream.stdout.on("data", (chunk: Buffer) => {
	upstreamBuf += chunk.toString("utf8");
	// JSON-RPC over stdio uses newline-delimited messages
	const lines = upstreamBuf.split("\n");
	upstreamBuf = lines.pop() ?? "";

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			const msg = JSON.parse(trimmed) as Record<string, unknown>;
			const processed = processMessage(msg);
			process.stdout.write(`${JSON.stringify(processed)}\n`);
		} catch {
			// Not valid JSON — pass through raw (e.g. HTTP headers in SSE mode)
			process.stdout.write(`${line}\n`);
		}
	}
});

upstream.stdout.on("end", () => {
	if (upstreamBuf.trim()) {
		try {
			const msg = JSON.parse(upstreamBuf) as Record<string, unknown>;
			const processed = processMessage(msg);
			process.stdout.write(`${JSON.stringify(processed)}\n`);
		} catch {
			process.stdout.write(upstreamBuf);
		}
	}
	process.stdout.end();
});
