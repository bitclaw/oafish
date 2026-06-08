import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const VALID_MODES = ["off", "lite", "full", "ultra"] as const;
export type Mode = (typeof VALID_MODES)[number];

const MAX_FLAG_BYTES = 32;

export function getConfigDir(): string {
	if (process.env.XDG_CONFIG_HOME) {
		return path.join(process.env.XDG_CONFIG_HOME, "oafish");
	}
	if (process.platform === "win32") {
		return path.join(
			process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
			"oafish",
		);
	}
	return path.join(os.homedir(), ".config", "oafish");
}

export function getFlagPath(): string {
	return path.join(getConfigDir(), ".active");
}

export function getOffFlagPath(): string {
	return path.join(getConfigDir(), ".off");
}

export function getDefaultMode(): Mode {
	const env = process.env.OAFISH_DEFAULT_MODE?.toLowerCase();
	if (env && VALID_MODES.includes(env as Mode)) return env as Mode;

	try {
		const cfg = JSON.parse(
			fs.readFileSync(path.join(getConfigDir(), "config.json"), "utf8"),
		);
		if (
			cfg.defaultMode &&
			VALID_MODES.includes(cfg.defaultMode.toLowerCase())
		) {
			return cfg.defaultMode.toLowerCase() as Mode;
		}
	} catch {
		// no config file - fall through
	}

	return "full";
}

// Symlink-safe flag write. Atomic temp+rename, 0600 perms.
// Refuses if flag target or parent is an attacker-planted symlink.
export function safeWriteFlag(flagPath: string, content: string): void {
	const debug = process.env.OAFISH_DEBUG === "1";
	try {
		const flagDir = path.dirname(flagPath);
		fs.mkdirSync(flagDir, { recursive: true });

		let realFlagDir: string;
		try {
			const lstat = fs.lstatSync(flagDir);
			if (lstat.isSymbolicLink()) {
				realFlagDir = fs.realpathSync(flagDir);
				const realStat = fs.statSync(realFlagDir);
				if (!realStat.isDirectory()) return;
				if (typeof process.getuid === "function") {
					if (realStat.uid !== process.getuid()) {
						if (debug)
							process.stderr.write(
								`[oafish] safeWriteFlag: symlink target owned by uid ${realStat.uid}\n`,
							);
						return;
					}
				} else {
					const home = path.resolve(os.homedir());
					const real = path.resolve(realFlagDir).toLowerCase();
					if (
						!real.startsWith(home.toLowerCase() + path.sep) &&
						real !== home.toLowerCase()
					)
						return;
				}
			} else {
				realFlagDir = flagDir;
			}
		} catch {
			return;
		}

		const realFlagPath = path.join(realFlagDir, path.basename(flagPath));
		try {
			if (fs.lstatSync(realFlagPath).isSymbolicLink()) return;
		} catch (e: unknown) {
			if ((e as NodeJS.ErrnoException).code !== "ENOENT") return;
		}

		const tempPath = path.join(
			realFlagDir,
			`.oafish-active.${process.pid}.${Date.now()}`,
		);
		const O_NOFOLLOW = (fs.constants.O_NOFOLLOW as number | undefined) ?? 0;
		const openFlags =
			fs.constants.O_WRONLY |
			fs.constants.O_CREAT |
			fs.constants.O_EXCL |
			O_NOFOLLOW;
		let fd: number | undefined;
		try {
			fd = fs.openSync(tempPath, openFlags, 0o600);
			fs.writeSync(fd, String(content));
			try {
				fs.fchmodSync(fd, 0o600);
			} catch {
				/* best-effort Windows */
			}
		} finally {
			if (fd !== undefined) fs.closeSync(fd);
		}
		fs.renameSync(tempPath, realFlagPath);
	} catch {
		// silent fail - flag is best-effort
	}
}

// Symlink-safe flag read. Returns null on any anomaly.
export function readFlag(flagPath: string): Mode | null {
	try {
		let st: fs.Stats;
		try {
			st = fs.lstatSync(flagPath);
		} catch {
			return null;
		}
		if (st.isSymbolicLink() || !st.isFile()) return null;
		if (st.size > MAX_FLAG_BYTES) return null;

		const O_NOFOLLOW = (fs.constants.O_NOFOLLOW as number | undefined) ?? 0;
		const openFlags = fs.constants.O_RDONLY | O_NOFOLLOW;
		let fd: number | undefined;
		let out: string;
		try {
			fd = fs.openSync(flagPath, openFlags);
			const buf = Buffer.alloc(MAX_FLAG_BYTES);
			const n = fs.readSync(fd, buf, 0, MAX_FLAG_BYTES, 0);
			out = buf.slice(0, n).toString("utf8");
		} finally {
			if (fd !== undefined) fs.closeSync(fd);
		}

		const raw = out.trim().toLowerCase() as Mode;
		if (!VALID_MODES.includes(raw)) return null;
		return raw;
	} catch {
		return null;
	}
}
