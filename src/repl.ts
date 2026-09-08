import { Command } from "commander";
import chalk from "chalk";
import { buildContext } from "./core/context.js";
import { getActiveProvider } from "./providers/index.js";
import { createStreamingProvider, type ChatMessage } from "./providers/chat.js";
import { parseProjectMap } from "./storage/project-map.js";
import { readMemoryFile } from "./storage/memory-file.js";
import { appendSession } from "./storage/huno-dir.js";
import { getProjectRoot } from "./utils/paths.js";
import { loadConfig, defaultConfig } from "./core/config.js";
import { runConversation, type Snapshot } from "./core/conversation.js";
import { allTools } from "./tools/index.js";
import { requestApproval } from "./core/approval.js";
import { describeToolCall, buildFullPrompt } from "./core/chat-ui.js";
import { createInterface, emitKeypressEvents, type Interface } from "readline";
import { startSpinner, writeStatus } from "./ui/spinner.js";
import { renderLogo } from "./ui/logo.js";
import { brand, progress } from "./ui/theme.js";
import { readFileSync } from "fs";
import { join } from "path";
import { ReplSession } from "./repl/session.js";
import { trimToBudget } from "./repl/token-budget.js";
import { loadHistory, saveHistory, MAX_HISTORY } from "./repl/history.js";
import { createSlashDropdown } from "./repl/dropdown.js";
import { buildSlashCommands, findSlashCommand, type ReplRuntime } from "./repl/slash-commands.js";
import { checkForUpdate } from "./utils/version-check.js";
import { VERSION } from "./utils/version.js";

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
    return readFileSync(join(process.cwd(), ".huno", filename), "utf-8");
  } catch {
    return null;
  }
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

  const onToolCall = (toolName: string, argsStr: string) => {
    if (thinking) {
      spinThink.stop();
      thinking = false;
    }
    process.stdout.write(chalk.dim(describeToolCall(toolName, argsStr) + "\n"));
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
      onApprove: requestApproval,
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

  const updateStatus = await checkForUpdate(VERSION).catch(() => null);
  if (updateStatus?.hasUpdate) {
    console.log();
    console.log(
      chalk.hex(brand.secondary)("  ✨ Update available: ") +
        chalk.dim(`v${updateStatus.current} → `) +
        chalk.bold.white(`v${updateStatus.latest}`) +
        chalk.dim(" · run `huno update`")
    );
  }

  console.log();
  console.log(chalk.dim("  /help for commands · /exit to quit"));
  console.log();

  await startReplLoop(projectName, contextFiles);
}

// ── API preflight check ──────────────────────────────────────────────────
async function preflightCheck(
  providerName?: string,
  modelName?: string
): Promise<{ ok: boolean; provider: string; model: string; error?: string }> {
  try {
    const result = await getActiveProvider({ provider: providerName, model: modelName });
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

async function startReplLoop(_projectName: string, contextFiles: string[]): Promise<void> {
  const history = await loadHistory();

  return new Promise<void>((resolveLoop) => {
    // Ensure keypress events are emitted on stdin (needed for dropdown raw mode)
    emitKeypressEvents(process.stdin);

    const promptText = chalk.hex(brand.secondary)("  > ");
    const session = new ReplSession();
    const slashCommands = buildSlashCommands();

    let exited = false;
    let suppressCloseExit = false;
    let interactiveActionInProgress = false;

    function createReplReadline(): Interface {
      const newRl = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: promptText,
        terminal: true,
        history,
        historySize: MAX_HISTORY,
      });
      newRl.on("close", () => {
        if (!exited && !suppressCloseExit) {
          exited = true;
          console.log(chalk.dim("\n  Goodbye.\n"));
          resolveLoop();
        }
      });
      return newRl;
    }

    let rl = createReplReadline();

    const dropdown = createSlashDropdown(
      slashCommands.map((c) => ({ name: c.name, description: c.description })),
      {
        getRl: () => rl,
        closeForRawMode: () => {
          suppressCloseExit = true;
          rl.pause();
          rl.close();
        },
        recreateRl: () => {
          rl = createReplReadline();
          suppressCloseExit = false;
          rl.on("line", onLine);
          return rl;
        },
      }
    );

    // Close readline to release stdin for an interactive picker (/configure,
    // /provider, /model), then reopen it once the picker resolves.
    async function runInteractive(action: () => Promise<void>): Promise<void> {
      return new Promise((resolve) => {
        interactiveActionInProgress = true;
        suppressCloseExit = true;
        rl.close();
        action().then(() => {
          rl = createReplReadline();
          suppressCloseExit = false;
          rl.on("line", onLine);
          interactiveActionInProgress = false;
          rl.prompt();
          resolve();
        });
      });
    }

    function exit(): void {
      console.log(chalk.dim("\n  Goodbye.\n"));
      exited = true;
      rl.close();
      resolveLoop();
    }

    async function runChat(input: string): Promise<void> {
      console.log();
      console.log(chalk.hex(brand.secondary)("  >") + " " + input);
      console.log();

      try {
        const result = await runAskWithConversation(
          input,
          session.history,
          session.providerName,
          session.modelName,
          (text: string) => {
            process.stdout.write(text);
          }
        );
        session.history = result.history;
        session.snapshots = result.snapshots;

        console.log();
        console.log(chalk.dim("  ─────────────────────────────────────────────────────"));
        const provider = session.providerName || "";
        const model = session.modelName || "";
        if (provider || model) {
          console.log(chalk.dim("  " + [provider, model].filter(Boolean).join(" · ")));
        }

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

    const runtime: ReplRuntime = { session, contextFiles, exit, runInteractive, runChat };

    // Handle Ctrl+C
    process.on("SIGINT", () => {
      if (!exited) {
        exited = true;
        console.log(chalk.dim("\n  Goodbye.\n"));
        rl.close();
        resolveLoop();
      }
    });

    dropdown.attachDetector();

    const onLine = async (line: string): Promise<void> => {
      const input = line.trim();

      if (!input) {
        rl.prompt();
        return;
      }

      // Persist input history (async, don't await)
      saveHistory(input);

      // If we're in an interactive action, ignore line events
      if (interactiveActionInProgress) return;

      const spaceIdx = input.indexOf(" ");
      const cmdName = spaceIdx === -1 ? input : input.slice(0, spaceIdx);
      const arg = spaceIdx === -1 ? "" : input.slice(spaceIdx + 1).trim();
      const cmd = input.startsWith("/") ? findSlashCommand(slashCommands, cmdName) : undefined;

      if (cmd) {
        await cmd.handler(arg, runtime);
        if (!exited) rl.prompt();
        return;
      }

      // Unrecognized input (including unknown slash commands) is sent to the model.
      await runtime.runChat(input);
      if (!exited) rl.prompt();
    };

    rl.on("line", onLine);
    rl.prompt();
  });
}
