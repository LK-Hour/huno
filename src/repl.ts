import { Command } from "commander";
import { spawn } from "child_process";
import { Writable } from "stream";
import React from "react";
import { Box, Text } from "ink";
import chalk from "chalk";
import { renderUI } from "./ui/renderer.js";
import { Header, ReplPrompt, ContextFiles, ErrorBox } from "./ui/components/index.js";
import { buildContext } from "./core/context.js";
import { getActiveProvider, listProviderInfo } from "./providers/index.js";
import { getCurrentProviderConfiguration } from "./commands/providers.js";
import { scanProject } from "./core/scanner.js";
import { readHunoFile } from "./storage/huno-dir.js";
import { parseProjectMap } from "./storage/project-map.js";
import { appendMemory, readMemoryFile, parseMemoryEntries, searchMemory } from "./storage/memory-file.js";
import { getProjectRoot } from "./utils/paths.js";

const VERSION = "0.1.0";
const SLASH_COMMANDS = [
  { name: "/help", usage: "/help", description: "Show available slash commands" },
  { name: "/ask", usage: "/ask <question>", description: "Ask a question about your project" },
  { name: "/providers", usage: "/providers", description: "List supported providers" },
  { name: "/configure", usage: "/configure", description: "Configure provider and model" },
  { name: "/model", usage: "/model", description: "Show current provider/model configuration" },
  { name: "/model change", usage: "/model change", description: "Change the configured model" },
  { name: "/audit", usage: "/audit", description: "Run project audit" },
  { name: "/explain", usage: "/explain", description: "Explain the project structure" },
  { name: "/remember", usage: "/remember <text>", description: "Save a project memory" },
  { name: "/recall", usage: "/recall <query>", description: "Search project memories" },
  { name: "/context", usage: "/context", description: "Show context files" },
  { name: "/clear", usage: "/clear", description: "Clear the screen" },
  { name: "/exit", usage: "/exit", description: "Exit Huno" },
] as const;

function showHelp(): void {
  renderUI(
    React.createElement(
      Box,
      { flexDirection: "column", marginTop: 1 },
      React.createElement(Text, { bold: true, color: "white" }, "  Slash Commands:"),
      ...SLASH_COMMANDS.map((command) =>
        React.createElement(
          Text,
          { key: command.usage, color: "#DFE6E9" },
          `    ${command.usage.padEnd(18)} ${command.description}`
        )
      ),
      React.createElement(
        Box,
        { marginTop: 1 },
        React.createElement(Text, { color: "#636E72" }, "  Type any question to ask about your project. Type / to see command suggestions.")
      )
    )
  );
}

function showProviders(): void {
  const providers = listProviderInfo();

  renderUI(
    React.createElement(
      Box,
      { flexDirection: "column", marginTop: 1 },
      React.createElement(Text, { bold: true, color: "white" }, "  Supported Providers"),
      ...providers.flatMap((provider) => {
        const rows = [
          React.createElement(Text, { key: `${provider.name}-name`, color: "#00CEC9" }, `  ${provider.name}`),
          React.createElement(Text, { key: `${provider.name}-model`, color: "#DFE6E9" }, `    default model: ${provider.defaultModel}`),
          React.createElement(Text, { key: `${provider.name}-env`, color: "#DFE6E9" }, `    env: ${provider.envKeys.join(" or ") || "(none)"}`),
        ];

        if (provider.aliases.length > 0) {
          rows.push(
            React.createElement(Text, { key: `${provider.name}-aliases`, color: "#DFE6E9" }, `    aliases: ${provider.aliases.join(", ")}`)
          );
        }
        if (provider.requiresAccountId) {
          rows.push(
            React.createElement(Text, { key: `${provider.name}-extra`, color: "#DFE6E9" }, "    extra: CLOUDFLARE_ACCOUNT_ID")
          );
        }

        return rows;
      }),
      React.createElement(
        Box,
        { marginTop: 1 },
        React.createElement(Text, { color: "#636E72" }, '  Example: /ask what is this project?  Use HUNO_PROVIDER or "huno ask --provider" outside the REPL.')
      )
    )
  );
}

async function showModelStatus(): Promise<void> {
  const result = await getCurrentProviderConfiguration();
  if (!result.ok) {
    renderUI(
      React.createElement(ErrorBox, {
        message: result.error.message,
        hint: result.error.hint,
      })
    );
    return;
  }

  renderUI(
    React.createElement(
      Box,
      { flexDirection: "column", marginTop: 1 },
      React.createElement(Text, { bold: true, color: "white" }, "  Current Model Configuration"),
      React.createElement(Text, { color: "#00CEC9" }, `  provider: ${result.data.provider}`),
      React.createElement(Text, { color: "#DFE6E9" }, `  model: ${result.data.model}`),
      React.createElement(
        Box,
        { marginTop: 1 },
        React.createElement(Text, { color: "#636E72" }, "  Use /model change to pick a different model for the current provider.")
      )
    )
  );
}

async function getContextFiles(): Promise<string[]> {
  const result = await readHunoFile("project-map.json");
  if (result.ok) {
    try {
      const map = parseProjectMap(result.data);
      if (map.ok) {
        return map.data.importantFiles.slice(0, 5);
      }
    } catch {}
  }
  return [];
}

async function runAudit(): Promise<void> {
  const scanResult = await scanProject();
  if (!scanResult.ok) {
    renderUI(
      React.createElement(ErrorBox, {
        message: "Scan failed. Run `huno init` first.",
        code: "SCAN_FAILED",
      })
    );
    return;
  }
  const map = scanResult.data;
  const root = map.root;
  const issues: any[] = [];

  const allRootFiles = await (await import("fs/promises")).readdir(root);
  if (allRootFiles.some((f: string) => f.startsWith(".env")) && !allRootFiles.includes(".env.example")) {
    issues.push({ severity: "medium", category: "Configuration", message: ".env exists but no .env.example", suggestion: "Create .env.example" });
  }
  if (!allRootFiles.includes("README.md")) {
    issues.push({ severity: "medium", category: "Documentation", message: "No README.md", suggestion: "Add README.md" });
  }
  if (!allRootFiles.includes(".gitignore")) {
    issues.push({ severity: "medium", category: "Repository", message: "No .gitignore", suggestion: "Create .gitignore" });
  }

  renderUI(
    React.createElement(
      Box,
      { flexDirection: "column", marginTop: 1 },
      React.createElement(Text, { bold: true, color: "white" }, "  Audit Results"),
      issues.length === 0
        ? React.createElement(Text, { color: "#00B894" }, "  ✓ No issues found!")
        : issues.map((issue: any, i: number) =>
            React.createElement(
              Box,
              { key: i, marginTop: 1 },
              React.createElement(Text, { color: issue.severity === "high" ? "#D63031" : "#E17055" }, `  ⚠ [${issue.category}] `),
              React.createElement(Text, { color: "#DFE6E9" }, issue.message)
            )
          )
    )
  );
}

async function runExplain(): Promise<void> {
  const result = await scanProject();
  if (!result.ok) {
    renderUI(React.createElement(ErrorBox, { message: "Scan failed." }));
    return;
  }
  const map = result.data;
  const stack = [
    ...map.stack.languages,
    ...map.stack.frameworks,
  ].join(", ") || "unknown";
  renderUI(
    React.createElement(
      Box,
      { flexDirection: "column", marginTop: 1 },
      React.createElement(Text, { bold: true, color: "white" }, `  Project: ${map.projectName}`),
      React.createElement(Text, { color: "#636E72" }, `  Stack: ${stack}`),
      map.importantFiles.length > 0 &&
        React.createElement(ContextFiles, { files: map.importantFiles, title: "Important Files" })
    )
  );
}

async function runRemember(text: string): Promise<void> {
  const result = await appendMemory(text);
  if (!result.ok) {
    renderUI(React.createElement(ErrorBox, { message: "Failed to save memory.", hint: result.error.hint }));
    return;
  }
  renderUI(
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { color: "#00B894" }, "  ✓ Memory saved: "),
      React.createElement(Text, { color: "#DFE6E9" }, `"${text}"`)
    )
  );
}

async function runRecall(query: string): Promise<void> {
  const result = await readMemoryFile();
  if (!result.ok) {
    renderUI(React.createElement(ErrorBox, { message: "No memory found.", hint: "Run `huno init` first." }));
    return;
  }
  const entries = parseMemoryEntries(result.data);
  const matches = searchMemory(entries, query);
  if (matches.length === 0) {
    renderUI(React.createElement(Text, { color: "#636E72" }, "  No memories found."));
    return;
  }
  renderUI(
    React.createElement(
      Box,
      { flexDirection: "column", marginTop: 1 },
      ...matches.map((entry, i) =>
        React.createElement(
          Box,
          { key: i },
          React.createElement(Text, { color: "#636E72" }, entry.date ? `[${entry.date}] ` : "  "),
          React.createElement(Text, { color: "#DFE6E9" }, entry.text)
        )
      )
    )
  );
}

async function runAsk(question: string): Promise<void> {
  const contextResult = await buildContext(question);
  if (!contextResult.ok) {
    renderUI(React.createElement(ErrorBox, {
      message: contextResult.error.message,
      code: contextResult.error.code,
      hint: contextResult.error.hint,
    }));
    return;
  }

  const context = contextResult.data;
  const contextPaths = context.files.relevantFiles.map((f) => f.path);

  renderUI(
    React.createElement(
      Box,
      { flexDirection: "column" },
      React.createElement(ContextFiles, { files: contextPaths, title: "Context" })
    )
  );

  const providerResult = await getActiveProvider();
  if (!providerResult.ok) {
    renderUI(React.createElement(ErrorBox, {
      message: providerResult.error.message,
      hint: providerResult.error.hint,
    }));
    return;
  }

  const provider = providerResult.data;
  const fullPrompt = buildFullPrompt(context);
  const result = await provider.complete(fullPrompt, context.systemPrompt);

  if (!result.ok) {
    renderUI(React.createElement(ErrorBox, {
      message: result.error.message,
      code: result.error.code,
      hint: result.error.hint,
    }));
    return;
  }

  renderUI(
    React.createElement(
      Box,
      { flexDirection: "column", marginTop: 1, borderStyle: "round", paddingX: 1 },
      React.createElement(Text, { color: "#DFE6E9" }, result.data)
    )
  );
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

export const replCommand = new Command("repl").description("Enter interactive mode").action(async () => {
  await runRepl();
});

export async function runRepl(): Promise<void> {
  const root = getProjectRoot();
  const projectName = root.split("/").pop() || "project";
  const contextFiles = await getContextFiles();

  renderUI(
    React.createElement(
      Box,
      { flexDirection: "column" },
      React.createElement(Header, { tagline: `Project: ${projectName} · v${VERSION}`, creator: "LK H'our" }),
      contextFiles.length > 0 &&
        React.createElement(ContextFiles, { files: contextFiles, title: "Context Files" }),
      React.createElement(
        Box,
        { marginTop: 1 },
        React.createElement(Text, { color: "#636E72" }, '  Type a question or /help for commands. "/exit" to quit.\n')
      )
    )
  );

  await startReplLoop(projectName, contextFiles);
}

async function startReplLoop(projectName: string, contextFiles: string[]): Promise<void> {
  const readline = await import("readline");
  const hiddenOutput = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  }) as Writable & {
    isTTY: boolean;
    columns?: number;
    rows?: number;
    getColorDepth?: () => number;
  };
  hiddenOutput.isTTY = true;
  hiddenOutput.columns = process.stdout.columns;
  hiddenOutput.rows = process.stdout.rows;
  hiddenOutput.getColorDepth = () =>
    typeof process.stdout.getColorDepth === "function" ? process.stdout.getColorDepth() : 8;
  const rl = readline.createInterface({
    input: process.stdin,
    output: hiddenOutput as typeof process.stdout,
    prompt: chalk.hex("#00CEC9")(`> `),
    terminal: true,
  });
  (rl as unknown as { _writeToOutput?: (value: string) => void })._writeToOutput = () => {};

  let isRunning = false;
  let isClosed = false;
  let blinkVisible = true;
  let shouldExitOnClose = true;
  let selectedSuggestionIndex = 0;
  const commandSuggestions = (input: string) => {
    if (!input.startsWith("/")) {
      return [];
    }
    const query = input.toLowerCase();
    return SLASH_COMMANDS.filter((command) => command.name.startsWith(query)).slice(0, 6);
  };

  const clearOverlay = (): void => {
    if (!process.stdout.isTTY || isClosed) {
      return;
    }

    const line = rl.line ?? "";
    const cursor = (rl as unknown as { cursor?: number }).cursor ?? line.length;
    process.stdout.write("\x1b7");
    const moveToEnd = Math.max(0, line.length - cursor);
    if (moveToEnd > 0) {
      readline.moveCursor(process.stdout, moveToEnd, 0);
    }
    readline.clearScreenDown(process.stdout);
    process.stdout.write("\x1b8");
  };

  const renderOverlay = (): void => {
    if (!process.stdout.isTTY || isClosed || isRunning) {
      return;
    }

    const line = rl.line ?? "";
    const cursor = Math.max(0, Math.min((rl as unknown as { cursor?: number }).cursor ?? line.length, line.length));
    const before = line.slice(0, cursor);
    const after = line.slice(cursor);
    const suggestions = commandSuggestions(line.trim());
    if (selectedSuggestionIndex >= suggestions.length) {
      selectedSuggestionIndex = 0;
    }
    const lines = [
      `${chalk.dim("  typing")} ${chalk.hex("#00CEC9")("> ")}${before}${blinkVisible ? chalk.white("|") : chalk.dim("|")}${after}`,
    ];

    if (suggestions.length > 0) {
      lines.push(chalk.dim("  commands"));
      suggestions.forEach((command, index) => {
        const isSelected = index === selectedSuggestionIndex;
        const prefix = isSelected ? chalk.green(">") : " ";
        const usage = isSelected ? chalk.bold(command.usage) : chalk.hex("#74B9FF")(command.usage);
        const description = isSelected ? command.description : chalk.dim(command.description);
        lines.push(` ${prefix} ${usage} ${description}`);
      });
    }

    process.stdout.write("\x1b7");
    const moveToEnd = Math.max(0, line.length - cursor);
    if (moveToEnd > 0) {
      readline.moveCursor(process.stdout, moveToEnd, 0);
    }
    readline.clearScreenDown(process.stdout);
    process.stdout.write(`\n${lines.join("\n")}`);
    process.stdout.write("\x1b8");
  };

  const blinkTimer = setInterval(() => {
    blinkVisible = !blinkVisible;
    renderOverlay();
  }, 500);

  const onKeypress = (): void => {
    setImmediate(renderOverlay);
  };
  const onSuggestionKeypress = (_input: string, key: { name?: string }): void => {
    if (isClosed || isRunning) {
      return;
    }

    const suggestions = commandSuggestions((rl.line ?? "").trim());
    if (suggestions.length === 0) {
      selectedSuggestionIndex = 0;
      return;
    }

    if (key.name === "up") {
      selectedSuggestionIndex =
        selectedSuggestionIndex === 0 ? suggestions.length - 1 : selectedSuggestionIndex - 1;
      renderOverlay();
      return;
    }

    if (key.name === "down") {
      selectedSuggestionIndex =
        selectedSuggestionIndex === suggestions.length - 1 ? 0 : selectedSuggestionIndex + 1;
      renderOverlay();
      return;
    }

    if (key.name === "tab") {
      const selectedSuggestion = suggestions[selectedSuggestionIndex];
      if (selectedSuggestion) {
        setInputValue(selectedSuggestion.name);
      }
      return;
    }

    if (key.name !== "left" && key.name !== "right") {
      selectedSuggestionIndex = 0;
    }
  };

  const setInputValue = (value: string): void => {
    const internalRl = rl as unknown as { line: string; cursor?: number };
    internalRl.line = value;
    internalRl.cursor = value.length;
    selectedSuggestionIndex = 0;
    renderOverlay();
  };

  readline.emitKeypressEvents(process.stdin);
  process.stdin.on("keypress", onKeypress);
  process.stdin.on("keypress", onSuggestionKeypress);

  const runInteractiveAction = async (
    action: () => Promise<void>
  ): Promise<void> => {
    isRunning = true;
    clearOverlay();
    rl.pause();
    try {
      await action();
    } finally {
      rl.resume();
      isRunning = false;
      rl.prompt();
      renderOverlay();
    }
  };

  const runSubcommand = async (args: string[]): Promise<void> => {
    isRunning = true;
    clearOverlay();
    rl.pause();
    process.stdin.off("keypress", onKeypress);
    process.stdin.off("keypress", onSuggestionKeypress);

    const entrypoint = process.argv[1];
    const command =
      entrypoint.endsWith(".ts")
        ? {
            bin: "npx",
            args: ["tsx", entrypoint, ...args],
          }
        : {
            bin: process.execPath,
            args: [entrypoint, ...args],
          };

    const exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn(command.bin, command.args, {
        cwd: process.cwd(),
        stdio: "inherit",
      });
      child.on("error", reject);
      child.on("close", (code) => resolve(code ?? 1));
    });

    if (exitCode !== 0) {
      renderUI(
        React.createElement(ErrorBox, {
          message: `Command failed: huno ${args.join(" ")}`,
          hint: `The subprocess exited with code ${exitCode}.`,
        })
      );
      process.exit(exitCode);
    }

    process.stdin.on("keypress", onKeypress);
    process.stdin.on("keypress", onSuggestionKeypress);
    rl.resume();
    isRunning = false;
    isClosed = false;
    selectedSuggestionIndex = 0;
    const internalRl = rl as unknown as { line: string; cursor?: number };
    internalRl.line = "";
    internalRl.cursor = 0;
    if (process.stdout.isTTY) {
      process.stdout.write("\n");
      process.stdout.write("\x1b[?25l");
    }
    rl.prompt();
    renderOverlay();
  };

  rl.on("line", async (line: string) => {
    const input = line.trim();
    const suggestions = commandSuggestions(input);
    const selectedSuggestion = suggestions[selectedSuggestionIndex];

    if (isRunning) return;

    if (
      input.startsWith("/") &&
      suggestions.length > 0 &&
      selectedSuggestion &&
      !SLASH_COMMANDS.some((command) => command.name === input || command.usage === input)
    ) {
      rl.prompt();
      setInputValue(selectedSuggestion.name);
      return;
    }

    if (!input) {
      rl.prompt();
      renderOverlay();
      return;
    }

    if (input === "/exit" || input === "/quit") {
      renderUI(
        React.createElement(Text, { color: "#636E72" }, "\n  Goodbye! 👋\n")
      );
      rl.close();
      process.exit(0);
      return;
    }

    if (input === "/clear") {
      clearOverlay();
      console.clear();
      rl.prompt();
      renderOverlay();
      return;
    }

    if (input === "/help") {
      clearOverlay();
      showHelp();
      rl.prompt();
      renderOverlay();
      return;
    }

    if (input === "/providers" || input === "providers") {
      clearOverlay();
      showProviders();
      rl.prompt();
      renderOverlay();
      return;
    }

    if (input === "/configure") {
      await runSubcommand(["providers", "configure"]);
      return;
    }

    if (input === "/model") {
      clearOverlay();
      await showModelStatus();
      rl.prompt();
      renderOverlay();
      return;
    }

    if (input === "/model change" || input === "/model set") {
      await runSubcommand(["model", "change"]);
      return;
    }

    if (input === "/context") {
      clearOverlay();
      renderUI(
        React.createElement(ContextFiles, { files: contextFiles, title: "Project Context" })
      );
      rl.prompt();
      renderOverlay();
      return;
    }

    if (input === "/audit") {
      await runInteractiveAction(async () => {
        await runAudit();
      });
      return;
    }

    if (input === "/explain") {
      await runInteractiveAction(async () => {
        await runExplain();
      });
      return;
    }

    if (input.startsWith("/remember ")) {
      const text = input.slice(10).trim();
      if (!text) {
        clearOverlay();
        renderUI(React.createElement(Text, { color: "#E17055" }, "  Usage: /remember <text>"));
        rl.prompt();
        renderOverlay();
        return;
      }
      await runInteractiveAction(async () => {
        await runRemember(text);
      });
      return;
    }

    if (input.startsWith("/recall ")) {
      const query = input.slice(8).trim();
      if (!query) {
        clearOverlay();
        renderUI(React.createElement(Text, { color: "#E17055" }, "  Usage: /recall <query>"));
        rl.prompt();
        renderOverlay();
        return;
      }
      await runInteractiveAction(async () => {
        await runRecall(query);
      });
      return;
    }

    if (input.startsWith("/ask ")) {
      const question = input.slice(5).trim();
      if (!question) {
        clearOverlay();
        renderUI(React.createElement(Text, { color: "#E17055" }, "  Usage: /ask <question>"));
        rl.prompt();
        renderOverlay();
        return;
      }
      await runInteractiveAction(async () => {
        await runAsk(question);
      });
      return;
    }

    // Default: treat as ask question
    await runInteractiveAction(async () => {
      await runAsk(input);
    });
  });

  const onSigint = (): void => {
    isClosed = true;
    clearInterval(blinkTimer);
    process.stdin.off("keypress", onKeypress);
    process.stdin.off("keypress", onSuggestionKeypress);
    process.off("SIGINT", onSigint);
    renderUI(React.createElement(Text, { color: "#636E72" }, "\n  Goodbye! 👋\n"));
    rl.close();
    process.exit(0);
  };

  rl.on("close", () => {
    isClosed = true;
    clearInterval(blinkTimer);
    process.stdin.off("keypress", onKeypress);
    process.stdin.off("keypress", onSuggestionKeypress);
    process.off("SIGINT", onSigint);
    if (!shouldExitOnClose) {
      return;
    }
    renderUI(React.createElement(Text, { color: "#636E72" }, "\n  Goodbye!\n"));
    process.exit(0);
  });

  // Handle Ctrl+C
  process.on("SIGINT", onSigint);

  rl.prompt();
  renderOverlay();
}
