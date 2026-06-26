import { Command } from "commander";
import React from "react";
import { Box, Text } from "ink";
import { buildContext } from "../core/context.js";
import { getActiveProvider } from "../providers/index.js";
import { createStreamingProvider } from "../providers/chat.js";
import { renderUI } from "../ui/renderer.js";
import { Header, ProgressSteps, ContextFiles, ErrorBox } from "../ui/components/index.js";
import { runConversation } from "../core/conversation.js";
import { allTools } from "../tools/index.js";
import { loadConfig, defaultConfig } from "../core/config.js";

const STEPS = [
  { label: "Building context" },
  { label: "Selecting provider" },
  { label: "Thinking" },
  { label: "Answering" },
];

export const askCommand = new Command("ask")
  .description("Ask a question about your project.")
  .argument("<question>", "The question to ask")
  .option("-p, --provider <provider>", "Provider to use for this request")
  .option("-m, --model <model>", "Model to use for this request")
  .action(async (question: string, options: { provider?: string; model?: string }) => {
    // Step 1: Building context
    renderUI(
      React.createElement(
        Box,
        { flexDirection: "column" },
        React.createElement(Header, { tagline: "Project Q&A" }),
        React.createElement(ProgressSteps, { steps: STEPS, current: 0 })
      )
    );

    const contextResult = await buildContext(question);
    if (!contextResult.ok) {
      renderUI(
        React.createElement(
          Box,
          { flexDirection: "column" },
          React.createElement(Header, { tagline: "Project Q&A" }),
          React.createElement(ProgressSteps, { steps: STEPS, current: 0 }),
          React.createElement(ErrorBox, {
            message: contextResult.error.message,
            code: contextResult.error.code,
            hint: contextResult.error.hint,
          })
        )
      );
      setTimeout(() => process.exit(1), 100);
      return;
    }

    const context = contextResult.data;
    const contextPaths: string[] = context.files.relevantFiles.map((f) => f.path);

    // Step 2: Selecting provider
    renderUI(
      React.createElement(
        Box,
        { flexDirection: "column" },
        React.createElement(Header, { tagline: "Project Q&A" }),
        React.createElement(ProgressSteps, { steps: STEPS, current: 1 }),
        React.createElement(ContextFiles, { files: contextPaths })
      )
    );

    const providerResult = await getActiveProvider({
      provider: options.provider,
      model: options.model,
    });
    if (!providerResult.ok) {
      renderUI(
        React.createElement(
          Box,
          { flexDirection: "column" },
          React.createElement(Header, { tagline: "Project Q&A" }),
          React.createElement(ProgressSteps, { steps: STEPS, current: 1 }),
          React.createElement(ContextFiles, { files: contextPaths }),
          React.createElement(ErrorBox, {
            message: providerResult.error.message,
            code: providerResult.error.code,
            hint: providerResult.error.hint,
          })
        )
      );
      setTimeout(() => process.exit(1), 100);
      return;
    }

    const baseProvider = providerResult.data;

    // Show provider info
    renderUI(
      React.createElement(
        Box,
        { flexDirection: "column" },
        React.createElement(Header, { tagline: "Project Q&A" }),
        React.createElement(ProgressSteps, { steps: STEPS, current: 2 }),
        React.createElement(ContextFiles, { files: contextPaths }),
        React.createElement(
          Box,
          { marginTop: 1 },
          React.createElement(Text, { dimColor: true }, `Provider: ${baseProvider.name} (${baseProvider.model})`)
        )
      )
    );

    // Create streaming provider with tools
    const configResult = await loadConfig();
    const config = configResult.ok ? configResult.data : defaultConfig();
    const streamingProvider = createStreamingProvider(baseProvider as any, config);
    const fullPrompt = buildFullPrompt(context);
    const tools = allTools();

    // Run conversation (streams output, executes tools)
    await runConversation(fullPrompt, [], {
      provider: streamingProvider,
      tools,
      maxTurns: 20,
    });

    setTimeout(() => process.exit(0), 100);
  });

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
