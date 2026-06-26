import fs from "fs/promises";
import path from "path";
import { getProjectRoot, getHunoDir } from "../utils/paths.js";
import { readHunoFile } from "../storage/huno-dir.js";
import { readMemoryFile, parseMemoryEntries, searchMemory, appendMemory } from "../storage/memory-file.js";
import { parseProjectMap } from "../storage/project-map.js";
import type { ToolDefinition } from "../providers/chat.js";

const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java",
  ".rb", ".php", ".cs", ".c", ".cpp", ".h", ".hpp", ".swift",
  ".kt", ".scala", ".sh", ".sql", ".css", ".scss", ".html",
  ".vue", ".svelte",
]);

export function projectTools(): ToolDefinition[] {
  return [
    {
      name: "get_project_map",
      description: "Get the project map — a structured summary of the project including languages, frameworks, directories, important files, and scripts. This is useful for understanding the overall project structure.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      handler: async () => {
        const result = await readHunoFile("project-map.json");
        if (!result.ok) {
          return "No project map found. Run `huno explain` or `huno init` first.";
        }
        try {
          const parseResult = parseProjectMap(result.data);
          if (!parseResult.ok) {
            return "Project map is corrupted. Run `huno explain` to regenerate it.";
          }
          const map = parseResult.data;
          const lines: string[] = [
            `## Project: ${map.projectName}`,
            `Languages: ${map.stack.languages.join(", ") || "unknown"}`,
            `Frameworks: ${map.stack.frameworks.join(", ") || "none detected"}`,
            `Database: ${map.stack.database.join(", ") || "none detected"}`,
            `Infrastructure: ${map.stack.infrastructure.join(", ") || "none detected"}`,
            `Package Managers: ${map.packageManagers.join(", ") || "none detected"}`,
            "",
            "### Important Files",
            ...(map.importantFiles.length
              ? map.importantFiles.map((f) => `  - ${f}`)
              : ["  (none)"]),
            "",
            "### Directories",
            ...(Object.keys(map.directories).length
              ? Object.entries(map.directories).map(([name, _dir]) => `  - ${name}/`)
              : ["  (none)"]),
            "",
            "### Scripts",
            ...(Object.keys(map.scripts).length
              ? Object.entries(map.scripts).map(([name, cmd]) => `  - ${name}: \`${cmd}\``)
              : ["  (none)"]),
          ];
          return lines.join("\n");
        } catch {
          return "Failed to read project map.";
        }
      },
    },
    {
      name: "get_memory",
      description: "Search project memory for relevant notes and decisions. Use this to recall project-specific context, decisions, preferences, and notes.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query to find relevant memories" },
        },
        required: [],
      },
      handler: async (args) => {
        const query = (args.query as string) || "";
        const result = await readMemoryFile();
        if (!result.ok) {
          return "No project memory found. Save memories with `huno remember`.";
        }
        const entries = parseMemoryEntries(result.data);
        const matches = query ? searchMemory(entries, query) : entries;
        if (matches.length === 0) {
          return `No memories found for "${query}".`;
        }
        const lines: string[] = [`## Project Memory (${matches.length} entries)`];
        for (const entry of matches) {
          const date = entry.date ? `[${entry.date}] ` : "";
          lines.push(`  - ${date}${entry.text}`);
        }
        return lines.join("\n");
      },
    },
    {
      name: "get_config",
      description: "Read the current Huno configuration including provider settings, permission levels, and UI preferences.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      handler: async () => {
        try {
          const configPath = path.join(getHunoDir(), "config.json");
          const content = await fs.readFile(configPath, "utf-8");
          const config = JSON.parse(content);
          // Redact API keys — show only whether they are configured
          const sanitized = { ...config };
          if (sanitized.apiKeys) {
            const redacted: Record<string, string> = {};
            for (const [key, val] of Object.entries(sanitized.apiKeys)) {
              redacted[key] = val ? "*** configured ***" : "not set";
            }
            sanitized.apiKeys = redacted;
          }
          return JSON.stringify(sanitized, null, 2);
        } catch {
          return "No Huno config found. Run `huno init` first.";
        }
      },
    },
    {
      name: "save_memory",
      description: "Save a project memory or note. Use this to remember project decisions, preferences, architecture choices, or any useful context for future conversations.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Memory text to save (e.g. 'We use JWT auth for the backend')" },
        },
        required: ["text"],
      },
      handler: async (args) => {
        const text = args.text as string;
        if (!text || !text.trim()) {
          return "Cannot save empty memory.";
        }
        const result = await appendMemory(text);
        if (!result.ok) {
          return "Failed to save memory: " + result.error.message;
        }
        return `Memory saved: "${text}"`;
      },
    },
    {
      name: "list_definitions",
      description: "List top-level functions, classes, interfaces, and types in source code files within a directory. Useful for finding code entry points and understanding module structure.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path to scan (relative to project root, default: current directory)" },
          depth: { type: "number", description: "Directory depth to scan (default: 1, max: 3)" },
        },
        required: [],
      },
      handler: async (args) => {
        const root = getProjectRoot();
        const scanPath = args.path ? path.join(root, args.path as string) : root;
        const maxDepth = Math.min((args.depth as number) || 1, 3);

        // Pattern to match top-level definitions
        const defPatterns = [
          /^(export\s+)?(async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/,
          /^(export\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)/,
          /^(export\s+)?interface\s+([A-Za-z_$][A-Za-z0-9_$]*)/,
          /^(export\s+)?type\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/,
          /^(export\s+)?(default\s+)?(function|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/,
          /^(export\s+)?const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[:=]\s*(async\s*)?\(/,
          /^(export\s+)?const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[:=]\s*\(/,
          /^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/,
          /^class\s+([A-Za-z_][A-Za-z0-9_]*)/,
          /^async\s+def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/,
          /^pub\s+(fn|struct|enum|trait|impl|const|type|async fn)\s+([A-Za-z_][A-Za-z0-9_]*)/,
          /^func\s+([A-Za-z_][A-Za-z0-9_]*)\s+/, // Go
          /^fun\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/,  // Kotlin
        ];

        const results: { file: string; defs: { type: string; name: string; line: number }[] }[] = [];

        async function scanDir(dir: string, depth: number): Promise<void> {
          if (depth > maxDepth) return;
          let entries;
          try {
            entries = await fs.readdir(dir, { withFileTypes: true });
          } catch {
            return;
          }
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".huno") continue;
            if (entry.name.startsWith(".")) continue;
            if (entry.isDirectory()) {
              await scanDir(fullPath, depth + 1);
            } else if (entry.isFile() && CODE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
              try {
                const content = await fs.readFile(fullPath, "utf-8");
                const lines = content.split("\n");
                const defs: { type: string; name: string; line: number }[] = [];
                for (let i = 0; i < lines.length; i++) {
                  const trimmed = lines[i].trim();
                  for (const pattern of defPatterns) {
                    const match = trimmed.match(pattern);
                    if (match) {
                      // Determine capture group — varies by pattern
                      let name = "";
                      let type = "function";
                      if (pattern.source.includes("^pub\\s+")) {
                        name = match[2];
                        type = match[1] || "fn";
                      } else if (pattern.source.includes("^class\\s+") || pattern.source.includes("(?:\\.*)?class\\s+")) {
                        name = match[match.length - 2] || match[2];
                        type = "class";
                      } else {
                        // Find the name capture (varies by pattern)
                        const nameCapture = match.find((_, i) => i > 0 && match[i] && /^[A-Za-z_]/.test(match[i]) && match[i] !== "export" && match[i] !== "async" && match[i] !== "default" && match[i] !== "function" && match[i] !== "class" && match[i] !== "const" && match[i] !== "pub" && match[i] !== "fn" && match[i] !== "struct" && match[i] !== "enum" && match[i] !== "trait" && match[i] !== "impl" && match[i] !== "type");
                        name = nameCapture || match[match.length - 1];
                      }
                      if (name) {
                        defs.push({ type: type.includes("interface") ? "interface" : type.includes("type") ? "type" : type.includes("class") ? "class" : type.includes("fn") || type.includes("func") || type.includes("fun") ? "function" : type, name, line: i + 1 });
                      }
                      break;
                    }
                  }
                }
                if (defs.length > 0) {
                  const relPath = path.relative(root, fullPath);
                  results.push({ file: relPath, defs });
                }
              } catch {
                // skip unreadable
              }
            }
          }
        }

        await scanDir(scanPath, 1);

        if (results.length === 0) {
          return "No definitions found.";
        }

        const lines: string[] = ["## Definitions Found"];
        // Sort by file path
        results.sort((a, b) => a.file.localeCompare(b.file));
        for (const { file, defs } of results) {
          lines.push(`\n### ${file}`);
          for (const d of defs) {
            const icon = d.type === "class" ? "▧" : d.type === "interface" ? "◇" : d.type === "type" ? "▸" : "ƒ";
            lines.push(`  ${icon} ${d.name} (${d.type}, line ${d.line})`);
          }
        }

        const total = results.reduce((sum, r) => sum + r.defs.length, 0);
        lines.push(`\nTotal: ${total} definitions in ${results.length} files`);

        return lines.join("\n");
      },
    },
  ];
}