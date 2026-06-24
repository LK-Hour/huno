import { Command } from "commander";
import React from "react";
import { Box, Text } from "ink";
import chalk from "chalk";
import { renderUI } from "./ui/renderer.js";
import { Header, ReplPrompt, ContextFiles, ErrorBox } from "./ui/components/index.js";
import { buildContext } from "./core/context.js";
import { getActiveProvider } from "./providers/index.js";
import { scanProject } from "./core/scanner.js";
import { readHunoFile } from "./storage/huno-dir.js";
import { parseProjectMap } from "./storage/project-map.js";
import { appendMemory, readMemoryFile, parseMemoryEntries, searchMemory } from "./storage/memory-file.js";
import { getProjectRoot } from "./utils/paths.js";
import { HunoError } from "./utils/errors.js";

const VERSION = "0.1.0";

function showHelp(): void {
  renderUI(
    React.createElement(
      Box,
      { flexDirection: "column", marginTop: 1 },
      React.createElement(Text, { bold: true, color: "white" }, "  Slash Commands:"),
      React.createElement(Text, { color: "#DFE6E9" }, "    /help        Show this help message"),
      React.createElement(Text, { color: "#DFE6E9" }, "    /ask <q>     Ask a question about your project"),
      React.createElement(Text, { color: "#DFE6E9" }, "    /audit       Run project audit"),
      React.createElement(Text, { color: "#DFE6E9" }, "    /explain     Explain the project structure"),
      React.createElement(Text, { color: "#DFE6E9" }, "    /remember    Save a project memory"),
      React.createElement(Text, { color: "#DFE6E9" }, "    /recall      Search project memories"),
      React.createElement(Text, { color: "#DFE6E9" }, "    /context     Show project context files"),
      React.createElement(Text, { color: "#DFE6E9" }, "    /clear       Clear the screen"),
      React.createElement(Text, { color: "#DFE6E9" }, "    /exit        Exit Huno"),
      React.createElement(Text, { color: "#636E72", marginTop: 1 }, "  Type any question to ask about your project.")
    )
  );
}

function getContextFiles(): string[] {
  const root = getProjectRoot();
  const result = readHunoFile("project-map.json");
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
  const contextFiles = getContextFiles();

  renderUI(
    React.createElement(
      Box,
      { flexDirection: "column" },
      React.createElement(Header, { tagline: `Project: ${projectName} · v${VERSION}` }),
      contextFiles.length > 0 &&
        React.createElement(ContextFiles, { files: contextFiles, title: "Context Files" }),
      React.createElement(Text, { color: "#636E72", marginTop: 1 }, '  Type a question or /help for commands. "/exit" to quit.\n')
    )
  );

  await startReplLoop(projectName, contextFiles);
}

async function startReplLoop(projectName: string, contextFiles: string[]): Promise<void> {
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.hex("#00CEC9")(`> `),
    terminal: true,
  });

  let isRunning = false;

  rl.on("line", async (line: string) => {
    const input = line.trim();

    if (isRunning) return;

    if (!input) {
      rl.prompt();
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
      console.clear();
      rl.prompt();
      return;
    }

    if (input === "/help") {
      showHelp();
      rl.prompt();
      return;
    }

    if (input === "/context") {
      renderUI(
        React.createElement(ContextFiles, { files: contextFiles, title: "Project Context" })
      );
      rl.prompt();
      return;
    }

    if (input === "/audit") {
      isRunning = true;
      rl.prompt();
      await runAudit();
      isRunning = false;
      rl.prompt();
      return;
    }

    if (input === "/explain") {
      isRunning = true;
      rl.prompt();
      await runExplain();
      isRunning = false;
      rl.prompt();
      return;
    }

    if (input.startsWith("/remember ")) {
      const text = input.slice(10).trim();
      if (!text) {
        renderUI(React.createElement(Text, { color: "#E17055" }, "  Usage: /remember <text>"));
        rl.prompt();
        return;
      }
      isRunning = true;
      rl.prompt();
      await runRemember(text);
      isRunning = false;
      rl.prompt();
      return;
    }

    if (input.startsWith("/recall ")) {
      const query = input.slice(8).trim();
      if (!query) {
        renderUI(React.createElement(Text, { color: "#E17055" }, "  Usage: /recall <query>"));
        rl.prompt();
        return;
      }
      isRunning = true;
      rl.prompt();
      await runRecall(query);
      isRunning = false;
      rl.prompt();
      return;
    }

    // Default: treat as ask question
    isRunning = true;
    rl.prompt();
    await runAsk(input);
    isRunning = false;
    rl.prompt();
  });

  rl.on("close", () => {
    renderUI(React.createElement(Text, { color: "#636E72" }, "\n  Goodbye!\n"));
    process.exit(0);
  });

  // Handle Ctrl+C
  process.on("SIGINT", () => {
    renderUI(React.createElement(Text, { color: "#636E72" }, "\n  Goodbye! 👋\n"));
    rl.close();
    process.exit(0);
  });

  rl.prompt();
}
