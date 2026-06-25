import { Command } from "commander";
import chalk from "chalk";
import {
  configureModelInteractive,
  getCurrentProviderConfiguration,
} from "./providers.js";

export const modelCommand = new Command("model")
  .description("Show or change the configured model.")
  .action(async () => {
    const result = await getCurrentProviderConfiguration();
    if (!result.ok) {
      console.error(chalk.red(result.error.message));
      if (result.error.hint) {
        console.error(chalk.yellow(result.error.hint));
      }
      process.exit(1);
    }

    console.log(chalk.cyan("Current model configuration"));
    console.log(`Provider: ${result.data.provider}`);
    console.log(`Model: ${result.data.model}`);
    console.log();
    console.log(chalk.dim("Use `huno model change` to pick a different model."));
  });

modelCommand
  .command("change")
  .description("Interactively change the configured model.")
  .action(async () => {
    const result = await configureModelInteractive();
    if (!result.ok) {
      console.error(chalk.red(result.error.message));
      if (result.error.hint) {
        console.error(chalk.yellow(result.error.hint));
      }
      process.exit(1);
    }

    console.log();
    console.log(chalk.green(`Updated model for provider: ${result.data.provider}`));
    console.log(`Model: ${result.data.model}`);
    console.log(`Saved settings to ${chalk.cyan(".env")} and ${chalk.cyan(".huno/config.json")}.`);
  });
