import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import type { ToolDefinition } from "../providers/chat.js";
import { getProjectRoot } from "../utils/paths.js";
import { VERSION } from "../utils/version.js";

function resolvePath(input: string): string {
  return path.isAbsolute(input) ? input : path.join(getProjectRoot(), input);
}

function runCmd(cmd: string, cwd?: string): { ok: boolean; output: string } {
  try {
    const out = execSync(cmd, {
      cwd: cwd || getProjectRoot(),
      encoding: "utf-8",
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { ok: true, output: out || "(no output)" };
  } catch (err: any) {
    return { ok: false, output: (err.stderr || err.message || String(err)).trim() };
  }
}

/**
 * Web & Network tools — fetch URLs, check APIs, read HTTP endpoints.
 */
export function webTools(): ToolDefinition[] {
  return [
    {
      name: "fetch_url",
      description: "Fetch the content of a URL (HTTP GET). Returns response body as text. Useful for reading docs, checking API responses, or downloading content. Supports JSON APIs.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to fetch" },
          method: { type: "string", description: "HTTP method (GET, POST, PUT, DELETE). Default: GET" },
          headers: { type: "object", description: "HTTP headers as key-value pairs" },
          body: { type: "string", description: "Request body (for POST/PUT)" },
        },
        required: ["url"],
      },
      handler: async (args) => {
        const url = args.url as string;
        const method = (args.method as string) || "GET";
        const headers = (args.headers as Record<string, string>) || {};
        const body = args.body as string | undefined;

        try {
          const response = await fetch(url, {
            method,
            headers: { "User-Agent": `Huno/${VERSION}`, ...headers },
            body: body ? String(body) : undefined,
            signal: AbortSignal.timeout(15000),
          });

          const text = await response.text();
          const truncated = text.length > 8000 ? text.slice(0, 8000) + `\n... (truncated, ${text.length} total chars)` : text;

          return `## ${method} ${url}\nStatus: ${response.status} ${response.statusText}\n\n${truncated}`;
        } catch (err) {
          return `Error fetching ${url}: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    },
  ];
}

/**
 * Code intelligence tools — AST-level operations, dependency analysis, code metrics.
 */
export function codeTools(): ToolDefinition[] {
  return [
    {
      name: "find_references",
      description: "Find all references/occurrences of a symbol (function, class, variable, type) across the codebase. More precise than search_files because it matches whole identifiers, not substrings.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Symbol name to find references for (e.g. 'authenticate', 'UserModel', 'API_KEY')" },
          path: { type: "string", description: "Directory to search in (default: project root)" },
        },
        required: ["symbol"],
      },
      handler: async (args) => {
        const symbol = args.symbol as string;
        const searchPath = resolvePath((args.path as string) || ".");
        const root = getProjectRoot();
        const results: string[] = [];

        // Word-boundary regex to match whole identifier
        const regex = new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);

        async function scan(dir: string): Promise<void> {
          let entries;
          try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
          for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (["node_modules", ".git", ".huno", "dist", "build", ".next", "__pycache__"].includes(entry.name)) continue;
            if (entry.isDirectory()) { await scan(full); continue; }
            if (!entry.isFile()) continue;
            if (!/\.(ts|tsx|js|jsx|py|go|rs|java|rb|php|css|html|json|yaml|yml|toml|md)$/.test(entry.name)) continue;
            try {
              const content = await fs.readFile(full, "utf-8");
              const lines = content.split("\n");
              const matches: string[] = [];
              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  matches.push(`  L${i + 1}: ${lines[i].trim().slice(0, 100)}`);
                  if (matches.length >= 5) break;
                }
              }
              if (matches.length > 0) {
                const rel = path.relative(root, full);
                results.push(`${rel} (${matches.length}+ refs)\n${matches.join("\n")}`);
              }
            } catch { /* skip */ }
          }
        }

        await scan(searchPath);
        return results.length > 0
          ? `## References to "${symbol}"\n\n${results.join("\n\n")}`
          : `No references found for "${symbol}".`;
      },
    },
    {
      name: "analyze_dependencies",
      description: "Analyze project dependencies. Lists installed packages, checks for outdated versions, finds unused deps, or shows dependency tree. Works with package.json (npm/pnpm/yarn) or requirements.txt (pip).",
      parameters: {
        type: "object",
        properties: {
          check: { type: "string", description: "What to check: 'outdated' (find outdated packages), 'tree' (show dependency tree), 'unused' (find possibly unused deps), 'list' (list all deps). Default: 'list'" },
        },
        required: [],
      },
      handler: async (args) => {
        const check = (args.check as string) || "list";
        const root = getProjectRoot();

        // Detect package manager
        const hasPackageJson = await fs.access(path.join(root, "package.json")).then(() => true).catch(() => false);
        const hasRequirements = await fs.access(path.join(root, "requirements.txt")).then(() => true).catch(() => false);
        const hasPipfile = await fs.access(path.join(root, "Pipfile")).then(() => true).catch(() => false);

        if (hasPackageJson) {
          if (check === "outdated") {
            const r = runCmd("npm outdated --json 2>/dev/null || true");
            try {
              const data = JSON.parse(r.output);
              const lines = Object.entries(data).map(([pkg, info]: [string, any]) =>
                `  ${pkg}: ${info.current} → ${info.latest}${info.current !== info.wanted ? ` (wanted: ${info.wanted})` : ""}`
              );
              return `## Outdated Packages\n\n${lines.length ? lines.join("\n") : "All packages up to date."}`;
            } catch { return "Could not parse outdated info. Run `npm outdated` manually."; }
          }
          if (check === "tree") {
            const r = runCmd("npm ls --depth=1 2>&1 | head -80");
            return `## Dependency Tree\n\n${r.output}`;
          }
          // list (default)
          try {
            const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf-8"));
            const deps = Object.entries(pkg.dependencies || {}).map(([n, v]) => `  ${n}@${v}`);
            const devDeps = Object.entries(pkg.devDependencies || {}).map(([n, v]) => `  ${n}@${v} (dev)`);
            return `## Dependencies\n\n### Production (${deps.length})\n${deps.join("\n") || "  (none)"}\n\n### Dev (${devDeps.length})\n${devDeps.join("\n") || "  (none)"}`;
          } catch { return "Could not read package.json"; }
        }

        if (hasRequirements || hasPipfile) {
          const r = runCmd(hasPipfile ? "pipenv graph 2>&1 | head -60" : "pip list --format=columns 2>&1 | head -40");
          return `## Python Dependencies\n\n${r.output}`;
        }

        return "No package manager detected. Found neither package.json nor requirements.txt.";
      },
    },
    {
      name: "test_runner",
      description: "Run the project's test suite and return results. Auto-detects test framework (jest, vitest, pytest, cargo test, go test, npm test). Supports running specific test files or test name patterns.",
      parameters: {
        type: "object",
        properties: {
          filter: { type: "string", description: "Test name pattern or file path to run specific tests" },
          coverage: { type: "boolean", description: "Run with coverage report if supported" },
        },
        required: [],
      },
      handler: async (args) => {
        const root = getProjectRoot();
        const filter = args.filter as string | undefined;
        const coverage = args.coverage as boolean | undefined;

        // Detect test framework
        const pkgPath = path.join(root, "package.json");
        let testCmd = "";
        try {
          const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
          const scripts = pkg.scripts || {};
          if (scripts.test && !scripts.test.includes("no test specified")) {
            testCmd = "npm test";
          }
          // Check for vitest/jest directly
          const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
          if (allDeps.vitest) testCmd = "npx vitest run";
          if (allDeps.jest && !allDeps.vitest) testCmd = "npx jest";
        } catch {}

        // Python
        if (!testCmd) {
          const hasPytest = runCmd("which pytest 2>/dev/null").ok;
          if (hasPytest) testCmd = "pytest";
        }
        // Go
        if (!testCmd && await fs.access(path.join(root, "go.mod")).then(() => true).catch(() => false)) {
          testCmd = "go test ./...";
        }
        // Rust
        if (!testCmd && await fs.access(path.join(root, "Cargo.toml")).then(() => true).catch(() => false)) {
          testCmd = "cargo test";
        }

        if (!testCmd) return "No test framework detected. Add tests to your project first.";

        // Build final command
        let cmd = testCmd;
        if (filter) {
          if (testCmd.includes("vitest")) cmd += ` "${filter}"`;
          else if (testCmd.includes("jest")) cmd += ` --testNamePattern="${filter}"`;
          else if (testCmd.includes("pytest")) cmd += ` -k "${filter}"`;
          else cmd += ` ${filter}`;
        }
        if (coverage) {
          if (testCmd.includes("vitest")) cmd += " --coverage";
          else if (testCmd.includes("jest")) cmd += " --coverage";
          else if (testCmd.includes("pytest")) cmd += " --cov";
        }

        const r = runCmd(cmd);
        const output = r.output.length > 6000 ? r.output.slice(0, 6000) + "\n... (truncated)" : r.output;
        return `## Test Results\n\n${r.ok ? "✓ Tests passed" : "✗ Tests failed"}\n\n${output}`;
      },
      approval: "always",
    },
    {
      name: "code_metrics",
      description: "Analyze code metrics: lines of code, file sizes, complexity indicators, language breakdown, largest files, and duplicate detection.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory to analyze (default: project root)" },
          top: { type: "number", description: "Number of largest files to show (default: 10)" },
        },
        required: [],
      },
      handler: async (args) => {
        const searchPath = resolvePath((args.path as string) || ".");
        const topN = (args.top as number) || 10;
        const root = getProjectRoot();

        const langExt: Record<string, string[]> = {
          TypeScript: [".ts", ".tsx"],
          JavaScript: [".js", ".jsx", ".mjs"],
          Python: [".py"],
          Go: [".go"],
          Rust: [".rs"],
          CSS: [".css", ".scss", ".less"],
          HTML: [".html", ".htm", ".vue", ".svelte"],
          JSON: [".json"],
          YAML: [".yaml", ".yml"],
          Markdown: [".md"],
          Shell: [".sh", ".bash"],
        };

        const langCounts: Record<string, { files: number; lines: number }> = {};
        const allFiles: { path: string; lines: number; size: number }[] = [];
        let totalFiles = 0;
        let totalLines = 0;
        let totalSize = 0;

        async function scan(dir: string): Promise<void> {
          let entries;
          try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
          for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (["node_modules", ".git", ".huno", "dist", "build", ".next", "__pycache__", "target", "venv"].includes(entry.name)) continue;
            if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
            if (entry.isDirectory()) { await scan(full); continue; }
            if (!entry.isFile()) continue;
            try {
              const stat = await fs.stat(full);
              const content = await fs.readFile(full, "utf-8");
              const lines = content.split("\n").length;
              const ext = path.extname(entry.name).toLowerCase();
              const rel = path.relative(root, full);

              totalFiles++;
              totalLines += lines;
              totalSize += stat.size;
              allFiles.push({ path: rel, lines, size: stat.size });

              // Classify language
              let lang = "Other";
              for (const [name, exts] of Object.entries(langExt)) {
                if (exts.includes(ext)) { lang = name; break; }
              }
              if (!langCounts[lang]) langCounts[lang] = { files: 0, lines: 0 };
              langCounts[lang].files++;
              langCounts[lang].lines += lines;
            } catch { /* skip */ }
          }
        }

        await scan(searchPath);

        // Sort languages by lines desc
        const langs = Object.entries(langCounts).sort((a, b) => b[1].lines - a[1].lines);
        // Sort files by size desc
        allFiles.sort((a, b) => b.size - a.size);
        const topFiles = allFiles.slice(0, topN);

        const formatSize = (bytes: number) => bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : bytes > 1024 ? `${(bytes / 1024).toFixed(1)}KB` : `${bytes}B`;

        const output = [
          `## Code Metrics`,
          ``,
          `Files: ${totalFiles}   Lines: ${totalLines.toLocaleString()}   Size: ${formatSize(totalSize)}`,
          ``,
          `### Language Breakdown`,
          ...langs.map(([lang, data]) => {
            const pct = Math.round(data.lines / totalLines * 100);
            const bar = "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));
            return `  ${lang.padEnd(14)} ${bar} ${pct}% (${data.files} files, ${data.lines.toLocaleString()} lines)`;
          }),
          ``,
          `### Largest Files (top ${topN})`,
          ...topFiles.map((f) => `  ${formatSize(f.size).padStart(8)}  ${f.lines.toLocaleString().padStart(6)} lines  ${f.path}`),
        ];

        return output.join("\n");
      },
    },
  ];
}

/**
 * Environment & System tools — environment variables, process info, disk usage.
 */
export function envTools(): ToolDefinition[] {
  return [
    {
      name: "check_env",
      description: "Check environment configuration: env vars, config files, secrets status, and system info. Useful for debugging setup issues.",
      parameters: {
        type: "object",
        properties: {
          var_names: { type: "array", items: { type: "string" }, description: "Specific env var names to check" },
          check_dotenv: { type: "boolean", description: "Read and show .env file keys (values are masked). Default: true" },
        },
        required: [],
      },
      handler: async (args) => {
        const varNames = (args.var_names as string[]) || [];
        const checkDotenv = (args.check_dotenv as boolean) !== false;
        const root = getProjectRoot();
        const lines: string[] = ["## Environment Check"];

        // Check specific env vars
        if (varNames.length > 0) {
          lines.push("\n### Environment Variables");
          for (const name of varNames) {
            const val = process.env[name];
            lines.push(`  ${name}: ${val ? "*** set ***" : "not set"}`);
          }
        }

        // Check .env file
        if (checkDotenv) {
          try {
            const envContent = await fs.readFile(path.join(root, ".env"), "utf-8");
            const envLines = envContent.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
            lines.push(`\n### .env File (${envLines.length} entries)`);
            for (const line of envLines) {
              const [key] = line.split("=");
              lines.push(`  ${key.trim()}: ***`);
            }
          } catch {
            lines.push("\n### .env File: not found");
          }
        }

        // System info
        lines.push("\n### System");
        lines.push(`  Node.js: ${process.version}`);
        lines.push(`  Platform: ${process.platform} ${process.arch}`);
        lines.push(`  CWD: ${root}`);

        return lines.join("\n");
      },
    },
    {
      name: "shell_exec",
      description: "Execute a shell command with extended options: background mode, timeout, environment variables, and working directory. More flexible than run_command for long-running processes.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to execute" },
          cwd: { type: "string", description: "Working directory (relative to project root)" },
          env: { type: "object", description: "Additional environment variables" },
          timeout: { type: "number", description: "Timeout in seconds (default: 30, max: 300)" },
        },
        required: ["command"],
      },
      handler: async (args) => {
        const cmd = args.command as string;
        const cwd = args.cwd ? path.join(getProjectRoot(), args.cwd as string) : getProjectRoot();
        const extraEnv = (args.env as Record<string, string>) || {};
        const timeout = Math.min((args.timeout as number) || 30, 300) * 1000;

        try {
          const output = execSync(cmd, {
            cwd,
            encoding: "utf-8",
            timeout,
            env: { ...process.env, ...extraEnv },
            stdio: ["pipe", "pipe", "pipe"],
          });
          const truncated = output.length > 5000 ? output.slice(0, 5000) + `\n... (truncated)` : output;
          return truncated || "(no output)";
        } catch (err: any) {
          const out = (err.stdout || "") + (err.stderr || "");
          return `Exit code ${err.status || 1}: ${out.slice(0, 3000) || err.message}`;
        }
      },
      approval: "always",
    },
  ];
}
