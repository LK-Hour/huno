import { Command } from "commander";
import chalk from "chalk";
import { configureProviderInteractive, configureProviderNonInteractive } from "./providers.js";

export const configureCommand = new Command("configure")
  .description("Configure a provider, API key, and model (interactive wizard, or non-interactive with --provider).")
  .option("--provider <name>", "Provider name — skips the interactive wizard")
  .option("--model <name>", "Model to use (defaults to the provider's default model)")
  .option("--api-key <key>", "API key (falls back to the provider's env var if omitted)")
  .option("--account-id <id>", "Cloudflare account ID (only needed for the cloudflare provider)")
  .action(async (opts: { provider?: string; model?: string; apiKey?: string; accountId?: string }) => {
    const result = opts.provider
      ? await configureProviderNonInteractive({
          provider: opts.provider,
          model: opts.model,
          apiKey: opts.apiKey,
          accountId: opts.accountId,
        })
      : await configureProviderInteractive();

    if (!result.ok) {
      console.error(chalk.red("  ✗ " + result.error.message));
      if (result.error.hint) console.error(chalk.dim("  " + result.error.hint));
      process.exit(1);
    }

    if (opts.provider) {
      console.log();
      console.log(chalk.green(`  ✓ Configured: ${result.data.provider} (${result.data.model})`));
      console.log();
    }
  });
