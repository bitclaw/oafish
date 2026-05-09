#!/usr/bin/env node
// oafish compress — CLI tool to compress markdown/text files before feeding to context
// Usage: node hooks/dist/compress-file.js <file>

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const COMPRESSIBLE_EXTS = new Set([
	".md",
	".txt",
	".markdown",
	".rst",
	".typ",
	".typst",
]);
const SKIP_EXTS = new Set([
	".py",
	".js",
	".ts",
	".jsx",
	".tsx",
	".mjs",
	".cjs",
	".json",
	".yaml",
	".yml",
	".toml",
	".env",
	".lock",
	".css",
	".scss",
	".html",
	".xml",
	".sql",
	".sh",
	".bash",
	".zsh",
	".fish",
	".go",
	".rs",
	".java",
	".c",
	".cpp",
	".h",
	".rb",
	".php",
	".swift",
]);

const SENSITIVE_BASENAME = [
	/^\.env/i,
	/^credentials/i,
	/^secrets/i,
	/^passwords?/i,
	/^id_rsa$/i,
	/^id_dsa$/i,
	/^id_ecdsa$/i,
	/^id_ed25519$/i,
	/\.(pem|key|p12|pfx|crt|cer|jks|keystore|asc|gpg)$/i,
];
const SENSITIVE_PATHS = new Set([".ssh", ".aws", ".gnupg", ".kube", ".docker"]);
const SENSITIVE_TOKENS =
	/secret|credential|password|passwd|apikey|accesskey|token|privatekey/i;

function isCompressible(filePath: string): boolean {
	const basename = path.basename(filePath);
	if (basename.endsWith(".original.md")) return false;
	const ext = path.extname(basename).toLowerCase();
	if (SKIP_EXTS.has(ext)) return false;
	return COMPRESSIBLE_EXTS.has(ext) || ext === "";
}

function isSensitive(filePath: string): boolean {
	const basename = path.basename(filePath);
	if (SENSITIVE_BASENAME.some((p) => p.test(basename))) return true;
	if (SENSITIVE_TOKENS.test(basename.replace(/[-_.]/g, ""))) return true;
	return filePath.split(path.sep).some((p) => SENSITIVE_PATHS.has(p));
}

function buildCompressPrompt(original: string): string {
	return `Compress this text file to save tokens while preserving ALL technical substance.

REMOVE: articles (a/an/the when harmless), filler (just/really/basically/actually/simply), \
pleasantries, hedging (it might be worth/you could consider), redundant phrases \
(in order to → to, make sure to → ensure).

PRESERVE EXACTLY: code blocks, inline code, URLs, file paths, commands, technical terms, \
library/API names, headings (exact text), dates, version numbers, env vars.

TECHNIQUES: fragment syntax OK, short synonyms (big not extensive), drop modal verbs \
(remove "you should"/"remember to"), merge redundant bullets, keep one example where many repeat.

Output ONLY the compressed text. No explanation. No outer code fence.

FILE:
${original}`;
}

function buildFixPrompt(
	original: string,
	compressed: string,
	errors: string[],
): string {
	return `The compressed version is missing elements from the original. Fix ONLY the listed issues.

ISSUES:
${errors.map((e) => `- ${e}`).join("\n")}

ORIGINAL:
${original}

COMPRESSED (fix this):
${compressed}

Output ONLY the fixed text. No explanation.`;
}

interface ValidationResult {
	valid: boolean;
	errors: string[];
}

function validate(original: string, compressed: string): ValidationResult {
	const errors: string[] = [];

	// Headings must be preserved exactly
	const origHeadings = original.match(/^#{1,6}\s+.+/gm) ?? [];
	const compHeadings = new Set(compressed.match(/^#{1,6}\s+.+/gm) ?? []);
	for (const h of origHeadings) {
		if (!compHeadings.has(h)) errors.push(`Missing heading: ${h}`);
	}

	// URLs must survive
	const origUrls = original.match(/https?:\/\/[^\s)>\]"]+/g) ?? [];
	for (const url of origUrls) {
		if (!compressed.includes(url)) errors.push(`Missing URL: ${url}`);
	}

	// File paths must survive
	const origPaths = original.match(/(?:\.\.?\/|\/)[^\s"'`,;)\]]+/g) ?? [];
	for (const p of origPaths) {
		if (!compressed.includes(p)) errors.push(`Missing path: ${p}`);
	}

	// Inline code must survive
	const origInline = original.match(/`[^`\n]+`/g) ?? [];
	for (const code of origInline) {
		if (!compressed.includes(code)) errors.push(`Missing inline code: ${code}`);
	}

	// Bullet count: allow up to 15% loss (merging is OK)
	const origBullets = (original.match(/^[-*+]\s/gm) ?? []).length;
	const compBullets = (compressed.match(/^[-*+]\s/gm) ?? []).length;
	if (origBullets > 5 && compBullets < origBullets * 0.85) {
		errors.push(`Too few bullets: ${compBullets} of ${origBullets}`);
	}

	return { valid: errors.length === 0, errors };
}

async function compressFile(filePath: string): Promise<void> {
	const absPath = path.resolve(filePath);

	if (!fs.existsSync(absPath)) {
		process.stderr.write(`oafish: file not found: ${absPath}\n`);
		process.exit(1);
	}

	if (!isCompressible(absPath)) {
		process.stderr.write(`oafish: not a compressible file: ${absPath}\n`);
		process.exit(1);
	}

	if (isSensitive(absPath)) {
		process.stderr.write(`oafish: refusing sensitive file: ${absPath}\n`);
		process.exit(1);
	}

	const original = fs.readFileSync(absPath, "utf8");

	if (original.trim().length === 0) {
		process.stderr.write("oafish: file is empty\n");
		process.exit(1);
	}

	const backupPath = absPath.replace(/(\.[^/.]+)?$/, ".original.md");

	if (fs.existsSync(backupPath)) {
		process.stderr.write(
			`oafish: backup already exists: ${backupPath} — delete it first\n`,
		);
		process.exit(1);
	}

	const client = new Anthropic();
	const MAX_RETRIES = 2;

	// Initial compression
	const response = await client.messages.create({
		model: "claude-haiku-4-5-20251001",
		max_tokens: 4096,
		system: [
			{
				type: "text",
				text: "You are a precise text compressor. Follow instructions exactly. Never add explanation or wrapping.",
				cache_control: { type: "ephemeral" },
			},
		],
		messages: [{ role: "user", content: buildCompressPrompt(original) }],
	});

	let compressed =
		response.content[0]?.type === "text" ? response.content[0].text.trim() : "";

	if (!compressed || compressed === original.trim()) {
		process.stderr.write("oafish: compression produced no change\n");
		process.exit(1);
	}

	// Validate + retry
	let result = validate(original, compressed);
	let attempt = 0;

	while (!result.valid && attempt < MAX_RETRIES) {
		attempt++;
		const fix = await client.messages.create({
			model: "claude-haiku-4-5-20251001",
			max_tokens: 4096,
			messages: [
				{
					role: "user",
					content: buildFixPrompt(original, compressed, result.errors),
				},
			],
		});
		compressed =
			fix.content[0]?.type === "text" ? fix.content[0].text.trim() : compressed;
		result = validate(original, compressed);
	}

	if (!result.valid) {
		process.stderr.write(
			`oafish: validation failed after ${MAX_RETRIES} retries:\n${result.errors.join("\n")}\n`,
		);
		process.exit(1);
	}

	// Write backup first, verify, then overwrite
	fs.writeFileSync(backupPath, original, "utf8");
	if (fs.readFileSync(backupPath, "utf8") !== original) {
		fs.unlinkSync(backupPath);
		process.stderr.write("oafish: backup verification failed\n");
		process.exit(1);
	}

	fs.writeFileSync(absPath, compressed, "utf8");

	const pct = Math.round((1 - compressed.length / original.length) * 100);
	process.stdout.write(
		`${path.basename(absPath)}: ${pct}% smaller (${original.length} → ${compressed.length} chars). Backup: ${path.basename(backupPath)}\n`,
	);
}

const [, , ...args] = process.argv;

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
	process.stdout.write(
		"Usage: oafish compress <file>\n" +
			"Compresses a markdown/text file to save context window tokens.\n" +
			"Original saved as <file>.original.md before overwriting.\n",
	);
	process.exit(0);
}

compressFile(args[0]).catch((err) => {
	process.stderr.write(`oafish: ${err?.message ?? err}\n`);
	process.exit(1);
});
