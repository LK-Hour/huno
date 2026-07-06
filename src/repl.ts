import { Command } from "commander";
import chalk from "chalk";
import { buildContext } from "./core/context.js";
import { getActiveProvider, listProviderInfo } from "./providers/index.js";
import { createStreamingProvider, type ChatMessage } from "./providers/chat.js";
import { runAuditAnalysis } from "./commands/audit.js";
import {
  configureModelInteractive,
  configureProviderInteractive,
  getCurrentProviderConfiguration,
  selectProviderInteractively,
} from "./commands/providers.js";
import { runExplainAnalysis } from "./commands/explain.js";
import { readHunoFile } from "./storage/huno-dir.js";
import { parseProjectMap } from "./storage/project-map.js";
import { appendMemory, readMemoryFile, parseMemoryEntries, searchMemory } from "./storage/memory-file.js";
import { appendSession, readSessionHistory } from "./storage/huno-dir.js";
import { getProjectRoot } from "./utils/paths.js";
import { loadConfig, defaultConfig } from "./core/config.js";
import { runConversation, type Snapshot } from "./core/conversation.js";
import { allTools } from "./tools/index.js";
import { createInterface, emitKeypressEvents } from "readline";
import { startSpinner, writeStatus } from "./ui/spinner.js";
import { renderLogo } from "./ui/logo.js";
import {
  filterDropdownItems,
  renderDropdownRows as renderTerminalDropdownRows,
  type DropdownItem,
} from "./ui/terminal-select.js";
import { brand, neutral, progress } from "./ui/theme.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));
const VERSION = pkg.version;

const SLASH_COMMANDS: { name: string; usage: string; description: string }[] = [
  { name: "/help", usage: "/help", description: "Show available slash commands" },
  { name: "/ask", usage: "/ask <question>", description: "Ask a question about your project" },
  { name: "/providers", usage: "/providers", description: "List supported providers" },
  { name: "/configure", usage: "/configure", description: "Configure provider and model" },
  { name: "/provider", usage: "/provider <name>", description: "Switch provider" },
  { name: "/model", usage: "/model [name]", description: "Show or change model" },
  { name: "/audit", usage: "/audit", description: "Run project audit" },
  { name: "/explain", usage: "/explain", description: "Explain the project structure" },
  { name: "/remember", usage: "/remember <text>", description: "Save a project memory" },
  { name: "/recall", usage: "/recall <query>", description: "Search project memories" },
  { name: "/context", usage: "/context", description: "Show context files" },
  { name: "/clear", usage: "/clear", description: "Clear screen and reset conversation" },
  { name: "/new", usage: "/new", description: "Start a new conversation" },
  { name: "/undo", usage: "/undo", description: "Undo last tool action" },
  { name: "/tools", usage: "/tools", description: "List available tools" },
  { name: "/sessions", usage: "/sessions", description: "Show recent session history" },
  { name: "/exit", usage: "/exit", description: "Exit Huno" },
  { name: "/audit-providers", usage: "/audit-providers", description: "Verify all providers connectivity" },
  { name: "/benchmark", usage: "/benchmark", description: "Benchmark all models across providers" },
];

function showHelp(): void {
  console.log();
  console.log(chalk.hex(progress.active)("  ◈") + " Slash Commands:");
  SLASH_COMMANDS.forEach((cmd) => {
    console.log(chalk.hex(brand.secondary)("    " + cmd.usage.padEnd(18)) + chalk.hex(neutral.muted)(cmd.description));
  });
  console.log();
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

async function showModelStatus(): Promise<void> {
  const result = await getCurrentProviderConfiguration();
  if (!result.ok) {
    console.log(chalk.red("  ✗ " + result.error.message));
    if (result.error.hint) console.log(chalk.dim("  " + result.error.hint));
    return;
  }
  console.log();
  console.log(chalk.bold.white("  Current Model Configuration:"));
  console.log(chalk.cyan(`  provider: ${currentProviderName || result.data.provider}`));
  console.log(`  model: ${currentModelName || result.data.model}`);
  if (currentProviderName || currentModelName) {
    console.log(chalk.dim("  (Using inline override. Use /clear to reset.)"));
  }
  console.log();
}

function getContextFiles(): string[] {
  const result = readHunoFileSync("project-map.json");
  if (result) {
    try {
      const map = parseProjectMap(result);
      if (map.ok) {
        return map.data.importantFiles.slice(0, 5);
      }
    } catch {}
  }
  return [];
}

function readHunoFileSync(filename: string): string | null {
  try {
    const { readFileSync } = require("fs");
    const { join } = require("path");
    return readFileSync(join(process.cwd(), ".huno", filename), "utf-8");
  } catch {
    return null;
  }
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

async function runAskWithConversation(
  question: string,
  history: ChatMessage[],
  providerName?: string,
  modelName?: string,
  onStream?: (text: string) => void
): Promise<{ history: ChatMessage[]; snapshots: Snapshot[] }> {
  // Phase 1: Building context
  const spinCtx = startSpinner("Building context", "\x1b[36m");
  const contextResult = await buildContext(question);
  if (!contextResult.ok) {
    spinCtx.stop();
    console.log(chalk.red("  ✗ " + contextResult.error.message));
    if (contextResult.error.hint) console.log(chalk.dim("  " + contextResult.error.hint));
    console.log();
    return { history, snapshots: [] };
  }
  spinCtx.stop();
  writeStatus("✓", "Context built", "\x1b[32m");

  const context = contextResult.data;

  // Phase 2: Selecting provider
  const spinProv = startSpinner("Selecting provider", "\x1b[36m");
  const providerResult = await getActiveProvider({
    provider: providerName,
    model: modelName,
  });
  spinProv.stop();
  if (!providerResult.ok) {
    console.log(chalk.red("  ✗ " + providerResult.error.message));
    if (providerResult.error.hint) console.log(chalk.dim("  " + providerResult.error.hint));
    console.log();
    return { history, snapshots: [] };
  }
  writeStatus("✓", providerResult.data.name + " / " + providerResult.data.model, "\x1b[32m");

  const baseProvider = providerResult.data;
  const configResult = await loadConfig();
  const config = configResult.ok ? configResult.data : defaultConfig();
  const streamingProvider = createStreamingProvider(baseProvider, config);

  // Build initial messages with project context (first turn only)
  if (history.length === 0) {
    const projectMapResult = readHunoFileSync("project-map.json");
    if (projectMapResult) {
      try {
        const map = parseProjectMap(projectMapResult);
        if (map.ok) {
          const info = [
            "Project: " + map.data.projectName,
            "Languages: " + (map.data.stack.languages.join(", ") || "unknown"),
            "Frameworks: " + (map.data.stack.frameworks.join(", ") || "none"),
            "Database: " + (map.data.stack.database.join(", ") || "none"),
            "Infrastructure: " + (map.data.stack.infrastructure.join(", ") || "none"),
          ].join("\n");
          history.unshift({ role: "system", content: "## Project Overview\n" + info });
          if (map.data.importantFiles.length > 0) {
            history.unshift({
              role: "system",
              content: "## Important Files\n" + map.data.importantFiles.map((f) => "- " + f).join("\n"),
            });
          }
        }
      } catch {}
    }

    const memoryResult = await readMemoryFile();
    if (memoryResult.ok && memoryResult.data.trim().length > 0) {
      history.unshift({
        role: "system",
        content: "## Project Memory\n" + memoryResult.data,
      });
    }
  }

  // Build user message with context
  const fullPrompt = buildFullPrompt(context);

  // Phase 3: Thinking spinner — stops on first stream token
  const spinThink = startSpinner("Thinking", "\x1b[35m"); // purple
  let thinking = true;
  const hunoIcon = "\x1b[38;2;108;92;231m◈\x1b[0m"; // purple ◈

  const wrappedOnStream = onStream
    ? (text: string) => {
        if (thinking) {
          spinThink.stop();
          process.stdout.write("  " + hunoIcon + "\n\n");
          thinking = false;
        }
        onStream(text);
      }
    : undefined;

  // Tool call loading messages
  const TOOL_LABELS: Record<string, string> = {
    read_file: "Reading",
    write_file: "Writing",
    patch_file: "Patching",
    list_files: "Listing",
    search_files: "Searching",
    run_command: "Running",
    git_status: "Checking git",
    git_diff: "Diffing",
    git_log: "Reading git log",
    git_branch: "Checking branches",
    get_project_map: "Loading project map",
    get_memory: "Recalling memory",
    save_memory: "Saving memory",
    list_definitions: "Scanning definitions",
    fetch_url: "Fetching",
    find_references: "Finding references",
    analyze_dependencies: "Analyzing deps",
    test_runner: "Running tests",
    code_metrics: "Computing metrics",
    check_env: "Checking env",
    shell_exec: "Executing",
    get_config: "Reading config",
  };

  const onToolCall = (toolName: string, argsStr: string) => {
    if (thinking) {
      spinThink.stop();
      thinking = false;
    }
    const label = TOOL_LABELS[toolName] || toolName;
    // Show what file/command is being operated on
    try {
      const args = JSON.parse(argsStr);
      const detail = args.path || args.command || args.query || args.pattern || "";
      if (detail) {
        process.stdout.write(chalk.dim(`  → ${label} ${detail}\n`));
        return;
      }
    } catch {}
    process.stdout.write(chalk.dim(`  → ${label}...\n`));
  };

  // Approval callback
  const onApprove = async (toolName: string, args: Record<string, unknown>): Promise<boolean> => {
    if (toolName === "write_file") {
      console.log(chalk.yellow("  ⚠ Write to " + (args.path as string) + "?"));
    } else if (toolName === "patch_file") {
      console.log(chalk.yellow("  ⚠ Patch " + (args.path as string) + "?"));
    } else if (toolName === "run_command") {
      console.log(chalk.yellow("  ⚠ Run: " + (args.command as string) + "?"));
    }
    const approved = await promptApproval("  Allow? [y/N]");
    return approved;
  };

  // Trim history to fit model context budget
  const budgetedHistory = trimToBudget(history);

  // Run conversation with tools + approval
  let result;
  try {
    result = await runConversation(fullPrompt, budgetedHistory, {
      provider: streamingProvider,
      tools: allTools(),
      maxTurns: 20,
      onApprove,
      onStream: wrappedOnStream,
      onToolCall,
    });
  } catch (err) {
    if (thinking) spinThink.stop();
    throw err;
  }

  // Safety: stop spinner if it never got a token
  if (thinking) {
    spinThink.stop();
  }

  return { history: result.messages, snapshots: result.snapshots };
}

function promptApproval(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(message + " ", (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes");
    });
  });
}

function buildFullPrompt(context: {
  question: string;
  files: { projectMap: string | null; memory: string | null; relevantFiles: { path: string; excerpt: string }[] };
}): string {
  const parts: string[] = [];
  if (context.files.relevantFiles.length > 0) {
    parts.push("## Relevant Files:");
    for (const f of context.files.relevantFiles) {
      parts.push(`\n### ${f.path}\n\`\`\`\n${f.excerpt}\n\`\`\``);
    }
  }
  if (context.files.memory) {
    parts.push(`\n## Project Memory:\n${context.files.memory}`);
  }
  parts.push(`\n## Question:\n${context.question}`);
  return parts.join("\n");
}

// ─── REPL ────────────────────────────────────────────────────────────────────

export const replCommand = new Command("repl").description("Enter interactive mode").action(async () => {
  await runRepl();
});

export async function runRepl(): Promise<void> {
  const root = getProjectRoot();
  const projectName = root.split("/").pop() || "project";
  const contextFiles = getContextFiles();

  // Header — Huno logo + project info
  console.log();
  renderLogo().forEach((line) => console.log("  " + line));
  console.log();
  console.log(chalk.dim("  ─────────────────────────────────────────────────────"));
  console.log(chalk.hex(progress.active)("  ◈") + " Huno · " + chalk.dim("· v" + VERSION));
  console.log(chalk.hex(progress.active)("  ◈") + " Created by: " + chalk.bold.white("LK-Hour"));
  if (contextFiles.length > 0) {
    contextFiles.forEach((f) => console.log(chalk.dim("    → " + f)));
  }
  console.log();

  // Preflight API check
  const spin = startSpinner("Checking API", "\x1b[36m");
  const preflight = await preflightCheck();
  spin.stop();
  if (preflight.ok) {
    writeStatus("✓", preflight.provider + " / " + preflight.model, "\x1b[32m");
  } else {
    writeStatus("✗", preflight.error || "No provider configured", "\x1b[31m");
    console.log();
    console.log(chalk.yellow("  ⚡ No AI provider configured yet."));
    console.log(chalk.dim("  To get started, run one of:"));
    console.log(chalk.cyan("    huno configure") + chalk.dim("   — interactive setup wizard (recommended)"));
    console.log(chalk.cyan("    /configure") + chalk.dim("       — same wizard from within this REPL"));
    console.log(chalk.dim("  Then add your API key when prompted."));
  }

  console.log();
  console.log(chalk.dim("  /help for commands · /exit to quit"));
  console.log();

  await startReplLoop(projectName, contextFiles);
}

let conversationHistory: ChatMessage[] = [];
let currentProviderName: string | undefined;
let currentModelName: string | undefined;
let turnSnapshots: Snapshot[] = [];

// ── Readline history persistence ──────────────────────────────────────────
import fs from "fs/promises";
import fspath from "path";

const MAX_HISTORY = 500;

function getHistoryPath(): string {
  try {
    const { getHunoDir } = require("./utils/paths.js") as { getHunoDir: () => string };
    return fspath.join(getHunoDir(), "input_history.txt");
  } catch {
    return fspath.join(process.cwd(), ".huno", "input_history.txt");
  }
}

async function loadHistory(): Promise<string[]> {
  try {
    const content = await fs.readFile(getHistoryPath(), "utf-8");
    return content.split("\n").filter(Boolean).slice(-MAX_HISTORY);
  } catch {
    return [];
  }
}

async function saveHistory(entry: string): Promise<void> {
  if (!entry.trim()) return;
  try {
    const historyPath = getHistoryPath();
    await fs.mkdir(fspath.dirname(historyPath), { recursive: true });
    await fs.appendFile(historyPath, entry + "\n");
  } catch { /* best effort */ }
}

// ── Token budget: trim old messages ──────────────────────────────────────
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  "gpt-4": 8192,
  "gpt-4o": 128000,
  "gpt-4.1": 1047576,
  "gpt-4.1-mini": 1047576,
  "claude-sonnet": 200000,
  "claude-sonnet-4": 200000,
  "gemini-2.0-flash": 1048576,
  "gemini-2.5-pro": 1048576,
  default: 128000,
};

function estimateTokens(messages: ChatMessage[]): number {
  // Rough: 1 token ≈ 4 chars
  return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
}

function trimToBudget(messages: ChatMessage[], maxTokens: number = MODEL_CONTEXT_LIMITS.default): ChatMessage[] {
  const budget = Math.floor(maxTokens * 0.85); // leave 15% for response
  let total = estimateTokens(messages);

  if (total <= budget) return messages;

  // Keep system messages + trim oldest user/assistant pairs
  const systemMsgs = messages.filter((m) => m.role === "system");
  const chatMsgs = messages.filter((m) => m.role !== "system");

  while (chatMsgs.length > 2 && estimateTokens([...systemMsgs, ...chatMsgs]) > budget) {
    // Remove oldest pair (user + assistant)
    if (chatMsgs[0].role === "user" && chatMsgs[1]?.role === "assistant") {
      chatMsgs.splice(0, 2);
    } else {
      chatMsgs.shift();
    }
  }

  return [...systemMsgs, ...chatMsgs];
}

// ── API preflight check ──────────────────────────────────────────────────
async function preflightCheck(): Promise<{ ok: boolean; provider: string; model: string; error?: string }> {
  try {
    const result = await getActiveProvider({ provider: currentProviderName, model: currentModelName });
    if (!result.ok) {
      return { ok: false, provider: "", model: "", error: result.error.message };
    }
    const p = result.data;
    const baseURL = (p as any).baseURL as string | undefined;
    const apiKey = (p as any).apiKey as string | undefined;
    // Skip connectivity test if provider doesn't expose a valid baseURL
    if (!baseURL || !baseURL.startsWith("http")) {
      return { ok: true, provider: p.name, model: p.model };
    }
    // Quick connectivity test — models/list is cheap
    try {
      const resp = await fetch(`${baseURL.replace(/\/$/, "")}/models`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) {
        // Non-200 doesn't mean unusable — some providers don't expose /models
        return { ok: true, provider: p.name, model: p.model };
      }
    } catch {
      // Connection test failed — provider may still work for chat, don't block REPL
      return { ok: true, provider: p.name, model: p.model };
    }
    return { ok: true, provider: p.name, model: p.model };
  } catch {
    return { ok: false, provider: "", model: "", error: "No provider configured" };
  }
}

async function startReplLoop(_projectName: string, _contextFiles: string[]): Promise<void> {
  // Load input history
  const history = await loadHistory();

  return new Promise<void>((resolveLoop) => {

  // Ensure keypress events are emitted on stdin (needed for dropdown raw mode)
  emitKeypressEvents(process.stdin);

  let rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.hex(brand.secondary)("  > "),
    terminal: true,
    history,
    historySize: MAX_HISTORY,
  });

  // Handle close (EOF / /exit)
  let exited = false;
  let suppressCloseExit = false;
  rl.on("close", () => {
    if (!exited && !suppressCloseExit) {
      exited = true;
      console.log(chalk.dim("\n  Goodbye.\n"));
      resolveLoop();
    }
  });

  // Slash command dropdown state
  let dropdownActive = false;
  let dropdownSelected = 0;
  let dropdownFiltered = SLASH_COMMANDS.map((_, i) => i);
  let dropdownQuery = "";
  let dropdownRenderedRows = 0; // track how many rows were last drawn

  // Tab completion for slash commands (legacy — now handled by dropdown)
  (rl as any).completer = (line: string, cb: (err: any, matches: string[]) => void) => {
    cb(null, []);
  };

  // Reset dropdown
  function resetDropdown() {
    dropdownActive = false;
    dropdownSelected = 0;
    dropdownFiltered = SLASH_COMMANDS.map((_, i) => i);
    dropdownQuery = "";
    dropdownRenderedRows = 0;
  }

  // Render the dropdown rows (highlighted selected row)
  function renderDropdownRows(): string[] {
    const items: DropdownItem<number>[] = dropdownFiltered.map((cmdIdx) => {
      const cmd = SLASH_COMMANDS[cmdIdx];
      const namePadded = cmd.name.padEnd(16);
      return {
        value: cmdIdx,
        label: `${chalk.hex(progress.active)(namePadded)}${chalk.hex(neutral.muted)(cmd.description)}`,
        searchableText: `${cmd.name} ${cmd.description}`,
      };
    });
    return renderTerminalDropdownRows(items, dropdownSelected);
  }

  // Redraw the entire dropdown + prompt from scratch
  function redrawDropdown() {
    const promptPrefix = chalk.hex(brand.secondary)("  > ");
    // Cursor is at end of prompt line. Dropdown rows are above it.
    if (dropdownRenderedRows > 0) {
      // Move up to first dropdown row, go to column 0, clear to end of screen
      process.stdout.write(`\x1b[${dropdownRenderedRows}A\r\x1b[J`);
    } else {
      // No dropdown rows rendered previously; just clear current prompt line
      process.stdout.write("\r\x1b[J");
    }

    const numDropdownRows = dropdownFiltered.length;
    if (numDropdownRows === 0) {
      process.stdout.write(promptPrefix + "/" + dropdownQuery);
      dropdownRenderedRows = 0;
      return;
    }
    // Print rows then prompt
    const rows = renderDropdownRows();
    process.stdout.write(rows.join("\n") + "\n");
    process.stdout.write(promptPrefix + "/" + dropdownQuery);
    dropdownRenderedRows = numDropdownRows;
  }

  // Show the slash command dropdown (closes readline, enters raw mode)
  function showDropdown(initialQuery: string) {
    dropdownQuery = initialQuery;
    dropdownFiltered = filterDropdownItems(getSlashDropdownItems(), initialQuery).map(
      (item) => item.value
    );
    dropdownSelected = 0;
    dropdownActive = true;

    // Remove our slash detector while dropdown is active
    process.stdin.removeListener("keypress", slashDetector);

    // Close readline to release stdin for raw mode
    suppressCloseExit = true;
    rl.pause();
    rl.close();

    // Use setImmediate so readline fully releases stdin before we enter raw mode
    setImmediate(() => {
      // Clear the current line (readline may have echoed "/")
      process.stdout.write("\x1b[2K\r");

      const promptPrefix = chalk.hex(brand.secondary)("  > ");

      // Print dropdown rows first (above the prompt)
      const rows = renderDropdownRows();
      if (rows.length > 0) {
        process.stdout.write(rows.join("\n") + "\n");
      }
      dropdownRenderedRows = rows.length;

      // Print the prompt line with the current query at the bottom
      process.stdout.write(promptPrefix + "/" + dropdownQuery);

      // Enter raw mode and listen for keys
      if (process.stdin.isTTY) process.stdin.setRawMode(true);
      process.stdin.resume();

      process.stdin.on("keypress", handleDropdownKeypress);
    });
  }

  // Handle keypress during dropdown (raw mode)
  function handleDropdownKeypress(_char: string, key: any) {
    if (!dropdownActive) return;

    // Ctrl+C
    if (key && key.ctrl && key.name === "c") {
      teardownDropdown("");
      return;
    }

    // Escape — dismiss
    if (key && key.name === "escape") {
      teardownDropdown("");
      return;
    }

    // Enter — select current item
    if (key && (key.name === "return" || key.name === "enter")) {
      const selectedName = dropdownFiltered.length > 0
        ? SLASH_COMMANDS[dropdownFiltered[dropdownSelected]].name + " "
        : "/" + dropdownQuery;
      teardownDropdown(selectedName);
      return;
    }

    // Up arrow
    if (key && key.name === "up") {
      if (dropdownSelected > 0) {
        dropdownSelected--;
        redrawDropdown();
      }
      return;
    }

    // Down arrow
    if (key && key.name === "down") {
      if (dropdownSelected < dropdownFiltered.length - 1) {
        dropdownSelected++;
        redrawDropdown();
      }
      return;
    }

    // Backspace
    if (key && key.name === "backspace") {
      if (dropdownQuery.length > 0) {
        dropdownQuery = dropdownQuery.slice(0, -1);
        refilterDropdown();
        redrawDropdown();
      } else {
        // Backspace on empty query — dismiss
        teardownDropdown("");
      }
      return;
    }

    // Tab — select current item (same as Enter)
    if (key && key.name === "tab") {
      const selectedName = dropdownFiltered.length > 0
        ? SLASH_COMMANDS[dropdownFiltered[dropdownSelected]].name + " "
        : "/" + dropdownQuery;
      teardownDropdown(selectedName);
      return;
    }

    // Regular character
    if (_char && !_char.startsWith("\x1b") && key && !key.ctrl && !key.meta) {
      dropdownQuery += _char;
      refilterDropdown();
      redrawDropdown();
    }
  }

  // Refilter commands based on current query
  function refilterDropdown() {
    dropdownFiltered = filterDropdownItems(getSlashDropdownItems(), dropdownQuery).map(
      (item) => item.value
    );
    if (dropdownSelected >= dropdownFiltered.length) {
      dropdownSelected = Math.max(0, dropdownFiltered.length - 1);
    }
  }

  function getSlashDropdownItems(): DropdownItem<number>[] {
    return SLASH_COMMANDS.map((cmd, index) => ({
      value: index,
      label: `${cmd.name} ${cmd.description}`,
      searchableText: `${cmd.name} ${cmd.description}`,
    }));
  }

  // Tear down dropdown mode and recreate readline
  function teardownDropdown(result: string) {
    // Remove our keypress handler
    process.stdin.removeListener("keypress", handleDropdownKeypress);

    // Exit raw mode before recreating readline
    if (process.stdin.isTTY) process.stdin.setRawMode(false);

    // Clear dropdown from screen using tracked row count
    const rowsToClear = dropdownRenderedRows;
    if (rowsToClear > 0) {
      // Cursor is on prompt line; dropdown rows are above
      process.stdout.write(`\x1b[${rowsToClear}A\r\x1b[J`);
    } else {
      // Just clear the current prompt line
      process.stdout.write("\x1b[2K\r");
    }

    resetDropdown();

    // Recreate readline (stdin.resume is called internally by createInterface)
    rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.hex(brand.secondary)("  > "),
      terminal: true,
      history,
      historySize: MAX_HISTORY,
    });
    suppressCloseExit = false;
    rl.on("close", () => {
      if (!exited && !suppressCloseExit) {
        exited = true;
        console.log(chalk.dim("\n  Goodbye.\n"));
        resolveLoop();
      }
    });
    rl.on("line", onLine);

    // Re-register slash detector
    process.stdin.on("keypress", slashDetector);

    rl.prompt();
    // If a command was selected, inject it into the readline buffer
    if (result) {
      rl.write(result);
    }
  }

  // Handle Ctrl+C
  process.on("SIGINT", () => {
    if (!exited) {
      exited = true;
      console.log(chalk.dim("\n  Goodbye.\n"));
      rl.close();
      resolveLoop();
    }
  });

  // Keypress listener: detect "/" at start of line to open slash-command dropdown
  function slashDetector(_char: string, _key: any) {
    if (dropdownActive) return;
    if (_char !== "/") return;
    const currentLine = ((rl as any).line || "") as string;
    if (currentLine === "" || currentLine === "/") {
      showDropdown("");
    }
  }
  process.stdin.on("keypress", slashDetector);

    // Track whether we're in an interactive action (raw mode)
    let interactiveAction: (() => Promise<void>) | null = null;

    const onLine = async (line: string): Promise<void> => {
      const input = line.trim();

      if (!input) {
        rl.prompt();
        return;
      }

      // Persist input history (async, don't await)
      saveHistory(input);

      // If we're in an interactive action, ignore line events
      if (interactiveAction) return;

      // Handle /exit
      if (input === "/exit" || input === "/quit") {
        console.log(chalk.dim("\n  Goodbye.\n"));
        exited = true;
        rl.close();
        resolveLoop();
        return;
      }

      // Handle /clear or /new
      if (input === "/clear" || input === "/new") {
        console.clear();
        conversationHistory = [];
        currentProviderName = undefined;
        currentModelName = undefined;
        turnSnapshots = [];
        rl.prompt();
        return;
      }

      // Handle /help
      if (input === "/help") {
        showHelp();
        rl.prompt();
        return;
      }

      // Handle /providers
      if (input === "/providers") {
        showProviders();
        rl.prompt();
        return;
      }

      // Handle /provider (no args)
      if (input === "/provider") {
        interactiveAction = async () => {
          const current = await getCurrentProviderConfiguration();
          console.log();
          if (current.ok) {
            console.log(chalk.bold.white("  Current Provider:"));
            console.log(chalk.hex(brand.secondary)(`  ${currentProviderName || current.data.provider}`));
            if (currentProviderName) {
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

          currentProviderName = selected.name;
          currentModelName = undefined;
          conversationHistory = [];
          turnSnapshots = [];
          console.log(chalk.green(`  ✓ Provider switched to: ${selected.name}`));
          console.log();
        };
        await runInteractiveAction(interactiveAction, () => { interactiveAction = null; });
        rl.prompt();
        return;
      }

      // Handle /configure
      if (input === "/configure") {
        interactiveAction = async () => {
          const result = await configureProviderInteractive();
          if (!result.ok) {
            console.log(chalk.red("  ✗ " + result.error.message));
            if (result.error.hint) console.log(chalk.dim("  " + result.error.hint));
          } else {
            console.log();
            console.log(chalk.green(`  ✓ Configured: ${result.data.provider} (${result.data.model})`));
            conversationHistory = [];
            currentProviderName = undefined;
            currentModelName = undefined;
          }
        };
        await runInteractiveAction(interactiveAction, () => { interactiveAction = null; });
        rl.prompt();
        return;
      }

      // Handle /provider <name>
      if (input.startsWith("/provider ")) {
        const requestedProvider = input.slice(10).trim();
        if (!requestedProvider) {
          console.log(chalk.yellow("  Usage: /provider <name>"));
          console.log();
          rl.prompt();
          return;
        }
        const provider = resolveProviderName(requestedProvider);
        if (!provider) {
          console.log(chalk.red(`  ✗ Unknown provider: ${requestedProvider}`));
          console.log(chalk.dim(`  Supported: ${supportedProviderNames()}`));
          console.log();
          rl.prompt();
          return;
        }
        currentProviderName = provider;
        currentModelName = undefined;
        conversationHistory = [];
        turnSnapshots = [];
        console.log(chalk.green(`  ✓ Provider switched to: ${provider}`));
        console.log();
        rl.prompt();
        return;
      }

      // Handle /model <name>
      if (input.startsWith("/model ")) {
        const model = input.slice(7).trim();
        if (!model) {
          console.log(chalk.yellow("  Usage: /model <name>"));
          console.log();
          rl.prompt();
          return;
        }
        currentModelName = model;
        console.log(chalk.green(`  ✓ Model switched to: ${model}`));
        console.log();
        rl.prompt();
        return;
      }

      // Handle /model (no args)
      if (input === "/model") {
        interactiveAction = async () => {
          await showModelStatus();
          console.log(chalk.bold.white("  Select a Model"));
          const result = await configureModelInteractive();
          if (!result.ok) {
            console.log(chalk.red("  ✗ " + result.error.message));
            if (result.error.hint) console.log(chalk.dim("  " + result.error.hint));
          } else {
            console.log();
            console.log(chalk.green(`  ✓ Model configured: ${result.data.provider} (${result.data.model})`));
            conversationHistory = [];
            currentProviderName = undefined;
            currentModelName = undefined;
            turnSnapshots = [];
          }
        };
        await runInteractiveAction(interactiveAction, () => { interactiveAction = null; });
        rl.prompt();
        return;
      }

      // Handle /context
      if (input === "/context") {
        console.log(chalk.bold.white("  Project Context:"));
        _contextFiles.forEach((f) => console.log(chalk.dim(`    - ${f}`)));
        console.log();
        rl.prompt();
        return;
      }

      // Handle /audit
      if (input === "/audit") {
        await runAudit();
        rl.prompt();
        return;
      }

      // Handle /explain
      if (input === "/explain") {
        await runExplain();
        rl.prompt();
        return;
      }

      // Handle /tools
      if (input === "/tools") {
        console.log();
        console.log(chalk.bold.white("  Available Tools"));
        console.log(chalk.dim("  The model can request these tools:"));
        console.log();
        console.log(chalk.dim("  ── File Tools ──"));
        const tools = [
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
        ];
        tools.forEach(([name, desc]) => {
          console.log(`    ${chalk.cyan(name.padEnd(18))} ${chalk.dim(desc)}`);
        });
        console.log();
        console.log(chalk.dim("  ── Git Tools ──"));
        const gitToolsList = [
          ["git_status", "Show current git status"],
          ["git_diff", "Show diff of changes"],
          ["git_log", "Show commit history"],
          ["git_branch", "Show current branch"],
        ];
        gitToolsList.forEach(([name, desc]) => {
          console.log(`    ${chalk.cyan(name.padEnd(18))} ${chalk.dim(desc)}`);
        });
        console.log();
        console.log(chalk.dim("  ── Project Tools ──"));
        const projectToolsList = [
          ["get_project_map", "Get project structure summary"],
          ["get_memory", "Search project memories"],
          ["save_memory", "Save a project memory"],
          ["get_config", "Read Huno configuration"],
          ["list_definitions", "List code definitions"],
        ];
        projectToolsList.forEach(([name, desc]) => {
          console.log(`    ${chalk.cyan(name.padEnd(18))} ${chalk.dim(desc)}`);
        });
        console.log();
        rl.prompt();
        return;
      }

      // Handle /sessions
      if (input === "/sessions") {
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
        rl.prompt();
        return;
      }

      // Handle /remember (no args)
      if (input === "/remember") {
        console.log(chalk.yellow("  Usage: /remember <text>"));
        console.log();
        rl.prompt();
        return;
      }

      // Handle /remember <text>
      if (input.startsWith("/remember ")) {
        const text = input.slice(10).trim();
        if (!text) {
          console.log(chalk.yellow("  Usage: /remember <text>"));
          console.log();
          rl.prompt();
          return;
        }
        await runRemember(text);
        rl.prompt();
        return;
      }

      // Handle /recall (no args)
      if (input === "/recall") {
        console.log(chalk.yellow("  Usage: /recall <query>"));
        console.log();
        rl.prompt();
        return;
      }

      // Handle /recall <query>
      if (input.startsWith("/recall ")) {
        const query = input.slice(8).trim();
        if (!query) {
          console.log(chalk.yellow("  Usage: /recall <query>"));
          console.log();
          rl.prompt();
          return;
        }
        await runRecall(query);
        rl.prompt();
        return;
      }

      // Handle /undo
      if (input === "/undo") {
        if (turnSnapshots.length === 0) {
          console.log(chalk.dim("  Nothing to undo."));
          console.log();
          rl.prompt();
          return;
        }
        const snapshot = turnSnapshots.pop()!;
        const undoResult = await snapshot.undo();
        console.log(chalk.green(`  ↩ ${undoResult}`));
        console.log();
        rl.prompt();
        return;
      }

      // Handle /audit-providers
      if (input === "/audit-providers") {
        console.log();
        const { runProviderAudit } = await import("./commands/providers-audit.js");
        await runProviderAudit();
        if (!exited) rl.prompt();
        return;
      }

      // Handle /benchmark
      if (input === "/benchmark") {
        console.log();
        const { runProviderBenchmark } = await import("./commands/providers-benchmark.js");
        await runProviderBenchmark();
        if (!exited) rl.prompt();
        return;
      }

      // Handle /ask <question>
      if (input.startsWith("/ask ")) {
        const question = input.slice(5).trim();
        if (!question) {
          console.log(chalk.yellow("  Usage: /ask <question>"));
          console.log();
          rl.prompt();
          return;
        }
        await runChat(question, rl);
        if (!exited) rl.prompt();
        return;
      }

      // Default: treat as chat question
      await runChat(input, rl);
      if (!exited) rl.prompt();
    };

    async function runInteractiveAction(
      action: () => Promise<void>,
      onDone: () => void
    ): Promise<void> {
      return new Promise((resolve) => {
          // Close readline to release stdin for raw mode.
          // Suppress the close handler so it doesn't trigger exit.
          suppressCloseExit = true;
          rl.close();
          action().then(() => {
            // Re-create readline interface
            rl = createInterface({
              input: process.stdin,
              output: process.stdout,
              prompt: chalk.hex(brand.secondary)("  > "),
              terminal: true,
            });
            rl.on("close", () => {
              if (!exited && !suppressCloseExit) {
                exited = true;
                console.log(chalk.dim("\n  Goodbye.\n"));
                resolveLoop();
              }
            });
            suppressCloseExit = false;
            rl.on("line", onLine);
            onDone();
            rl.prompt();
            resolve();
          });
        });
    }

    rl.on("line", onLine);
    rl.prompt();
  }); // end Promise
}

async function runChat(input: string, rl: ReturnType<typeof createInterface>): Promise<void> {
  // User message
  console.log();
  console.log(chalk.hex(brand.secondary)("  >") + " " + input);
  console.log();

  try {
    // Spinning + streaming handled inside runAskWithConversation
    const result = await runAskWithConversation(
      input,
      conversationHistory,
      currentProviderName,
      currentModelName,
      (text: string) => {
        process.stdout.write(text);
      }
    );
    conversationHistory = result.history;
    turnSnapshots = result.snapshots;

    // Separator + status after response
    console.log();
    console.log(chalk.dim("  ─────────────────────────────────────────────────────"));
    const provider = currentProviderName || "";
    const model = currentModelName || "";
    if (provider || model) {
      console.log(chalk.dim("  " + [provider, model].filter(Boolean).join(" · ")));
    }

    // Save to session history
    const lastAssistant = result.history.filter((m) => m.role === "assistant").pop();
    if (lastAssistant) {
      await appendSession({
        ts: new Date().toISOString(),
        role: "user",
        content: input,
      });
      await appendSession({
        ts: new Date().toISOString(),
        role: "assistant",
        content: lastAssistant.content || "(tool calls)",
      });
    }
  } catch (err) {
    console.log();
    console.log(chalk.red("  ✗ " + (err instanceof Error ? err.message : String(err))));
    console.log(chalk.dim("  Check your provider/model configuration with /configure"));
    console.log();
  }
}
