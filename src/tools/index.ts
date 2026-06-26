import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
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
      description: "Find and replace text in a file. The old_string must be unique.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative or absolute file path" },
          old_string: { type: "string", description: "Text to find and replace" },
          new_string: { type: "string", description: "Replacement text" },
        },
        required: ["path", "old_string", "new_string"],
      },
      handler: async (args) => {
        const fullPath = resolvePath(args.path as string);
        try {
          const content = await fs.readFile(fullPath, "utf-8");
          if (!content.includes(args.old_string as string)) {
            return "Error: old_string not found in " + args.path;
          }
          const updated = content.replace(args.old_string as string, args.new_string as string);
          await fs.writeFile(fullPath, updated, "utf-8");
          return "Patched " + args.path;
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
      description: "Execute a shell command and return its output.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to execute" },
          timeout: { type: "number", description: "Timeout in seconds (default 30)" },
        },
        required: ["command"],
      },
      handler: async (args) => {
        try {
          const timeout = ((args.timeout as number) || 30) * 1000;
          const output = execSync(args.command as string, {
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
  ];
}

export function allTools(): ToolDefinition[] {
  return [...fileTools(), ...terminalTools(), ...gitTools(), ...projectTools(), ...webTools(), ...codeTools(), ...envTools()];
}
