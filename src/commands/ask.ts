import { Command } from "commander";
import chalk from "chalk";
import { buildContext } from "../core/context.js";
import { getActiveProvider } from "../providers/index.js";
import { createStreamingProvider, type ChatMessage } from "../providers/chat.js";
import { runConversation, type Snapshot } from "../core/conversation.js";
import { allTools } from "../tools/index.js";
import { loadConfig, defaultConfig } from "../core/config.js";
import { startSpinner, writeStatus } from "../ui/spinner.js";
import { renderLogo } from "../ui/logo.js";

export const askCommand = new Command("ask")
  .description("Ask a question about your project.")
  .argument("<question>", "The question to ask")
  .option("-p, --provider <provider>", "Provider to use for this request")
  .option("-m, --model <model>", "Model to use for this request")
  .action(async (question: string, options: { provider?: string; model?: string }) => {
    // Header
    console.log();
    renderLogo().forEach((line) => console.log("  " + line));
    console.log();
    console.log(chalk.hex("#6C5CE7")("  ◈") + " Project Q&A");
    console.log();

    // Step 1: Building context
    const spinCtx = startSpinner("Building context", "\x1b[36m");
    const contextResult = await buildContext(question);
    spinCtx.stop();

    if (!contextResult.ok) {
      console.log(chalk.red("  ✗ " + contextResult.error.message));
      if (contextResult.error.hint) console.log(chalk.dim("  " + contextResult.error.hint));
      process.exit(1);
      return;
    }
    writeStatus("✓", "Context built", "\x1b[32m");

    const context = contextResult.data;
    const contextPaths: string[] = context.files.relevantFiles.map((f) => f.path);

    // Show context files used
    if (contextPaths.length > 0) {
      console.log(chalk.dim("  Context Files"));
      contextPaths.forEach((f) => console.log(chalk.dim("    ├─ " + f)));
      console.log();
    }

    // Step 2: Selecting provider
    const spinProv = startSpinner("Selecting provider", "\x1b[36m");
    const providerResult = await getActiveProvider({
      provider: options.provider,
      model: options.model,
    });
    spinProv.stop();

    if (!providerResult.ok) {
      console.log(chalk.red("  ✗ " + providerResult.error.message));
      if (providerResult.error.hint) console.log(chalk.dim("  " + providerResult.error.hint));
      process.exit(1);
      return;
    }

    const baseProvider = providerResult.data;
    writeStatus("✓", baseProvider.name + " / " + baseProvider.model, "\x1b[32m");
    console.log();

    // Create streaming provider with tools
    const configResult = await loadConfig();
    const config = configResult.ok ? configResult.data : defaultConfig();
    const streamingProvider = createStreamingProvider(baseProvider, config);
    const fullPrompt = buildFullPrompt(context);
    const tools = allTools();

    // Tool call labels
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

    const hunoIcon = "\x1b[38;2;108;92;231m◈\x1b[0m"; // purple ◈

    // Step 3: Thinking + streaming
    const spinThink = startSpinner("Thinking", "\x1b[35m");
    let thinking = true;

    const onStream = (text: string) => {
      if (thinking) {
        spinThink.stop();
        process.stdout.write("  " + hunoIcon + "\n\n");
        thinking = false;
      }
      process.stdout.write(text);
    };

    const onToolCall = (toolName: string, argsStr: string) => {
      if (thinking) {
        spinThink.stop();
        thinking = false;
      }
      const label = TOOL_LABELS[toolName] || toolName;
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

    // Approval callback with risk levels
    const onApprove = async (toolName: string, args: Record<string, unknown>): Promise<boolean> => {
      let risk = "low";
      let description = "";

      if (toolName === "write_file") {
        description = "Write to " + (args.path as string);
        risk = "medium";
      } else if (toolName === "patch_file") {
        description = "Patch " + (args.path as string);
        risk = "medium";
      } else if (toolName === "run_command") {
        description = "Run: " + (args.command as string);
        const cmd = (args.command as string).toLowerCase();
        if (cmd.includes("rm ") || cmd.includes("delete") || cmd.includes("drop") || cmd.includes("docker compose down")) {
          risk = "high";
        } else if (cmd.includes("install") || cmd.includes("push") || cmd.includes("deploy")) {
          risk = "medium";
        }
      }

      console.log();
      if (risk === "high") {
        console.log(chalk.red(`  ⚠ HIGH RISK: ${description}`));
        console.log(chalk.dim("  This may cause irreversible changes."));
      } else if (risk === "medium") {
        console.log(chalk.yellow(`  ⚠ ${description}? [risk: ${risk}]`));
      } else {
        console.log(chalk.cyan(`  → ${description} [risk: ${risk}]`));
      }

      return await promptApproval(risk === "high" ? "  Allow? [y/N]" : "  Allow? [Y/n]");
    };

    // Run conversation (streams output, executes tools)
    const result = await runConversation(fullPrompt, [], {
      provider: streamingProvider,
      tools,
      maxTurns: 20,
      onStream,
      onToolCall,
      onApprove,
    });

    // Safety: stop spinner if it never got a token
    if (thinking) {
      spinThink.stop();
    }

    // Separator + context info
    console.log();
    console.log(chalk.dim("  ─────────────────────────────────────────────────────"));
    if (contextPaths.length > 0) {
      console.log(chalk.dim("  Used: " + contextPaths.join(", ")));
    }
    console.log(chalk.dim("  Provider: " + baseProvider.name + " (" + baseProvider.model + ")"));
    console.log();
  });

function promptApproval(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const { createInterface } = require("readline");
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(message + " ", (answer: string) => {
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
