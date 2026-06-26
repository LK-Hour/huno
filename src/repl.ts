import { Command } from "commander";
import chalk from "chalk";
import { buildContext } from "./core/context.js";
import { getActiveProvider, listProviderInfo } from "./providers/index.js";
import { createStreamingProvider, type ChatMessage } from "./providers/chat.js";
import { configureProviderInteractive, getCurrentProviderConfiguration } from "./commands/providers.js";
import { scanProject } from "./core/scanner.js";
import { readHunoFile } from "./storage/huno-dir.js";
import { parseProjectMap } from "./storage/project-map.js";
import { appendMemory, readMemoryFile, parseMemoryEntries, searchMemory } from "./storage/memory-file.js";
import { appendSession, readSessionHistory } from "./storage/huno-dir.js";
import { getProjectRoot } from "./utils/paths.js";
import { loadConfig, defaultConfig } from "./core/config.js";
import { runConversation, type Snapshot } from "./core/conversation.js";
import { allTools } from "./tools/index.js";
import { createInterface } from "readline";
import { startSpinner, writeStatus } from "./ui/spinner.js";
import { renderLogo } from "./ui/logo.js";

const VERSION = "0.1.0";

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
];

function showHelp(): void {
  console.log();
  console.log(chalk.hex("#6C5CE7")("  ◈") + " Slash Commands:");
  SLASH_COMMANDS.forEach((cmd) => {
    console.log(chalk.hex("#00CEC9")("    " + cmd.usage.padEnd(18)) + chalk.dim(cmd.description));
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
  const scanResult = await scanProject();
  if (!scanResult.ok) {
    console.log(chalk.red("  ✗ Scan failed. Run `huno init` first."));
    return;
  }
  const map = scanResult.data;
  const root = map.root;
  const { readdir } = await import("fs/promises");
  const allRootFiles = await readdir(root);
  const issues: { severity: string; category: string; message: string; suggestion: string }[] = [];

  if (allRootFiles.some((f: string) => f.startsWith(".env")) && !allRootFiles.includes(".env.example")) {
    issues.push({ severity: "medium", category: "Configuration", message: ".env exists but no .env.example", suggestion: "Create .env.example" });
  }
  if (!allRootFiles.includes("README.md")) {
    issues.push({ severity: "medium", category: "Documentation", message: "No README.md", suggestion: "Add README.md" });
  }
  if (!allRootFiles.includes(".gitignore")) {
    issues.push({ severity: "medium", category: "Repository", message: "No .gitignore", suggestion: "Create .gitignore" });
  }

  console.log();
  console.log(chalk.bold.white("  Audit Results:"));
  if (issues.length === 0) {
    console.log(chalk.green("  ✓ No issues found!"));
  } else {
    issues.forEach((issue) => {
      const color = issue.severity === "high" ? chalk.red : chalk.yellow;
      console.log(color(`  ⚠ [${issue.category}] ${issue.message}`));
    });
  }
  console.log();
}

async function runExplain(): Promise<void> {
  const result = await scanProject();
  if (!result.ok) {
    console.log(chalk.red("  ✗ Scan failed."));
    return;
  }
  const map = result.data;
  const stack = [...map.stack.languages, ...map.stack.frameworks].join(", ") || "unknown";
  console.log();
  console.log(chalk.bold.white(`  Project: ${map.projectName}`));
  console.log(chalk.dim(`  Stack: ${stack}`));
  if (map.importantFiles.length > 0) {
    console.log("  Important Files:");
    map.importantFiles.forEach((f) => console.log(`    - ${f}`));
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
  const streamingProvider = createStreamingProvider(baseProvider as any, config);

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

  // Run conversation with tools + approval
  const result = await runConversation(fullPrompt, history, {
    provider: streamingProvider,
    tools: allTools(),
    maxTurns: 20,
    onApprove,
    onStream: wrappedOnStream,
    onToolCall,
  });

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
  console.log(chalk.hex("#6C5CE7")("  ◈") + " Huno · " + chalk.dim(projectName + " · v" + VERSION));
  if (contextFiles.length > 0) {
    contextFiles.forEach((f) => console.log(chalk.dim("    → " + f)));
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

async function startReplLoop(_projectName: string, _contextFiles: string[]): Promise<void> {
  let rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.hex("#00CEC9")("  > "),
    terminal: true,
  });

  // Handle close (EOF / /exit)
  let exited = false;
  let suppressCloseExit = false;
  rl.on("close", () => {
    if (!exited && !suppressCloseExit) {
      exited = true;
      console.log(chalk.dim("\n  Goodbye.\n"));
      process.exit(0);
    }
  });

  // Handle Ctrl+C
  process.on("SIGINT", () => {
    if (!exited) {
      exited = true;
      console.log(chalk.dim("\n  Goodbye.\n"));
      rl.close();
      process.exit(0);
    }
  });

    // Track whether we're in an interactive action (raw mode)
    let interactiveAction: (() => Promise<void>) | null = null;

    const onLine = async (line: string): Promise<void> => {
      const input = line.trim();

      if (!input) {
        rl.prompt();
        return;
      }

      // If we're in an interactive action, ignore line events
      if (interactiveAction) return;

      // Handle /exit
      if (input === "/exit" || input === "/quit") {
        console.log(chalk.dim("\n  Goodbye.\n"));
        exited = true;
        rl.close();
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
        const provider = input.slice(10).trim();
        if (!provider) {
          console.log(chalk.yellow("  Usage: /provider <name>"));
          console.log();
          rl.prompt();
          return;
        }
        currentProviderName = provider;
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
        await showModelStatus();
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
        rl.prompt();
        return;
      }

      // Default: treat as chat question
      await runChat(input, rl);
      rl.prompt();
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
              prompt: chalk.hex("#00CEC9")("  > "),
              terminal: true,
            });
            rl.on("close", () => {
              if (!exited && !suppressCloseExit) {
                exited = true;
                console.log(chalk.dim("\n  Goodbye.\n"));
                process.exit(0);
              }
            });
            // Handle Ctrl+C
            process.on("SIGINT", () => {
              if (!exited) {
                exited = true;
                console.log(chalk.dim("\n  Goodbye.\n"));
                rl.close();
                process.exit(0);
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
  }

async function runChat(input: string, rl: ReturnType<typeof createInterface>): Promise<void> {
  // User message
  console.log();
  console.log(chalk.hex("#00CEC9")("  >") + " " + input);
  console.log();

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
}
