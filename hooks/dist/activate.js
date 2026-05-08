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

// hooks/src/activate.ts
var import_node_fs2 = __toESM(require("node:fs"));
var import_node_path2 = __toESM(require("node:path"));
var import_node_os2 = __toESM(require("node:os"));

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

// hooks/src/activate.ts
var __dirname = "/home/bitclaw/code/github/bitclaw/public/terse/hooks/src";
var claudeDir = process.env.CLAUDE_CONFIG_DIR || import_node_path2.default.join(import_node_os2.default.homedir(), ".claude");
var settingsPath = import_node_path2.default.join(claudeDir, "settings.json");
var flagPath = getFlagPath();
var mode = getDefaultMode();
if (mode === "off") {
  try {
    import_node_fs2.default.unlinkSync(flagPath);
  } catch {}
  process.stdout.write("OK");
  process.exit(0);
}
safeWriteFlag(flagPath, mode);
var skillContent = "";
try {
  skillContent = import_node_fs2.default.readFileSync(import_node_path2.default.join(__dirname, "..", "..", "skills", "terse", "SKILL.md"), "utf8");
} catch {}
var output;
if (skillContent) {
  const body = skillContent.replace(/^---[\s\S]*?---\s*/, "");
  const filtered = body.split(`
`).reduce((acc, line) => {
    const tableRow = line.match(/^\|\s*\*\*(\S+?)\*\*\s*\|/);
    if (tableRow) {
      if (tableRow[1] === mode)
        acc.push(line);
      return acc;
    }
    const exampleLine = line.match(/^- (\S+?):\s/);
    if (exampleLine) {
      if (exampleLine[1] === mode)
        acc.push(line);
      return acc;
    }
    acc.push(line);
    return acc;
  }, []);
  output = `TERSE MODE ACTIVE — level: ${mode}

${filtered.join(`
`)}`;
} else {
  output = `TERSE MODE ACTIVE — level: ${mode}

` + `Respond concise. Drop fluff. Keep full technical accuracy.

` + `Drop: articles, filler (just/really/basically/simply), pleasantries, hedging. ` + `Fragments OK. Short synonyms. Technical terms exact. Code unchanged.

` + `Pattern: [thing] [action] [reason]. [next step].

` + `Auto-clarity: drop terse for security warnings, irreversible ops, ambiguous sequences. Resume after.

` + `"stop terse" or "normal mode" to revert. Level: ${mode}. Switch: /terse lite|full|ultra.`;
}
try {
  let hasStatusline = false;
  if (import_node_fs2.default.existsSync(settingsPath)) {
    const settings = JSON.parse(import_node_fs2.default.readFileSync(settingsPath, "utf8"));
    if (settings.statusLine)
      hasStatusline = true;
  }
  if (!hasStatusline) {
    const scriptPath = import_node_path2.default.join(__dirname, "..", "statusline");
    const cmd = `bash "${scriptPath}"`;
    const snippet = `"statusLine": { "type": "command", "command": ${JSON.stringify(cmd)} }`;
    output += `

STATUSLINE SETUP NEEDED: terse includes a statusline badge ([TERSE], [TERSE:ULTRA]). ` + `Not configured yet. Add to ${settingsPath}: ${snippet}. ` + `Offer to set this up for user on first interaction.`;
  }
} catch {}
process.stdout.write(output);
