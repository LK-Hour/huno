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
import { requestApproval } from "../core/approval.js";
import { describeToolCall, buildFullPrompt } from "../core/chat-ui.js";

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
      process.stdout.write(chalk.dim(describeToolCall(toolName, argsStr) + "\n"));
    };

    // Run conversation (streams output, executes tools)
    const result = await runConversation(fullPrompt, [], {
      provider: streamingProvider,
      tools,
      maxTurns: 20,
      onStream,
      onToolCall,
      onApprove: requestApproval,
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
