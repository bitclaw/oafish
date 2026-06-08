// oafish stats - reads Claude Code session JSONL and reports token savings
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Measured compression ratios per mode (from caveman benchmark suite)
const COMPRESSION_RATIO: Partial<Record<string, number>> = {
	full: 0.65,
	ultra: 0.75,
	lite: 0.35,
};

// Output token price per million (USD) - matched by model prefix
const OUTPUT_PRICE_PER_M: Array<[RegExp, number]> = [
	[/claude-opus-4/, 15.0],
	[/claude-sonnet-4/, 3.0],
	[/claude-haiku-4/, 0.8],
	[/claude-3-5-sonnet/, 3.0],
	[/claude-3-5-haiku/, 0.8],
	[/claude-3-opus/, 15.0],
];

interface TurnEntry {
	type: string;
	message?: {
		model?: string;
		usage?: {
			output_tokens?: number;
			cache_read_input_tokens?: number;
		};
	};
}

interface SessionMetrics {
	turns: number;
	outputTokens: number;
	cacheReadTokens: number;
	model: string;
}

interface HistoryEntry {
	ts: number;
	session_id: string;
	mode: string;
	model: string;
	output_tokens: number;
	est_saved_tokens: number;
	est_saved_usd: number;
}

function getHistoryPath(): string {
	return path.join(os.homedir(), ".claude", ".oafish-history.jsonl");
}

function pricePerMillion(model: string): number | null {
	for (const [re, price] of OUTPUT_PRICE_PER_M) {
		if (re.test(model)) return price;
	}
	return null;
}

function parseSession(filePath: string): SessionMetrics {
	let turns = 0;
	let outputTokens = 0;
	let cacheReadTokens = 0;
	let model = "";

	let raw: string;
	try {
		raw = fs.readFileSync(filePath, "utf8");
	} catch {
		return { turns: 0, outputTokens: 0, cacheReadTokens: 0, model: "" };
	}

	for (const line of raw.split("\n")) {
		if (!line.trim()) continue;
		try {
			const entry: TurnEntry = JSON.parse(line);
			if (entry.type !== "assistant" || !entry.message) continue;
			turns++;
			if (!model && entry.message.model) model = entry.message.model;
			outputTokens += entry.message.usage?.output_tokens ?? 0;
			cacheReadTokens += entry.message.usage?.cache_read_input_tokens ?? 0;
		} catch {}
	}

	return { turns, outputTokens, cacheReadTokens, model };
}

function estimateSavings(
	outputTokens: number,
	mode: string,
): { savedTokens: number; ratio: number } | null {
	const ratio = COMPRESSION_RATIO[mode];
	if (!ratio) return null;
	const estNormal = outputTokens / (1 - ratio);
	return { savedTokens: Math.round(estNormal - outputTokens), ratio };
}

function estimateCompressFileSavings(): { files: number; tokensSaved: number } {
	let files = 0;
	let tokensSaved = 0;

	const searchDirs = [path.join(os.homedir(), ".claude"), process.cwd()];

	for (const dir of searchDirs) {
		try {
			const entries = fs.readdirSync(dir);
			for (const name of entries) {
				if (!name.endsWith(".original.md")) continue;
				const originalPath = path.join(dir, name);
				const compressedPath = path.join(
					dir,
					name.replace(".original.md", ".md"),
				);
				try {
					const origSize = fs.statSync(originalPath).size;
					const compSize = fs.statSync(compressedPath).size;
					if (compSize < origSize) {
						files++;
						tokensSaved += Math.round((origSize - compSize) / 4);
					}
				} catch {
					/* skip */
				}
			}
		} catch {
			/* dir unreadable */
		}
	}

	return { files, tokensSaved };
}

function formatNum(n: number): string {
	return n.toLocaleString("en-US");
}

const SEP = "─".repeat(38);

export interface StatsOptions {
	transcriptPath?: string;
	mode: string;
	sessionId?: string;
	all?: boolean;
	share?: boolean;
}

export function getStats(opts: StatsOptions): string {
	const { mode, transcriptPath, all, share } = opts;

	if (all) {
		return getLifetimeStats(mode);
	}

	if (!transcriptPath || !fs.existsSync(transcriptPath)) {
		return "oafish: no session file found";
	}

	const metrics = parseSession(transcriptPath);
	const savings = estimateSavings(metrics.outputTokens, mode);
	const compressed = estimateCompressFileSavings();

	if (share) {
		if (!savings)
			return `oafish: ${metrics.outputTokens.toLocaleString()} output tokens - ${metrics.turns} turns`;
		const price = pricePerMillion(metrics.model);
		const usdPart = price
			? ` (~$${((savings.savedTokens / 1_000_000) * price).toFixed(4)})`
			: "";
		return `Saved ${formatNum(savings.savedTokens)} output tokens${usdPart} across ${metrics.turns} turns this session - oafish`;
	}

	const lines: string[] = [
		"Oafish Stats",
		SEP,
		`Session: …${transcriptPath.slice(-40)}`,
		`Mode:    ${mode}`,
		`Turns:   ${metrics.turns}`,
		SEP,
		`Output tokens:       ${formatNum(metrics.outputTokens).padStart(10)}`,
		`Cache-read tokens:   ${formatNum(metrics.cacheReadTokens).padStart(10)}`,
	];

	if (savings) {
		const estNormal = Math.round(metrics.outputTokens / (1 - savings.ratio));
		const price = pricePerMillion(metrics.model);
		const usdSaved = price
			? `~$${((savings.savedTokens / 1_000_000) * price).toFixed(4)}`
			: null;

		lines.push(SEP);
		lines.push(`Est. without oafish:  ${formatNum(estNormal).padStart(10)}`);
		lines.push(
			`Est. tokens saved:   ${formatNum(savings.savedTokens).padStart(10)} (~${Math.round(savings.ratio * 100)}%)`,
		);
		if (usdSaved) {
			lines.push(`Est. saved (USD):    ${usdSaved.padStart(10)}`);
		}
	} else {
		lines.push(SEP);
		lines.push(`Est. tokens saved:     (no ratio for mode '${mode}')`);
	}

	if (compressed.files > 0) {
		lines.push(
			`Compressed files:    ${compressed.files} file${compressed.files > 1 ? "s" : ""}, ~${formatNum(compressed.tokensSaved)} tokens saved/session`,
		);
	}

	lines.push(SEP);

	// Persist to history
	if (savings && metrics.outputTokens > 0) {
		const price = pricePerMillion(metrics.model);
		const usdSaved = price ? (savings.savedTokens / 1_000_000) * price : 0;
		const entry: HistoryEntry = {
			ts: Date.now(),
			session_id: opts.sessionId ?? transcriptPath,
			mode,
			model: metrics.model,
			output_tokens: metrics.outputTokens,
			est_saved_tokens: savings.savedTokens,
			est_saved_usd: usdSaved,
		};
		try {
			fs.appendFileSync(getHistoryPath(), `${JSON.stringify(entry)}\n`, "utf8");
		} catch {
			/* best-effort */
		}
	}

	return lines.join("\n");
}

function getLifetimeStats(_mode: string): string {
	const histPath = getHistoryPath();
	if (!fs.existsSync(histPath)) {
		return "oafish: no history yet - run /oafish stats in a session first";
	}

	const raw = fs.readFileSync(histPath, "utf8");
	const bySession = new Map<string, HistoryEntry>();

	for (const line of raw.split("\n")) {
		if (!line.trim()) continue;
		try {
			const entry: HistoryEntry = JSON.parse(line);
			bySession.set(entry.session_id, entry); // last entry per session wins
		} catch {}
	}

	const entries = [...bySession.values()];
	const totalOutput = entries.reduce((s, e) => s + e.output_tokens, 0);
	const totalSaved = entries.reduce((s, e) => s + e.est_saved_tokens, 0);
	const totalUsd = entries.reduce((s, e) => s + e.est_saved_usd, 0);

	return [
		"Oafish Stats - Lifetime",
		SEP,
		`Sessions: ${entries.length}`,
		SEP,
		`Output tokens:       ${formatNum(totalOutput).padStart(10)}`,
		`Est. tokens saved:   ${formatNum(totalSaved).padStart(10)}`,
		`Est. saved (USD):    $${totalUsd.toFixed(4).padStart(9)}`,
		SEP,
	].join("\n");
}
