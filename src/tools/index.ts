import fs from "fs/promises";
import path from "path";
import { execSync, spawn } from "child_process";
import type { ToolDefinition } from "../providers/chat.js";
import { getProjectRoot } from "../utils/paths.js";
import { gitTools } from "./git.js";
import { projectTools } from "./project.js";
import { webTools, codeTools, envTools } from "./web.js";

function resolvePath(input: string): string {
  return path.isAbsolute(input) ? input : path.join(getProjectRoot(), input);
}

export function fileTools(): ToolDefinition[] {
  return [
    {
      name: "read_file",
      description: "Read the contents of a file. Supports offset and limit for large files.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative or absolute file path" },
          offset: { type: "number", description: "Line number to start from (1-indexed)" },
          limit: { type: "number", description: "Maximum number of lines to read" },
        },
        required: ["path"],
      },
      handler: async (args) => {
        const fullPath = resolvePath(args.path as string);
        let content: string;
        try {
          content = await fs.readFile(fullPath, "utf-8");
        } catch (err) {
          return "Error reading file: " + (err instanceof Error ? err.message : String(err));
        }
        if (args.offset || args.limit) {
          const lines = content.split("\n");
          const start = (args.offset as number) || 1;
          const end = args.limit ? start + (args.limit as number) - 1 : lines.length;
          return lines.slice(start - 1, end).join("\n");
        }
        return content;
      },
    },
    {
      name: "write_file",
      description: "Write content to a file. Creates parent directories if needed.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative or absolute file path" },
          content: { type: "string", description: "File content to write" },
        },
        required: ["path", "content"],
      },
      handler: async (args) => {
        const fullPath = resolvePath(args.path as string);
        try {
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, args.content as string, "utf-8");
          return "Written to " + args.path;
        } catch (err) {
          return "Error writing file: " + (err instanceof Error ? err.message : String(err));
        }
      },
      approval: "always",
    },
    {
      name: "patch_file",
      description: "Find and replace text in a file. Supports context lines for precise matching. The old_string must be unique in the file. Use replace_all=true for global replacement.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative or absolute file path" },
          old_string: { type: "string", description: "Text to find and replace (include surrounding context for uniqueness)" },
          new_string: { type: "string", description: "Replacement text" },
          replace_all: { type: "boolean", description: "Replace all occurrences instead of requiring a unique match" },
        },
        required: ["path", "old_string", "new_string"],
      },
      handler: async (args) => {
        const fullPath = resolvePath(args.path as string);
        try {
          const content = await fs.readFile(fullPath, "utf-8");
          const oldStr = args.old_string as string;
          const newStr = args.new_string as string;
          const replaceAll = args.replace_all as boolean;

          if (!content.includes(oldStr)) {
            return "Error: old_string not found in " + args.path + ". Make sure to match whitespace and indentation exactly.";
          }

          if (!replaceAll) {
            const firstIdx = content.indexOf(oldStr);
            const secondIdx = content.indexOf(oldStr, firstIdx + 1);
            if (secondIdx !== -1) {
              const occurrences = content.split(oldStr).length - 1;
              return `Error: old_string is not unique in ${args.path} (${occurrences} matches). Add more context lines to old_string, or set replace_all=true.`;
            }
          }

          const updated = replaceAll ? content.split(oldStr).join(newStr) : content.replace(oldStr, newStr);
          await fs.writeFile(fullPath, updated, "utf-8");

          // Show diff summary
          const oldLines = oldStr.split("\n").length;
          const newLines = newStr.split("\n").length;
          return `Patched ${args.path}: ${oldLines} lines → ${newLines} lines`;
        } catch (err) {
          return "Error patching file: " + (err instanceof Error ? err.message : String(err));
        }
      },
      approval: "always",
    },
    {
      name: "list_files",
      description: "List files in a directory. Supports glob patterns.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path (relative or absolute)" },
          pattern: { type: "string", description: "Glob pattern to filter files (e.g. *.ts)" },
        },
        required: ["path"],
      },
      handler: async (args) => {
        const fullPath = resolvePath(args.path as string);
        try {
          let entries = await fs.readdir(fullPath, { withFileTypes: true });
          if (args.pattern) {
            const pat = (args.pattern as string).replace(/\*/g, ".*").replace(/\?/g, ".");
            const regex = new RegExp("^" + pat + "$");
            entries = entries.filter((e) => regex.test(e.name));
          }
          return entries.map((e) => (e.isDirectory() ? e.name + "/" : e.name)).join("\n");
        } catch (err) {
          return "Error listing directory: " + (err instanceof Error ? err.message : String(err));
        }
      },
    },
    {
      name: "search_files",
      description: "Search file contents for a pattern (like grep -r).",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Text pattern to search for" },
          path: { type: "string", description: "Directory to search in" },
        },
        required: ["pattern"],
      },
      handler: async (args) => {
        const searchPath = resolvePath((args.path as string) || ".");
        const pattern = args.pattern as string;
        const results: string[] = [];

        async function scan(dir: string) {
          let entries;
          try {
            entries = await fs.readdir(dir, { withFileTypes: true });
          } catch {
            return;
          }
          for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".huno") continue;
            if (entry.isDirectory()) {
              await scan(full);
            } else if (entry.isFile() && /\.(ts|js|tsx|jsx|py|go|rs|java|rb|php|c|cpp|h|hpp|css|html|md|json|yaml|yml|toml)$/.test(entry.name)) {
              try {
                const content = await fs.readFile(full, "utf-8");
                if (content.includes(pattern)) {
                  const rel = path.relative(getProjectRoot(), full);
                  const lines = content.split("\n");
                  const matching = lines
                    .map((line, i) => ({ line, i }))
                    .filter(({ line }) => line.includes(pattern))
                    .slice(0, 3)
                    .map(({ line, i }) => `  ${i + 1}: ${line.trim()}`)
                    .join("\n");
                  results.push(`${rel}:\n${matching}`);
                }
              } catch {
                // skip unreadable
              }
            }
          }
        }

        await scan(searchPath);
        return results.length ? results.join("\n\n") : "No matches found.";
      },
    },
  ];
}

export function terminalTools(): ToolDefinition[] {
  return [
    {
      name: "run_command",
      description: "Execute a shell command and return its output. Supports background mode for long-running processes (dev servers, watchers).",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to execute" },
          timeout: { type: "number", description: "Timeout in seconds (default 30)" },
          background: { type: "boolean", description: "Run in background (non-blocking). Returns process ID for later use with kill_process." },
        },
        required: ["command"],
      },
      handler: async (args) => {
        const cmd = args.command as string;
        const timeout = ((args.timeout as number) || 30) * 1000;
        const background = args.background as boolean;

        if (background) {
          // Spawn background process
          const child = spawn("sh", ["-c", cmd], {
            cwd: getProjectRoot(),
            stdio: ["pipe", "pipe", "pipe"],
            detached: false,
          });

          const pid = child.pid!;
          // Store for later kill
          if (!globalThis.__huno_bg_procs) globalThis.__huno_bg_procs = new Map();
          globalThis.__huno_bg_procs.set(pid, child);

          // Capture first N bytes of output
          let output = "";
          child.stdout?.on("data", (d: Buffer) => { if (output.length < 2000) output += d.toString(); });
          child.stderr?.on("data", (d: Buffer) => { if (output.length < 2000) output += d.toString(); });

          // Wait briefly for initial output
          await new Promise<void>((resolve) => setTimeout(resolve, 500));

          return `Background process started (PID: ${pid}).\nCommand: ${cmd}\n${output ? "Initial output:\n" + output : "(waiting for output...)"}`;
        }

        // Foreground (blocking)
        try {
          const output = execSync(cmd, {
            cwd: getProjectRoot(),
            encoding: "utf-8",
            timeout,
            stdio: ["pipe", "pipe", "pipe"],
          });
          return output || "(no output)";
        } catch (err: any) {
          if (err.status) return "Exit code " + err.status + ": " + (err.stderr || err.message);
          return "Error: " + err.message;
        }
      },
      approval: "always",
    },
    {
      name: "kill_process",
      description: "Kill a background process by PID. Use this to stop dev servers, watchers, or other long-running processes started with run_command.",
      parameters: {
        type: "object",
        properties: {
          pid: { type: "number", description: "Process ID to kill" },
        },
        required: ["pid"],
      },
      handler: async (args) => {
        const pid = args.pid as number;
        if (!globalThis.__huno_bg_procs) return "No background processes running.";
        const child = globalThis.__huno_bg_procs.get(pid);
        if (!child) return `Process ${pid} not found. /processes to list active ones.`;
        try {
          child.kill("SIGTERM");
          globalThis.__huno_bg_procs.delete(pid);
          return `Killed process ${pid}.`;
        } catch (err) {
          return `Error killing ${pid}: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    },
  ];
}

// Type augmentation for background process tracking
declare global {
  var __huno_bg_procs: Map<number, any> | undefined;
}

export function allTools(): ToolDefinition[] {
  return [...fileTools(), ...terminalTools(), ...gitTools(), ...projectTools(), ...webTools(), ...codeTools(), ...envTools()];
}
