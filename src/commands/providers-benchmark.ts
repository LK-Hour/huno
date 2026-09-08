import { Command } from "commander";
import chalk from "chalk";
import {
  listProviderInfo,
  findProviderDefinition,
  fetchProviderModels,
  type ProviderInfo,
  type ProviderModelInfo,
} from "../providers/index.js";
import { loadConfig, type Config } from "../core/config.js";
import { brand, progress, semantic } from "../ui/theme.js";

const BENCHMARK_PROMPT = "What is 2+2? Answer with just the number.";
const SLOW_THRESHOLD_MS = 30_000;

export type ModelResult = {
  provider: string;
  modelId: string;
  totalMs: number;
  timeToFirstTokenMs: number;
  tokens: number;
  response: string;
  error: string | null;
  slow: boolean;
};

type ProviderConfig = {
  apiKey: string;
  baseURL: string;
  headers?: Record<string, string>;
};

type BenchmarkTask = {
  provider: ProviderInfo;
  model: ProviderModelInfo;
  providerConf: ProviderConfig;
};

async function benchmarkModel(
  provider: ProviderInfo,
  modelId: string,
  providerConf: ProviderConfig
): Promise<ModelResult> {
  const start = Date.now();
  let timeToFirstTokenMs = 0;
  let firstTokenReceived = false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SLOW_THRESHOLD_MS);

  try {
    const response = await fetch(`${providerConf.baseURL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        ...providerConf.headers,
        Authorization: `Bearer ${providerConf.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: BENCHMARK_PROMPT }],
        stream: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        provider: provider.name,
        modelId,
        totalMs: Date.now() - start,
        timeToFirstTokenMs: 0,
        tokens: 0,
        response: "",
        error: `HTTP ${response.status}: ${body.slice(0, 100)}`,
        slow: false,
      };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return {
        provider: provider.name,
        modelId,
        totalMs: Date.now() - start,
        timeToFirstTokenMs: 0,
        tokens: 0,
        response: "",
        error: "No response body",
        slow: false,
      };
    }

    let fullContent = "";
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const chunk = await reader.read();
      done = chunk.done;
      if (chunk.value) {
        const text = decoder.decode(chunk.value, { stream: true });
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              if (!firstTokenReceived) {
                timeToFirstTokenMs = Date.now() - start;
                firstTokenReceived = true;
              }
              fullContent += delta;
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    }

    const totalMs = Date.now() - start;
    const tokens = Math.ceil(fullContent.length / 4);

    return {
      provider: provider.name,
      modelId,
      totalMs,
      timeToFirstTokenMs,
      tokens,
      response: fullContent.trim(),
      error: null,
      slow: false,
    };
  } catch (err) {
    const isSlow = err instanceof Error && err.name === "AbortError";
    return {
      provider: provider.name,
      modelId,
      totalMs: isSlow ? SLOW_THRESHOLD_MS : Date.now() - start,
      timeToFirstTokenMs,
      tokens: 0,
      response: "",
      error: isSlow ? "slow" : err instanceof Error ? err.message : String(err),
      slow: isSlow,
    };
  } finally {
    clearTimeout(timeout);
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

function getBaseURL(config: Config, provider: ProviderInfo): string | null {
  const def = findProviderDefinition(provider.name);
  if (!def) return null;
  if (typeof def.baseURL === "string") return def.baseURL;
  if (provider.name === "cloudflare") {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || config.cloudflareAccountId;
    if (!accountId) return null;
    return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`;
  }
  return null;
}

export async function runProviderBenchmark(options: {
  modelsPerProvider?: number;
  providers?: string[];
} = {}): Promise<ModelResult[]> {
  const maxModels = options.modelsPerProvider;
  const filterProviders = options.providers || null;

  const configResult = await loadConfig();
  const config = configResult.ok ? (configResult.data as Config) : ({} as Config);
  const allProviders = listProviderInfo().filter((p) => p.name !== "ollama");

  let providers = allProviders.filter((p) => {
    const hasKey = resolveApiKey(config, p) !== null;
    const hasBaseURL = getBaseURL(config, p) !== null;
    return hasKey && hasBaseURL;
  });

  if (filterProviders) {
    providers = providers.filter(
      (p) =>
        filterProviders.includes(p.name) ||
        p.aliases.some((a) => filterProviders!.includes(a))
    );
  }

  if (providers.length === 0) {
    console.log(chalk.yellow("\n  No configured providers found. Run /configure or `huno providers configure` first.\n"));
    return [];
  }

  console.log();
  console.log(chalk.bold.white("  Provider Benchmark"));
  console.log(chalk.dim(`  Prompt: "${BENCHMARK_PROMPT}"`));
  console.log(
    chalk.dim(
      `  ${providers.length} providers · ${
        maxModels ? `up to ${maxModels} free models each` : "all free models"
      } · parallel\n`
    )
  );

  const taskGroups = await Promise.all(providers.map(async (provider) => {
    const apiKey = resolveApiKey(config, provider)!;
    const baseURL = getBaseURL(config, provider)!;
    const def = findProviderDefinition(provider.name)!;

    const modelResult = await fetchProviderModels({
      provider: provider.name,
      apiKey,
      cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID || config.cloudflareAccountId,
    });

    if (!modelResult.ok || modelResult.data.length === 0) {
      console.log(chalk.dim(`  ${provider.name}: no models available — skipping`));
      return [];
    }

    let models = modelResult.data.filter((m) => m.likelyFree);
    if (maxModels) {
      models = models.slice(0, maxModels);
    }

    if (models.length === 0) {
      console.log(chalk.dim(`  ${provider.name}: no free models found — skipping`));
      return [];
    }

    console.log(chalk.hex(brand.secondary)(`  ${provider.name}: ${models.length} free models queued`));
    return models.map((model): BenchmarkTask => ({
      provider,
      model,
      providerConf: {
        apiKey,
        baseURL,
        headers: def.defaultHeaders,
      },
    }));
  }));

  const tasks = taskGroups.flat();
  if (tasks.length === 0) {
    console.log(chalk.yellow("\n  No free models found for configured providers.\n"));
    return [];
  }

  console.log();
  console.log(chalk.dim(`  Testing ${tasks.length} free models in parallel...\n`));

  let completed = 0;
  const allResults = await Promise.all(tasks.map(async (task) => {
    const result = await benchmarkModel(task.provider, task.model.id, task.providerConf);
    completed += 1;

    const prefix = chalk.dim(`  [${completed}/${tasks.length}] `);
    if (result.slow) {
      console.log(
        prefix +
          chalk.yellow(`slow ${result.provider}/${result.modelId}`) +
          chalk.dim(` — >${SLOW_THRESHOLD_MS / 1000}s`)
      );
    } else if (result.error) {
      console.log(
        prefix +
          chalk.red(`✗ ${result.provider}/${result.modelId}`) +
          chalk.dim(` — ${result.error.slice(0, 80)}`)
      );
    } else {
      console.log(
        prefix +
          chalk.hex(semantic.success)(`✓ ${result.provider}/${result.modelId}`) +
          chalk.dim(` — ${result.totalMs}ms · TTFT ${result.timeToFirstTokenMs}ms`)
      );
    }

    return result;
  }));

  console.log();

  printResults(allResults);
  return allResults;
}

export function printResults(results: ModelResult[]): void {
  const slow = results.filter((r) => r.slow);
  const ok = results.filter((r) => !r.error && !r.slow);
  if (ok.length === 0) {
    console.log(chalk.red("  No models completed under 30s. Check your API keys or provider latency."));
    if (slow.length > 0) {
      console.log(chalk.yellow(`  ${slow.length} models marked slow.`));
    }
    console.log();
    return;
  }

  const sortedSpeed = [...ok].sort((a, b) => a.totalMs - b.totalMs);
  const sortedTTFT = [...ok].sort(
    (a, b) => a.timeToFirstTokenMs - b.timeToFirstTokenMs
  );

  const correctAnswers = ok.filter((r) => {
    const resp = r.response.replace(/[^0-9]/g, "");
    return resp.includes("4");
  });
  const smartest = [...correctAnswers].sort((a, b) => b.tokens - a.tokens);

  console.log(chalk.bold.white("  ═══ RESULTS ═══"));
  console.log();

  console.log(chalk.hex(progress.active)("  Speed (fastest first):"));
  sortedSpeed.slice(0, 5).forEach((r, i) => {
    const ms = chalk.hex(semantic.success)(r.totalMs.toString().padStart(5));
    const ttft = chalk.dim(`TTFT ${r.timeToFirstTokenMs}ms`);
    console.log(`    ${i + 1}. ${r.provider}/${r.modelId}`);
    console.log(`       ${ms}ms · ${ttft} · ${r.tokens} tokens`);
  });
  console.log();

  console.log(chalk.hex(progress.active)("  Responsiveness (first token):"));
  sortedTTFT.slice(0, 5).forEach((r, i) => {
    const ms = chalk.hex(brand.secondary)(r.timeToFirstTokenMs.toString().padStart(5));
    console.log(`    ${i + 1}. ${r.provider}/${r.modelId} — ${ms}ms`);
  });
  console.log();

  if (smartest.length > 0) {
    console.log(chalk.hex(progress.active)("  Smartness (correct + most detailed):"));
    smartest.slice(0, 5).forEach((r, i) => {
      const tokens = chalk.yellow(r.tokens.toString());
      console.log(`    ${i + 1}. ${r.provider}/${r.modelId} — ${tokens} tokens`);
    });
    console.log();
  }

  const overall = [...correctAnswers].sort((a, b) => a.totalMs - b.totalMs);
  if (overall.length > 0) {
    const winner = overall[0];
    console.log(
      chalk.hex(brand.secondary)("  ★ Recommended: ") +
        `${winner.provider}/${winner.modelId}` +
        chalk.dim(` (${winner.totalMs}ms, correct)`)
    );
    console.log();
  }

  if (slow.length > 0) {
    console.log(chalk.yellow(`  Slow: ${slow.length} models exceeded ${SLOW_THRESHOLD_MS / 1000}s`));
    console.log();
  }
}

export const providersBenchmarkCommand = new Command("benchmark")
  .description("Test every free model across all working providers in parallel.")
  .option("-n, --models-per-provider <n>", "Optional max free models to test per provider")
  .option("-p, --providers <list>", "Comma-separated providers to test (default: all configured)")
  .action(async (options: { modelsPerProvider?: string; providers?: string }) => {
    await runProviderBenchmark({
      modelsPerProvider: options.modelsPerProvider ? parseInt(options.modelsPerProvider, 10) : undefined,
      providers: options.providers ? options.providers.split(",").map((s) => s.trim()) : undefined,
    });
  });
