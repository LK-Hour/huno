import { Command } from "commander";
import chalk from "chalk";
import { scanProject } from "../core/scanner.js";
import { listProviderInfo } from "../providers/index.js";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

type Severity = "error" | "warn" | "info" | "ok";

interface LintResult {
  tool: string;
  severity: Severity;
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

interface LintReport {
  results: LintResult[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
    ok: number;
  };
  duration: number;
}

const ICONS: Record<Severity, string> = {
  error: "✖",
  warn: "⚠",
  info: "ℹ",
  ok: "✔",
};

const SEVERITY_COLOR: Record<Severity, (s: string) => string> = {
  error: chalk.red,
  warn: chalk.yellow,
  info: chalk.blue,
  ok: chalk.green,
};

function detectLintTools(projectRoot: string): {
  hasTsc: boolean;
  hasEslint: boolean;
  hasPrettier: boolean;
  hasBiome: boolean;
  hasOxlint: boolean;
  pkgScripts: Record<string, string>;
} {
  let pkg: any = {};
  try {
    const raw = fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8");
    pkg = JSON.parse(raw);
  } catch {
    // no package.json
  }

  const scripts = pkg.scripts || {};
  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };

  const hasTsc = !!(
    allDeps["typescript"] ||
    fs.existsSync(path.join(projectRoot, "tsconfig.json"))
  );
  const hasEslint = !!(
    allDeps["eslint"] ||
    fs.existsSync(path.join(projectRoot, ".eslintrc")) ||
    fs.existsSync(path.join(projectRoot, ".eslintrc.json")) ||
    fs.existsSync(path.join(projectRoot, ".eslintrc.js")) ||
    fs.existsSync(path.join(projectRoot, "eslint.config.js")) ||
    fs.existsSync(path.join(projectRoot, "eslint.config.mjs"))
  );
  const hasPrettier = !!(
    allDeps["prettier"] ||
    fs.existsSync(path.join(projectRoot, ".prettierrc")) ||
    fs.existsSync(path.join(projectRoot, ".prettierrc.json")) ||
    fs.existsSync(path.join(projectRoot, "prettier.config.js"))
  );
  const hasBiome = !!(
    allDeps["@biomejs/biome"] ||
    allDeps["biome"] ||
    fs.existsSync(path.join(projectRoot, "biome.json")) ||
    fs.existsSync(path.join(projectRoot, "biome.jsonc"))
  );
  const hasOxlint = !!(
    allDeps["oxlint"] ||
    fs.existsSync(path.join(projectRoot, ".oxlintrc.json")) ||
    fs.existsSync(path.join(projectRoot, "oxlint.config.mjs"))
  );

  return { hasTsc, hasEslint, hasPrettier, hasBiome, hasOxlint, pkgScripts: scripts };
}

function runCommand(
  cmd: string,
  args: string[],
  projectRoot: string
): { stdout: string; stderr: string; exitCode: number } | null {
  try {
    const stdout = execFileSync(cmd, args, {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 60000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (e: any) {
    return {
      stdout: (e.stdout as string) || "",
      stderr: (e.stderr as string) || "",
      exitCode: e.status || 1,
    };
  }
}

async function lintTypeScript(
  projectRoot: string,
  pkgScripts: Record<string, string>
): Promise<LintResult[]> {
  const results: LintResult[] = [];
  const hasLintScript = Object.keys(pkgScripts).some(
    (k) => k === "lint" || k === "typecheck" || k === "tsc"
  );

  // Prefer running the lint script if it exists
  if (hasLintScript) {
    const lintScript =
      pkgScripts["lint"] || pkgScripts["typecheck"] || pkgScripts["tsc"];
    const run = runCommand("npx", ["--no-install", ...lintScript.split(" ").filter(Boolean)], projectRoot);
    if (run && run.exitCode !== 0) {
      results.push({
        tool: "npm",
        severity: "error",
        message: `Lint script failed: ${lintScript}`,
        suggestion: "Run the script manually to see detailed errors.",
      });
    } else if (run && run.exitCode === 0) {
      results.push({
        tool: "npm",
        severity: "ok",
        message: `Lint script passed: ${lintScript}`,
      });
    }
  } else {
    // Direct tsc --noEmit
    const run = runCommand("npx", ["--no-install", "tsc", "--noEmit"], projectRoot);
    if (run && run.exitCode !== 0) {
      // Parse tsc output for errors
      const errorLines = run.stdout
        .split("\n")
        .filter((l: string) => l.includes(": error TS"));
      const errorCount = errorLines.length;

      if (errorCount > 0) {
        results.push({
          tool: "tsc",
          severity: "error",
          message: `${errorCount} TypeScript error${errorCount > 1 ? "s" : ""} found`,
          suggestion: "Run `npx tsc --noEmit` to see detailed errors.",
        });

        // Show first 5 errors as info
        for (const line of errorLines.slice(0, 5)) {
          const match = line.match(/(.+?)\((\d+),\d+\):\s*error TS\d+:\s*(.+)/);
          if (match) {
            results.push({
              tool: "tsc",
              severity: "info",
              message: match[3].trim(),
              file: match[1].trim(),
              line: parseInt(match[2]),
            });
          }
        }
        if (errorCount > 5) {
          results.push({
            tool: "tsc",
            severity: "info",
            message: `...and ${errorCount - 5} more errors`,
          });
        }
      }
    } else if (run && run.exitCode === 0) {
      results.push({
        tool: "tsc",
        severity: "ok",
        message: "TypeScript compilation passed",
      });
    }
  }

  return results;
}

async function lintEslint(
  projectRoot: string,
  pkgScripts: Record<string, string>
): Promise<LintResult[]> {
  const results: LintResult[] = [];
  const hasLintScript = pkgScripts["lint"];

  if (hasLintScript) {
    const run = runCommand("npx", ["--no-install", "eslint", "--quiet", "."], projectRoot);
    if (run && run.exitCode !== 0) {
      const errorLines = run.stdout
        .split("\n")
        .filter((l: string) => l.trim().length > 0 && !l.startsWith(" "));
      results.push({
        tool: "eslint",
        severity: "error",
        message: `ESLint found issues`,
        suggestion: "Run `npx eslint .` to see detailed output.",
      });
      // Show some error lines
      for (const line of errorLines.slice(0, 8)) {
        results.push({
          tool: "eslint",
          severity: "info",
          message: line.trim().slice(0, 120),
        });
      }
    } else if (run && run.exitCode === 0) {
      results.push({
        tool: "eslint",
        severity: "ok",
        message: "ESLint passed",
      });
    }
  } else {
    // Direct eslint
    const run = runCommand("npx", ["--no-install", "eslint", "--quiet", "."], projectRoot);
    if (run && run.exitCode !== 0) {
      results.push({
        tool: "eslint",
        severity: "error",
        message: "ESLint found issues",
        suggestion: "Run `npx eslint .` to see detailed output.",
      });
    } else if (run && run.exitCode === 0) {
      results.push({
        tool: "eslint",
        severity: "ok",
        message: "ESLint passed",
      });
    }
  }

  return results;
}

async function lintGit(projectRoot: string): Promise<LintResult[]> {
  const results: LintResult[] = [];

  // Check if git repo
  const isGit = runCommand("git", ["rev-parse", "--git-dir"], projectRoot);
  if (!isGit || isGit.exitCode !== 0) {
    results.push({
      tool: "git",
      severity: "info",
      message: "Not a git repository",
    });
    return results;
  }

  // Check for uncommitted changes
  const status = runCommand("git", ["status", "--porcelain"], projectRoot);
  if (status && status.stdout.trim().length > 0) {
    const lines = status.stdout.trim().split("\n");
    results.push({
      tool: "git",
      severity: "warn",
      message: `${lines.length} uncommitted change${lines.length > 1 ? "s" : ""}`,
      suggestion: "Run `git status` to see modified files.",
    });
  } else if (status) {
    results.push({
      tool: "git",
      severity: "ok",
      message: "Working tree clean",
    });
  }

  // Check for untracked files
  const untracked = runCommand(
    "git",
    ["ls-files", "--others", "--exclude-standard"],
    projectRoot
  );
  if (untracked && untracked.stdout.trim().length > 0) {
    const count = untracked.stdout.trim().split("\n").length;
    if (count > 10) {
      results.push({
        tool: "git",
        severity: "warn",
        message: `${count} untracked files`,
        suggestion: "Consider adding a .gitignore or tracking these files.",
      });
    }
  }

  return results;
}

async function lintConfig(projectRoot: string): Promise<LintResult[]> {
  const results: LintResult[] = [];

  // Check for .env without .env.example
  const allFiles = fs.readdirSync(projectRoot);
  const hasEnv = allFiles.some((f) => f.startsWith(".env"));
  const hasEnvExample = allFiles.includes(".env.example");
  if (hasEnv && !hasEnvExample) {
    results.push({
      tool: "config",
      severity: "warn",
      message: ".env exists but no .env.example",
      suggestion: "Create .env.example with placeholder values.",
    });
  }

  // Check for README
  const hasReadme = allFiles.some(
    (f) => f.toUpperCase() === "README.MD" || f.toUpperCase() === "README"
  );
  if (!hasReadme) {
    results.push({
      tool: "config",
      severity: "warn",
      message: "No README.md found",
      suggestion: "Add a README.md to document your project.",
    });
  }

  // Check for .gitignore
  if (!allFiles.includes(".gitignore")) {
    results.push({
      tool: "config",
      severity: "warn",
      message: "No .gitignore found",
      suggestion: "Add a .gitignore to exclude build artifacts and secrets.",
    });
  }

  // Check for LICENSE
  const hasLicense = allFiles.some((f) =>
    ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "LICENCE.MD"].includes(f.toUpperCase())
  );
  if (!hasLicense) {
    results.push({
      tool: "config",
      severity: "info",
      message: "No LICENSE file found",
      suggestion: "Consider adding a license for your project.",
    });
  }

  return results;
}

async function lintProviders(): Promise<LintResult[]> {
  const results: LintResult[] = [];
  const providers = listProviderInfo();

  if (providers.length === 0) {
    results.push({
      tool: "provider",
      severity: "error",
      message: "No providers configured",
      suggestion: "Run `huno providers configure <provider>` to set up a provider.",
    });
  } else {
    for (const p of providers) {
      results.push({
        tool: "provider",
        severity: "ok",
        message: `${p.name} configured (default: ${p.defaultModel})`,
      });
    }
  }

  return results;
}

function formatReport(report: LintReport, verbose: boolean): string {
  const lines: string[] = [];

  // Header
  lines.push("");
  lines.push(chalk.bold.white("┌─ Huno Lint ──────────────────────────────────┐"));
  lines.push(
    chalk.bold.white("│") +
      chalk.dim(`  Found ${report.results.length} check${report.results.length !== 1 ? "s" : ""}`) +
      " ".repeat(
        Math.max(1, 44 - `${report.results.length} checks`.length)
      ) +
      chalk.bold.white("│")
  );
  lines.push(chalk.bold.white("└─────────────────────────────────────────────┘"));
  lines.push("");

  // Group by tool
  const tools = new Map<string, LintResult[]>();
  for (const r of report.results) {
    if (!tools.has(r.tool)) tools.set(r.tool, []);
    tools.get(r.tool)!.push(r);
  }

  for (const [tool, results] of Array.from(tools)) {
    const toolErrors = results.filter((r) => r.severity === "error").length;
    const toolWarnings = results.filter((r) => r.severity === "warn").length;
    const toolOk = results.filter((r) => r.severity === "ok").length;

    const statusIcon = toolErrors > 0 ? "✖" : toolWarnings > 0 ? "⚠" : "✔";
    const statusColor = toolErrors > 0 ? chalk.red : toolWarnings > 0 ? chalk.yellow : chalk.green;

    lines.push(statusColor.bold(`  ${statusIcon} ${tool.toUpperCase()}`));
    lines.push(chalk.dim(`  ${"─".repeat(40)}`));

    for (const r of results) {
      if (!verbose && r.severity === "ok") continue;
      if (r.severity === "ok" && !verbose) continue;

      const icon = ICONS[r.severity];
      const color = SEVERITY_COLOR[r.severity];

      if (r.file) {
        lines.push(
          `    ${color(icon)} ${r.file}${r.line ? chalk.dim(`:${r.line}`) : ""}`
        );
        if (r.message) {
          lines.push(chalk.dim(`      ${r.message.slice(0, 100)}`));
        }
      } else {
        lines.push(`    ${color(icon)} ${r.message}`);
      }

      if (verbose && r.suggestion) {
        lines.push(chalk.dim(`      → ${r.suggestion}`));
      }
    }
    lines.push("");
  }

  // Summary
  const { errors, warnings, info, ok } = report.summary;
  lines.push(chalk.bold.white("  ┌─ Summary ─────────────────────────────────┐"));
  const summaryText = `  ${errors} error${errors !== 1 ? "s" : ""}, ${warnings} warning${warnings !== 1 ? "s" : ""}, ${info} info, ${ok} ok`;
  const summaryPad = " ".repeat(Math.max(1, 44 - summaryText.length));
  lines.push(
    chalk.bold.white("│") +
      chalk.red(`${errors} error${errors !== 1 ? "s" : ""}`) +
      ", " +
      chalk.yellow(`${warnings} warning${warnings !== 1 ? "s" : ""}`) +
      ", " +
      chalk.blue(`${info} info`) +
      ", " +
      chalk.green(`${ok} ok`) +
      summaryPad +
      chalk.bold.white("│")
  );
  const timingText = `  Linted in ${(report.duration / 1000).toFixed(1)}s`;
  const timingPad = " ".repeat(Math.max(1, 44 - timingText.length));
  lines.push(
    chalk.bold.white("│") +
      chalk.dim(timingText) +
      timingPad +
      chalk.bold.white("│")
  );
  lines.push(chalk.bold.white("└───────────────────────────────────────────┘"));
  lines.push("");

  return lines.join("\n");
}

export const lintCommand = new Command("lint")
  .description("Lint the project — providers, types, code quality, git status")
  .option("-v, --verbose", "Show all results including passing checks")
  .option("--json", "Output as JSON")
  .option("--providers-only", "Only check provider configuration")
  .option("--code-only", "Only check code quality (tsc, eslint)")
  .option("--git-only", "Only check git status")
  .option("--fix", "Run --fix for eslint/prettier where supported")
  .action(
    async (options: {
      verbose?: boolean;
      json?: boolean;
      providersOnly?: boolean;
      codeOnly?: boolean;
      gitOnly?: boolean;
      fix?: boolean;
    }) => {
      const start = Date.now();

      const scanResult = await scanProject();
      if (!scanResult.ok) {
        console.log(
          chalk.red("✖ Scan failed. Run"),
          chalk.bold("huno init"),
          chalk.red("first.")
        );
        process.exit(1);
      }

      const map = scanResult.data;
      const projectRoot = map.root;
      const tools = detectLintTools(projectRoot);
      const allResults: LintResult[] = [];

      if (!options.providersOnly && !options.codeOnly && !options.gitOnly) {
        // Run all checks
        if (tools.hasTsc) {
          allResults.push(...(await lintTypeScript(projectRoot, tools.pkgScripts)));
        }
        if (tools.hasEslint) {
          allResults.push(...(await lintEslint(projectRoot, tools.pkgScripts)));
        }
        allResults.push(...(await lintGit(projectRoot)));
        allResults.push(...(await lintConfig(projectRoot)));
        allResults.push(...(await lintProviders()));
      } else if (options.providersOnly) {
        allResults.push(...(await lintProviders()));
      } else if (options.codeOnly) {
        if (tools.hasTsc) {
          allResults.push(...(await lintTypeScript(projectRoot, tools.pkgScripts)));
        }
        if (tools.hasEslint) {
          allResults.push(...(await lintEslint(projectRoot, tools.pkgScripts)));
        }
      } else if (options.gitOnly) {
        allResults.push(...(await lintGit(projectRoot)));
      }

      const summary = {
        errors: allResults.filter((r) => r.severity === "error").length,
        warnings: allResults.filter((r) => r.severity === "warn").length,
        info: allResults.filter((r) => r.severity === "info").length,
        ok: allResults.filter((r) => r.severity === "ok").length,
      };

      const report: LintReport = {
        results: allResults,
        summary,
        duration: Date.now() - start,
      };

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(formatReport(report, options.verbose || false));

        // Exit code based on results
        if (summary.errors > 0) {
          console.log(chalk.red("  Lint failed — fix errors and try again.\n"));
        } else if (summary.warnings > 0) {
          console.log(chalk.yellow("  Lint passed with warnings.\n"));
        } else {
          console.log(chalk.green("  All checks passed!\n"));
        }
      }

      process.exit(summary.errors > 0 ? 1 : 0);
    }
  );
