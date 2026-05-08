#!/usr/bin/env node
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};

// hooks/src/tracker.ts
var import_node_fs2 = __toESM(require("node:fs"));

// hooks/src/config.ts
var import_node_fs = __toESM(require("node:fs"));
var import_node_path = __toESM(require("node:path"));
var import_node_os = __toESM(require("node:os"));
var VALID_MODES = ["off", "lite", "full", "ultra"];
var MAX_FLAG_BYTES = 32;
function getConfigDir() {
  if (process.env.XDG_CONFIG_HOME) {
    return import_node_path.default.join(process.env.XDG_CONFIG_HOME, "terse");
  }
  if (process.platform === "win32") {
    return import_node_path.default.join(process.env.APPDATA || import_node_path.default.join(import_node_os.default.homedir(), "AppData", "Roaming"), "terse");
  }
  return import_node_path.default.join(import_node_os.default.homedir(), ".config", "terse");
}
function getFlagPath() {
  return import_node_path.default.join(getConfigDir(), ".active");
}
function getDefaultMode() {
  const env = process.env.TERSE_DEFAULT_MODE?.toLowerCase();
  if (env && VALID_MODES.includes(env))
    return env;
  try {
    const cfg = JSON.parse(import_node_fs.default.readFileSync(import_node_path.default.join(getConfigDir(), "config.json"), "utf8"));
    if (cfg.defaultMode && VALID_MODES.includes(cfg.defaultMode.toLowerCase())) {
      return cfg.defaultMode.toLowerCase();
    }
  } catch {}
  return "full";
}
function safeWriteFlag(flagPath, content) {
  const debug = process.env.TERSE_DEBUG === "1";
  try {
    const flagDir = import_node_path.default.dirname(flagPath);
    import_node_fs.default.mkdirSync(flagDir, { recursive: true });
    let realFlagDir;
    try {
      const lstat = import_node_fs.default.lstatSync(flagDir);
      if (lstat.isSymbolicLink()) {
        realFlagDir = import_node_fs.default.realpathSync(flagDir);
        const realStat = import_node_fs.default.statSync(realFlagDir);
        if (!realStat.isDirectory())
          return;
        if (typeof process.getuid === "function") {
          if (realStat.uid !== process.getuid()) {
            if (debug)
              process.stderr.write(`[terse] safeWriteFlag: symlink target owned by uid ${realStat.uid}
`);
            return;
          }
        } else {
          const home = import_node_path.default.resolve(import_node_os.default.homedir());
          const real = import_node_path.default.resolve(realFlagDir).toLowerCase();
          if (!real.startsWith(home.toLowerCase() + import_node_path.default.sep) && real !== home.toLowerCase())
            return;
        }
      } else {
        realFlagDir = flagDir;
      }
    } catch {
      return;
    }
    const realFlagPath = import_node_path.default.join(realFlagDir, import_node_path.default.basename(flagPath));
    try {
      if (import_node_fs.default.lstatSync(realFlagPath).isSymbolicLink())
        return;
    } catch (e) {
      if (e.code !== "ENOENT")
        return;
    }
    const tempPath = import_node_path.default.join(realFlagDir, `.terse-active.${process.pid}.${Date.now()}`);
    const O_NOFOLLOW = import_node_fs.default.constants.O_NOFOLLOW ?? 0;
    const openFlags = import_node_fs.default.constants.O_WRONLY | import_node_fs.default.constants.O_CREAT | import_node_fs.default.constants.O_EXCL | O_NOFOLLOW;
    let fd;
    try {
      fd = import_node_fs.default.openSync(tempPath, openFlags, 384);
      import_node_fs.default.writeSync(fd, String(content));
      try {
        import_node_fs.default.fchmodSync(fd, 384);
      } catch {}
    } finally {
      if (fd !== undefined)
        import_node_fs.default.closeSync(fd);
    }
    import_node_fs.default.renameSync(tempPath, realFlagPath);
  } catch {}
}
function readFlag(flagPath) {
  try {
    let st;
    try {
      st = import_node_fs.default.lstatSync(flagPath);
    } catch {
      return null;
    }
    if (st.isSymbolicLink() || !st.isFile())
      return null;
    if (st.size > MAX_FLAG_BYTES)
      return null;
    const O_NOFOLLOW = import_node_fs.default.constants.O_NOFOLLOW ?? 0;
    const openFlags = import_node_fs.default.constants.O_RDONLY | O_NOFOLLOW;
    let fd;
    let out;
    try {
      fd = import_node_fs.default.openSync(flagPath, openFlags);
      const buf = Buffer.alloc(MAX_FLAG_BYTES);
      const n = import_node_fs.default.readSync(fd, buf, 0, MAX_FLAG_BYTES, 0);
      out = buf.slice(0, n).toString("utf8");
    } finally {
      if (fd !== undefined)
        import_node_fs.default.closeSync(fd);
    }
    const raw = out.trim().toLowerCase();
    if (!VALID_MODES.includes(raw))
      return null;
    return raw;
  } catch {
    return null;
  }
}

// hooks/src/tracker.ts
var flagPath = getFlagPath();
var input = "";
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  try {
    const data = JSON.parse(input);
    const prompt = (data.prompt || "").trim();
    const lower = prompt.toLowerCase();
    if (/\b(activate|enable|turn on|start|use)\b.*\bterse\b/i.test(prompt) || /\bterse\b.*\b(mode|on|activate|enable)\b/i.test(prompt) || /\bless tokens\b/i.test(prompt) || /\bbe brief\b/i.test(prompt)) {
      if (!/\b(stop|disable|turn off|deactivate)\b/i.test(prompt)) {
        const mode = getDefaultMode();
        if (mode !== "off")
          safeWriteFlag(flagPath, mode);
      }
    }
    if (/\b(stop|disable|deactivate|turn off)\b.*\bterse\b/i.test(prompt) || /\bterse\b.*\b(stop|disable|deactivate|turn off)\b/i.test(prompt) || /\bnormal mode\b/i.test(lower)) {
      try {
        import_node_fs2.default.unlinkSync(flagPath);
      } catch {}
    }
    if (lower.startsWith("/terse")) {
      const parts = lower.split(/\s+/);
      const arg = parts[1] || "";
      if (arg === "off" || arg === "stop" || arg === "disable") {
        try {
          import_node_fs2.default.unlinkSync(flagPath);
        } catch {}
      } else if (VALID_MODES.includes(arg) && arg !== "off") {
        safeWriteFlag(flagPath, arg);
      } else if (!arg) {
        const mode = getDefaultMode();
        if (mode !== "off")
          safeWriteFlag(flagPath, mode);
      }
    }
    const activeMode = readFlag(flagPath);
    if (activeMode && activeMode !== "off") {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: `TERSE MODE ACTIVE (${activeMode}). ` + `Drop articles/filler/pleasantries/hedging. Fragments OK. ` + `Code/commits/security: write normal.`
        }
      }));
    }
  } catch {}
});
