import chalk from "chalk";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { listProviderInfo } from "../providers/index.js";
import { checkForUpdate } from "../utils/version-check.js";
import {
  configureModelInteractive,
  configureProviderInteractive,
  getCurrentProviderConfiguration,
  selectProviderInteractively,
} from "../commands/providers.js";
import { runAuditAnalysis } from "../commands/audit.js";
import { runExplainAnalysis } from "../commands/explain.js";
import { appendMemory, readMemoryFile, parseMemoryEntries, searchMemory } from "../storage/memory-file.js";
import { readSessionHistory } from "../storage/huno-dir.js";
import { brand, neutral, progress } from "../ui/theme.js";
import type { ReplSession } from "./session.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8"));
const VERSION = pkg.version;

async function runUpdateCheck(): Promise<void> {
  console.log();
  console.log(chalk.dim(`  Current version: v${VERSION}`));
  console.log(chalk.dim("  Checking npm for the latest version..."));
  const status = await checkForUpdate(VERSION, { force: true, timeoutMs: 8000 });
  console.log();
  if (!status) {
    console.log(chalk.yellow("  ⚠ Couldn't reach npm to check for updates."));
  } else if (!status.hasUpdate) {
    console.log(chalk.green(`  ✓ You're up to date (v${status.current}).`));
  } else {
    console.log(chalk.hex(brand.secondary)(`  ✨ Update available: v${status.current} → v${status.latest}`));
    console.log(chalk.dim("  Exit this session and run `huno update` to install it."));
  }
  console.log();
}

export type CommandHandler = (arg: string, ctx: ReplRuntime) => Promise<void> | void;

export type SlashCommand = {
  name: string;
  usage: string;
  description: string;
  handler: CommandHandler;
  /** Undocumented alternate spellings that should dispatch to this command (e.g. /quit for /exit). */
  aliases?: string[];
};

/**
 * The operations a slash-command handler needs from the surrounding REPL
 * loop. repl.ts implements this; handlers here never touch readline or the
 * dropdown directly.
 */
export interface ReplRuntime {
  session: ReplSession;
  contextFiles: string[];
  exit(): void;
  runInteractive(action: () => Promise<void>): Promise<void>;
  runChat(input: string): Promise<void>;
}

function resolveProviderName(input: string): string | null {
  const normalized = input.toLowerCase();
  const provider = listProviderInfo().find(
    (p) => p.name === normalized || p.aliases.includes(normalized)
  );
  return provider?.name || null;
}

function supportedProviderNames(): string {
  return listProviderInfo().map((provider) => provider.name).join(", ");
}

function showProviders(): void {
  const providers = listProviderInfo();
  console.log();
  console.log(chalk.bold.white("  Supported Providers:"));
  providers.forEach((p) => {
    console.log(chalk.cyan(`  ${p.name}`));
    console.log(`    default model: ${p.defaultModel}`);
    console.log(`    env: ${p.envKeys.join(" or ") || "(none)"}`);
    if (p.aliases.length > 0) console.log(`    aliases: ${p.aliases.join(", ")}`);
    if (p.requiresAccountId) console.log("    extra: CLOUDFLARE_ACCOUNT_ID");
  });
  console.log();
}

async function showModelStatus(session: ReplSession): Promise<void> {
  const result = await getCurrentProviderConfiguration();
  if (!result.ok) {
    console.log(chalk.red("  ✗ " + result.error.message));
    if (result.error.hint) console.log(chalk.dim("  " + result.error.hint));
    return;
  }
  console.log();
  console.log(chalk.bold.white("  Current Model Configuration:"));
  console.log(chalk.cyan(`  provider: ${session.providerName || result.data.provider}`));
  console.log(`  model: ${session.modelName || result.data.model}`);
  if (session.providerName || session.modelName) {
    console.log(chalk.dim("  (Using inline override. Use /clear to reset.)"));
  }
  console.log();
}

async function runAudit(): Promise<void> {
  const result = await runAuditAnalysis();
  if (!result.ok) {
    console.log(chalk.red("  ✗ " + result.error.message));
    if (result.error.hint) console.log(chalk.dim("  " + result.error.hint));
    return;
  }

  const report = result.data;
  console.log();
  console.log(chalk.bold.white("  Audit Results:"));
  if (report.issues.length === 0) {
    console.log(chalk.green("  ✓ No issues found!"));
  } else {
    for (const issue of report.issues) {
      const color = issue.severity === "high" ? chalk.red : issue.severity === "medium" ? chalk.yellow : chalk.dim;
      const location = issue.file ? chalk.dim(` (${issue.file}:${issue.line || "?"})`) : "";
      console.log(color(`  ⚠ [${issue.category}] ${issue.message}`) + location);
    }
  }
  console.log(chalk.dim(`  ${report.summary.high} high, ${report.summary.medium} medium, ${report.summary.low} low`));
  console.log();
}

async function runExplain(): Promise<void> {
  const result = await runExplainAnalysis();
  if (!result.ok) {
    console.log(chalk.red("  ✗ " + result.error.message));
    if (result.error.hint) console.log(chalk.dim("  " + result.error.hint));
    return;
  }
  const map = result.data;
  const stack = [
    ...map.stack.languages,
    ...map.stack.frameworks,
    ...map.stack.database,
    ...map.stack.infrastructure,
  ].join(", ") || "unknown";
  console.log();
  console.log(chalk.bold.white(`  Project: ${map.projectName}`));
  console.log(chalk.dim(`  Stack: ${stack}`));
  if (map.importantFiles.length > 0) {
    console.log(chalk.bold.white("  Important Files:"));
    map.importantFiles.forEach((f) => console.log(`    - ${f}`));
  }
  if (Object.keys(map.directories).length > 0) {
    console.log(chalk.bold.white("  Directories:"));
    Object.keys(map.directories).slice(0, 10).forEach((d) => console.log(`    - ${d}/`));
  }
  if (Object.keys(map.scripts).length > 0) {
    console.log(chalk.bold.white("  Scripts:"));
    Object.entries(map.scripts).slice(0, 5).forEach(([name, command]) => {
      console.log(`    - ${name}: ${command}`);
    });
  }
  if (map.packageManagers.length > 0) {
    console.log(chalk.dim(`  Package Managers: ${map.packageManagers.join(", ")}`));
  }
  const testSetup = [
    ...map.tests.directories,
    ...map.tests.frameworks,
    ...map.tests.scripts,
  ];
  if (testSetup.length > 0) {
    console.log(chalk.dim(`  Tests: ${testSetup.join(", ")}`));
  }
  if (map.warnings.length > 0) {
    console.log(chalk.yellow("  Warnings:"));
    map.warnings.slice(0, 5).forEach((warning) => {
      console.log(chalk.yellow(`    ⚠ ${warning.message}`));
    });
  }
  console.log();
}

async function runRemember(text: string): Promise<void> {
  const result = await appendMemory(text);
  if (!result.ok) {
    console.log(chalk.red("  ✗ Failed to save memory."));
    return;
  }
  console.log(chalk.green(`  ✓ Memory saved: "${text}"`));
  console.log();
}

async function runRecall(query: string): Promise<void> {
  const result = await readMemoryFile();
  if (!result.ok) {
    console.log(chalk.yellow("  No memory found. Run `huno init` first."));
    return;
  }
  const entries = parseMemoryEntries(result.data);
  const matches = searchMemory(entries, query);
  if (matches.length === 0) {
    console.log(chalk.dim("  No memories found."));
    return;
  }
  console.log();
  matches.forEach((entry) => {
    const date = entry.date ? chalk.dim(`[${entry.date}] `) : "";
    console.log(`  ${date}${entry.text}`);
  });
  console.log();
}

function showHelp(commands: SlashCommand[]): void {
  console.log();
  console.log(chalk.hex(progress.active)("  ◈") + " Slash Commands:");
  commands.forEach((cmd) => {
    console.log(chalk.hex(brand.secondary)("    " + cmd.usage.padEnd(18)) + chalk.hex(neutral.muted)(cmd.description));
  });
  console.log();
}

const TOOLS_HELP = {
  file: [
    ["read_file", "Read file contents"],
    ["write_file", "Write content to a file (requires approval)"],
    ["patch_file", "Find & replace in a file (requires approval)"],
    ["list_files", "List files in a directory"],
    ["search_files", "Search file contents"],
    ["run_command", "Execute a shell command (requires approval)"],
    ["git_status", "Show git status"],
    ["git_diff", "Show git diff"],
    ["git_log", "Show git history"],
    ["git_branch", "Show git branches"],
    ["get_project_map", "Get project structure overview"],
    ["get_memory", "Search project memories"],
    ["save_memory", "Save a project memory"],
    ["list_definitions", "List functions/classes in code"],
    ["fetch_url", "Fetch URL content (HTTP GET/POST)"],
    ["find_references", "Find all references to a symbol"],
    ["analyze_dependencies", "Analyze package dependencies"],
    ["test_runner", "Run the project test suite (approval)"],
    ["code_metrics", "Code stats, language breakdown, largest files"],
    ["check_env", "Check env vars and config"],
    ["shell_exec", "Extended shell execution (approval)"],
  ],
  git: [
    ["git_status", "Show current git status"],
    ["git_diff", "Show diff of changes"],
    ["git_log", "Show commit history"],
    ["git_branch", "Show current branch"],
  ],
  project: [
    ["get_project_map", "Get project structure summary"],
    ["get_memory", "Search project memories"],
    ["save_memory", "Save a project memory"],
    ["get_config", "Read Huno configuration"],
    ["list_definitions", "List code definitions"],
  ],
} as const;

function showTools(): void {
  console.log();
  console.log(chalk.bold.white("  Available Tools"));
  console.log(chalk.dim("  The model can request these tools:"));
  console.log();
  console.log(chalk.dim("  ── File Tools ──"));
  TOOLS_HELP.file.forEach(([name, desc]) => {
    console.log(`    ${chalk.cyan(name.padEnd(18))} ${chalk.dim(desc)}`);
  });
  console.log();
  console.log(chalk.dim("  ── Git Tools ──"));
  TOOLS_HELP.git.forEach(([name, desc]) => {
    console.log(`    ${chalk.cyan(name.padEnd(18))} ${chalk.dim(desc)}`);
  });
  console.log();
  console.log(chalk.dim("  ── Project Tools ──"));
  TOOLS_HELP.project.forEach(([name, desc]) => {
    console.log(`    ${chalk.cyan(name.padEnd(18))} ${chalk.dim(desc)}`);
  });
  console.log();
}

async function showSessions(): Promise<void> {
  const historyResult = await readSessionHistory(10);
  console.log();
  if (!historyResult.ok || historyResult.data.length === 0) {
    console.log(chalk.dim("  No session history yet."));
  } else {
    console.log(chalk.bold.white("  Recent Sessions (last 10)"));
    historyResult.data.forEach((entry) => {
      const time = entry.ts ? entry.ts.slice(11, 19) : "??";
      const preview = entry.content.slice(0, 60) + (entry.content.length > 60 ? "..." : "");
      if (entry.role === "user") {
        console.log(chalk.cyan(`  [${time}] You: ${preview}`));
      } else {
        console.log(chalk.dim(`  [${time}] Huno: ${preview}`));
      }
    });
  }
  console.log();
}

/**
 * Builds the full slash-command table: one source of truth for the
 * autocomplete dropdown, /help output, and actual dispatch — previously
 * this list (for display) and the onLine if/else chain (for behavior)
 * could silently drift apart.
 */
export function buildSlashCommands(): SlashCommand[] {
  const commands: SlashCommand[] = [
    {
      name: "/help",
      usage: "/help",
      description: "Show available slash commands",
      handler: () => showHelp(commands),
    },
    {
      name: "/ask",
      usage: "/ask <question>",
      description: "Ask a question about your project",
      handler: async (arg, ctx) => {
        if (!arg) {
          console.log(chalk.yellow("  Usage: /ask <question>"));
          console.log();
          return;
        }
        await ctx.runChat(arg);
      },
    },
    {
      name: "/providers",
      usage: "/providers",
      description: "List supported providers",
      handler: () => showProviders(),
    },
    {
      name: "/configure",
      usage: "/configure",
      description: "Configure provider and model",
      handler: async (_arg, ctx) => {
        await ctx.runInteractive(async () => {
          const result = await configureProviderInteractive();
          if (!result.ok) {
            console.log(chalk.red("  ✗ " + result.error.message));
            if (result.error.hint) console.log(chalk.dim("  " + result.error.hint));
          } else {
            console.log();
            console.log(chalk.green(`  ✓ Configured: ${result.data.provider} (${result.data.model})`));
            ctx.session.history = [];
            ctx.session.providerName = undefined;
            ctx.session.modelName = undefined;
          }
        });
      },
    },
    {
      name: "/provider",
      usage: "/provider <name>",
      description: "Switch provider",
      handler: async (arg, ctx) => {
        if (!arg) {
          await ctx.runInteractive(async () => {
            const current = await getCurrentProviderConfiguration();
            console.log();
            if (current.ok) {
              console.log(chalk.bold.white("  Current Provider:"));
              console.log(chalk.hex(brand.secondary)(`  ${ctx.session.providerName || current.data.provider}`));
              if (ctx.session.providerName) {
                console.log(chalk.dim("  (Using inline override. Use /clear to reset.)"));
              }
            } else {
              console.log(chalk.yellow("  No provider configured yet."));
            }
            console.log();

            const selected = await selectProviderInteractively(listProviderInfo());
            if (!selected) {
              console.log(chalk.yellow("  Provider selection cancelled."));
              return;
            }

            ctx.session.providerName = selected.name;
            ctx.session.modelName = undefined;
            ctx.session.history = [];
            ctx.session.snapshots = [];
            console.log(chalk.green(`  ✓ Provider switched to: ${selected.name}`));
            console.log();
          });
          return;
        }

        const provider = resolveProviderName(arg);
        if (!provider) {
          console.log(chalk.red(`  ✗ Unknown provider: ${arg}`));
          console.log(chalk.dim(`  Supported: ${supportedProviderNames()}`));
          console.log();
          return;
        }
        ctx.session.providerName = provider;
        ctx.session.modelName = undefined;
        ctx.session.history = [];
        ctx.session.snapshots = [];
        console.log(chalk.green(`  ✓ Provider switched to: ${provider}`));
        console.log();
      },
    },
    {
      name: "/model",
      usage: "/model [name]",
      description: "Show or change model",
      handler: async (arg, ctx) => {
        if (arg) {
          ctx.session.modelName = arg;
          console.log(chalk.green(`  ✓ Model switched to: ${arg}`));
          console.log();
          return;
        }

        await ctx.runInteractive(async () => {
          await showModelStatus(ctx.session);
          console.log(chalk.bold.white("  Select a Model"));
          const result = await configureModelInteractive();
          if (!result.ok) {
            console.log(chalk.red("  ✗ " + result.error.message));
            if (result.error.hint) console.log(chalk.dim("  " + result.error.hint));
          } else {
            console.log();
            console.log(chalk.green(`  ✓ Model configured: ${result.data.provider} (${result.data.model})`));
            ctx.session.reset();
          }
        });
      },
    },
    {
      name: "/audit",
      usage: "/audit",
      description: "Run project audit",
      handler: () => runAudit(),
    },
    {
      name: "/explain",
      usage: "/explain",
      description: "Explain the project structure",
      handler: () => runExplain(),
    },
    {
      name: "/remember",
      usage: "/remember <text>",
      description: "Save a project memory",
      handler: async (arg) => {
        if (!arg) {
          console.log(chalk.yellow("  Usage: /remember <text>"));
          console.log();
          return;
        }
        await runRemember(arg);
      },
    },
    {
      name: "/recall",
      usage: "/recall <query>",
      description: "Search project memories",
      handler: async (arg) => {
        if (!arg) {
          console.log(chalk.yellow("  Usage: /recall <query>"));
          console.log();
          return;
        }
        await runRecall(arg);
      },
    },
    {
      name: "/context",
      usage: "/context",
      description: "Show context files",
      handler: (_arg, ctx) => {
        console.log(chalk.bold.white("  Project Context:"));
        ctx.contextFiles.forEach((f) => console.log(chalk.dim(`    - ${f}`)));
        console.log();
      },
    },
    {
      name: "/clear",
      usage: "/clear",
      description: "Clear screen and reset conversation",
      handler: (_arg, ctx) => {
        console.clear();
        ctx.session.reset();
      },
    },
    {
      name: "/new",
      usage: "/new",
      description: "Start a new conversation",
      handler: (_arg, ctx) => {
        console.clear();
        ctx.session.reset();
      },
    },
    {
      name: "/undo",
      usage: "/undo",
      description: "Undo last tool action",
      handler: async (_arg, ctx) => {
        if (ctx.session.snapshots.length === 0) {
          console.log(chalk.dim("  Nothing to undo."));
          console.log();
          return;
        }
        const snapshot = ctx.session.snapshots.pop()!;
        const undoResult = await snapshot.undo();
        console.log(chalk.green(`  ↩ ${undoResult}`));
        console.log();
      },
    },
    {
      name: "/tools",
      usage: "/tools",
      description: "List available tools",
      handler: () => showTools(),
    },
    {
      name: "/sessions",
      usage: "/sessions",
      description: "Show recent session history",
      handler: () => showSessions(),
    },
    {
      name: "/update",
      usage: "/update",
      description: "Check for a newer version of Huno",
      handler: () => runUpdateCheck(),
    },
    {
      name: "/exit",
      usage: "/exit",
      description: "Exit Huno",
      aliases: ["/quit"],
      handler: (_arg, ctx) => ctx.exit(),
    },
    {
      name: "/audit-providers",
      usage: "/audit-providers",
      description: "Verify all providers connectivity",
      handler: async () => {
        console.log();
        const { runProviderAudit } = await import("../commands/providers-audit.js");
        await runProviderAudit();
      },
    },
    {
      name: "/benchmark",
      usage: "/benchmark",
      description: "Benchmark all models across providers",
      handler: async () => {
        console.log();
        const { runProviderBenchmark } = await import("../commands/providers-benchmark.js");
        await runProviderBenchmark();
      },
    },
  ];

  return commands;
}

export function findSlashCommand(commands: SlashCommand[], name: string): SlashCommand | undefined {
  return commands.find((c) => c.name === name || c.aliases?.includes(name));
}
