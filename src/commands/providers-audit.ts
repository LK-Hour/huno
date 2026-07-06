import { Command } from "commander";
import chalk from "chalk";
import {
  listProviderInfo,
  findProviderDefinition,
  fetchProviderModels,
  type ProviderInfo,
} from "../providers/index.js";
import { loadConfig, type Config } from "../core/config.js";

type AuditResult = {
  provider: string;
  configured: boolean;
  connectable: boolean | null;
  modelCount: number | null;
  latencyMs: number | null;
  error: string | null;
};

async function auditProvider(
  provider: ProviderInfo,
  config: Config
): Promise<AuditResult> {
  const def = findProviderDefinition(provider.name);
  if (!def || provider.name === "ollama") {
    return {
      provider: provider.name,
      configured: true,
      connectable: null,
      modelCount: null,
      latencyMs: null,
      error: null,
    };
  }

  const apiKey = resolveApiKey(config, provider);
  if (!apiKey) {
    return {
      provider: provider.name,
      configured: false,
      connectable: null,
      modelCount: null,
      latencyMs: null,
      error: null,
    };
  }

  const start = Date.now();
  try {
    const result = await fetchProviderModels({
      provider: provider.name,
      apiKey,
      cloudflareAccountId: config.cloudflareAccountId,
    });
    const latencyMs = Date.now() - start;

    if (result.ok) {
      return {
        provider: provider.name,
        configured: true,
        connectable: true,
        modelCount: result.data.length,
        latencyMs,
        error: null,
      };
    } else {
      return {
        provider: provider.name,
        configured: true,
        connectable: false,
        modelCount: null,
        latencyMs,
        error: result.error.message,
      };
    }
  } catch (err) {
    return {
      provider: provider.name,
      configured: true,
      connectable: false,
      modelCount: null,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function resolveApiKey(config: Config, provider: ProviderInfo): string | null {
  const def = findProviderDefinition(provider.name);
  if (!def) return null;
  const configured = config.apiKeys?.[def.configKey as keyof typeof config.apiKeys];
  if (configured) return configured;
  for (const envKey of provider.envKeys) {
    const value = process.env[envKey];
    if (value) return value;
  }
  return null;
}

export async function runProviderAudit(options: { concurrent?: number } = {}): Promise<void> {
  const concurrency = options.concurrent || 5;
  const providers = listProviderInfo();
  const configResult = await loadConfig();
  const config = configResult.ok ? (configResult.data as Config) : ({} as Config);

  console.log();
  console.log(chalk.bold.white("  Provider Audit"));
  console.log(chalk.dim(`  Checking ${providers.length} providers...\n`));

  const results: AuditResult[] = [];
  const queue = [...providers];

  async function worker() {
    while (queue.length > 0) {
      const provider = queue.shift()!;
      const result = await auditProvider(provider, config);
      results.push(result);
      printResult(result);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, providers.length) },
    () => worker()
  );
  await Promise.all(workers);

  const connectable = results.filter((r) => r.connectable === true);
  const failed = results.filter((r) => r.configured && r.connectable === false);
  const notConfigured = results.filter((r) => !r.configured);

  console.log();
  console.log(chalk.dim("  ─────────────────────────────────────────────"));
  console.log();
  console.log(
    `  ${chalk.green(`${connectable.length} working`)} · ${chalk.yellow(`${notConfigured.length} not configured`)} · ${chalk.red(`${failed.length} failed`)}`
  );
  console.log();

  if (failed.length > 0) {
    console.log(chalk.red("  Failed providers:"));
    failed.forEach((r) => {
      console.log(chalk.red(`    ✗ ${r.provider}`) + chalk.dim(` — ${r.error}`));
      console.log();
    });
  }
}

function printResult(result: AuditResult): void {
  if (!result.configured) {
    console.log(chalk.dim(`  ○ ${result.provider.padEnd(14)} not configured`));
    return;
  }
  if (result.connectable) {
    const latency =
      result.latencyMs !== null ? chalk.dim(` ${result.latencyMs}ms`) : "";
    const models =
      result.modelCount !== null
        ? chalk.dim(` \u00b7 ${result.modelCount} models`)
        : "";
    console.log(
      chalk.green(`  \u2713 ${result.provider.padEnd(14)}`) + latency + models
    );
    return;
  }
  console.log(
    chalk.red(`  ✗ ${result.provider.padEnd(14)}`) +
      chalk.dim(` ${result.error?.slice(0, 50) ?? "failed"}`)
  );
}

export const providersAuditCommand = new Command("audit")
  .description("Verify all providers: check API keys and connectivity")
  .option("-c, --concurrent <n>", "Number of concurrent checks", "5")
  .action(async (options: { concurrent?: string }) => {
    await runProviderAudit({
      concurrent: parseInt(options.concurrent || "5", 10),
    });
  });
