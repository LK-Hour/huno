import { Command } from "commander";
import chalk from "chalk";
import { appendMemory } from "../storage/memory-file.js";

export const rememberCommand = new Command("remember")
  .description("Store a project memory.")
  .argument("<text>", "The memory to store")
  .action(async (text: string) => {
    const result = await appendMemory(text);
    if (!result.ok) {
      console.error(chalk.red(result.error.toString()));
      process.exit(1);
    }

    console.log(chalk.green("Memory stored."));
    console.log(`  ${text}`);
  });