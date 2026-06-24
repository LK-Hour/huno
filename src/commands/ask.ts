import { Command } from "commander";
import chalk from "chalk";
import { buildContext } from "../core/context.js";
import { getActiveProvider } from "../providers/index.js";
import type { ContextBuildResult } from "../types/context.js";
import type { Provider } from "../providers/base.js";

export const askCommand = new Command("ask")
  .description("Ask a question about your project.")
  .argument("<question>", "The question to ask")
  .action(async (question: string) => {
    console.log(chalk.blue("Building context..."));

    // Build context
    const contextResult = await buildContext(question);
    if (!contextResult.ok) {
      console.error(chalk.red(`Error: ${contextResult.error.message}`));
      if (contextResult.error.hint) {
        console.error(chalk.yellow(contextResult.error.hint));
      }
      process.exit(1);
    }

    const context: ContextBuildResult = contextResult.data;

    // Show context files if any
    if (context.files.relevantFiles.length > 0) {
      console.log(
        chalk.dim(
          `Using ${context.files.relevantFiles.length} file(s) as context`
        )
      );
      for (const f of context.files.relevantFiles) {
        console.log(chalk.dim(`  - ${f.path}`));
      }
    }
    if (context.files.memory) {
      console.log(chalk.dim("Using project memory as context"));
    }

    // Get provider
    console.log(chalk.blue("Thinking..."));
    const providerResult = await getActiveProvider();
    if (!providerResult.ok) {
      console.error(chalk.red(`Error: ${providerResult.error.message}`));
      if (providerResult.error.hint) {
        console.error(chalk.yellow(providerResult.error.hint));
      }
      process.exit(1);
    }

    const provider: Provider = providerResult.data;
    console.log(chalk.dim(`Provider: ${provider.name} (${provider.model})`));

    // Build full prompt with context
    const fullPrompt = buildFullPrompt(context);

    // Call provider
    const result = await provider.complete(fullPrompt, context.systemPrompt);

    if (!result.ok) {
      console.error(chalk.red(`Error: ${result.error.message}`));
      if (result.error.hint) {
        console.error(chalk.yellow(result.error.hint));
      }
      process.exit(1);
    }

    console.log("\n" + result.data);
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
