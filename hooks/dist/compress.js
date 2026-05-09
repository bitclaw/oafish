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

// hooks/src/config.ts
var import_node_fs = __toESM(require("node:fs"));
var import_node_path = __toESM(require("node:path"));
var import_node_os = __toESM(require("node:os"));
var VALID_MODES = ["off", "lite", "full", "ultra"];
var MAX_FLAG_BYTES = 32;
function getConfigDir() {
  if (process.env.XDG_CONFIG_HOME) {
    return import_node_path.default.join(process.env.XDG_CONFIG_HOME, "oafish");
  }
  if (process.platform === "win32") {
    return import_node_path.default.join(process.env.APPDATA || import_node_path.default.join(import_node_os.default.homedir(), "AppData", "Roaming"), "oafish");
  }
  return import_node_path.default.join(import_node_os.default.homedir(), ".config", "oafish");
}
function getFlagPath() {
  return import_node_path.default.join(getConfigDir(), ".active");
}
function getDefaultMode() {
  const env = process.env.OAFISH_DEFAULT_MODE?.toLowerCase();
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
  const debug = process.env.OAFISH_DEBUG === "1";
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
              process.stderr.write(`[oafish] safeWriteFlag: symlink target owned by uid ${realStat.uid}
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
    const tempPath = import_node_path.default.join(realFlagDir, `.oafish-active.${process.pid}.${Date.now()}`);
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

// hooks/src/compress.ts
var MIN_LINES = 40;
var MIN_CHARS = 1500;
function isMcpTool(name) {
  return name.startsWith("mcp__");
}
function extractText(response) {
  if (typeof response === "string")
    return response;
  if (response && typeof response === "object") {
    const r = response;
    if (typeof r.output === "string")
      return r.output;
    if (typeof r.stdout === "string")
      return r.stdout;
    if (typeof r.content === "string")
      return r.content;
    try {
      return JSON.stringify(response);
    } catch {
      return "";
    }
  }
  return String(response ?? "");
}
function isVerbose(text) {
  return text.split(`
`).length >= MIN_LINES || text.length >= MIN_CHARS;
}
function digestCode(text, filename) {
  const lines = text.split(`
`);
  const lineCount = lines.length;
  const ext = filename.split(".").pop() ?? "";
  const fns = [];
  const imports = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^import\s|^from\s|^const\s.*=\s*require/.test(t) && imports.length < 4) {
      imports.push(t.slice(0, 60));
    }
    if (/^(export\s+)?(async\s+)?function\s+\w|^(export\s+)?(abstract\s+)?class\s+\w|^\s*(public|private|protected|static|async)?\s*(async\s+)?\w+\s*\(/.test(t) && fns.length < 8) {
      fns.push(t.replace(/\{.*/, "").trim().slice(0, 70));
    }
  }
  const parts = [`${lineCount}L`];
  if (ext)
    parts.push(ext);
  if (fns.length)
    parts.push(`fns: ${fns.slice(0, 5).join(", ")}`);
  return `[oafish] Read: ${filename} — ${parts.join(" | ")}`;
}
function digestBash(response, cmd) {
  const r = response;
  const stdout = String(r.stdout ?? "");
  const stderr = String(r.stderr ?? "");
  const code = r.returnCode ?? r.exit_code ?? r.exitCode ?? 0;
  const lines = stdout.split(`
`).filter(Boolean);
  const errLines = stderr.split(`
`).filter(Boolean);
  if (Number(code) !== 0) {
    const relevant = [...errLines, ...lines.slice(-5)].slice(0, 8);
    return `[oafish] Bash(exit ${code}): ${relevant.join(" | ").slice(0, 200)}`;
  }
  const testMatch = stdout.match(/(\d+)\s+pass(?:ing)?[^\n]*(\d+\s+fail(?:ing)?)?/i);
  if (testMatch) {
    return `[oafish] Bash: ${testMatch[0].trim()}`;
  }
  const summary = lines[0]?.slice(0, 100) ?? "";
  return `[oafish] Bash(${lines.length}L): ${summary}${lines.length > 1 ? " …" : ""}`;
}
function compressMcp(response) {
  try {
    const text = typeof response === "string" ? response : JSON.stringify(response);
    return text.replace(/\s+/g, " ").slice(0, 800);
  } catch {
    return String(response).slice(0, 800);
  }
}
var input = "";
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  try {
    const data = JSON.parse(input);
    const { tool_name, tool_input, tool_response } = data;
    const mode = readFlag(getFlagPath());
    if (!mode || mode === "off")
      process.exit(0);
    const text = extractText(tool_response);
    if (!isVerbose(text))
      process.exit(0);
    let additionalContext;
    let updatedMCPToolOutput;
    if (tool_name === "Read") {
      const filename = String(tool_input.file_path ?? tool_input.path ?? "file").split("/").pop() ?? "file";
      additionalContext = digestCode(text, filename);
    } else if (tool_name === "Bash") {
      additionalContext = digestBash(tool_response, String(tool_input.command ?? "").slice(0, 60));
    } else if (isMcpTool(tool_name)) {
      const compressed = compressMcp(tool_response);
      additionalContext = `[oafish] ${tool_name}: ${compressed}`;
      updatedMCPToolOutput = compressed;
    }
    if (!additionalContext)
      process.exit(0);
    const out = {
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext,
        ...updatedMCPToolOutput !== undefined ? { updatedMCPToolOutput } : {}
      }
    };
    process.stdout.write(JSON.stringify(out));
  } catch {}
});
