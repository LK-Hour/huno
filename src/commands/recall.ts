import { Command } from "commander";
import chalk from "chalk";
import { readMemoryFile, parseMemoryEntries, searchMemory } from "../storage/memory-file.js";

export const recallCommand = new Command("recall")
  .description("Search project memory.")
  .argument("<query>", "Search query")
  .action(async (query: string) => {
    const result = await readMemoryFile();
    if (!result.ok) {
      console.error(chalk.red(result.error.toString()));
      process.exit(1);
    }

    const entries = parseMemoryEntries(result.data);
    const matches = searchMemory(entries, query);

    if (matches.length === 0) {
      console.log(chalk.gray(`No memories found for "${query}".`));
      return;
    }

    console.log(chalk.green(`Found ${matches.length} memory/memories for "${query}":`));
    console.log();
    for (const entry of matches) {
      if (entry.date) {
        console.log(chalk.gray(`[${entry.date}]`) + ` ${entry.text}`);
      } else {
        console.log(`  ${entry.text}`);
      }
    }
  });