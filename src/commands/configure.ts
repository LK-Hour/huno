import { Command } from "commander";
import chalk from "chalk";
import { configureProviderInteractive } from "./providers.js";

export const configureCommand = new Command("configure")
  .description("Interactively configure a provider, API key, and model.")
  .action(async () => {
    const result = await configureProviderInteractive();
    if (!result.ok) {
      console.error(chalk.red("  ✗ " + result.error.message));
      if (result.error.hint) console.error(chalk.dim("  " + result.error.hint));
      process.exit(1);
    }
  });
