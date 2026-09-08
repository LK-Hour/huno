import { Command } from "commander";
import fs from "fs/promises";
import path from "path";
import readline from "readline";
import chalk from "chalk";
import { readFileSync } from "fs";
import {
  fetchProviderModels,
  findProviderDefinition,
  listProviderInfo,
  type ProviderInfo,
  type ProviderModelInfo,
} from "../providers/index.js";
import { defaultConfig, loadConfig, saveConfig, type Config } from "../core/config.js";
import { ensureHunoDir } from "../storage/huno-dir.js";
import { HunoError, type Result } from "../utils/errors.js";
import { selectFromDropdown } from "../ui/terminal-select.js";
import { neutral, progress, semantic } from "../ui/theme.js";

export type ProviderConfigurationSummary = {
  provider: string;
  model: string;
};

import { providersAuditCommand } from "./providers-audit.js";
import { providersBenchmarkCommand } from "./providers-benchmark.js";

export const providersCommand = new Command("providers")
  .description("List supported model providers and required environment variables.")
  .action(async () => {
    const providers = listProviderInfo();

    // Show current config
    const current = await getCurrentProviderConfiguration();
    if (current.ok) {
      console.log();
      console.log(chalk.bold.white("  Current Configuration"));
      console.log(chalk.dim(`  Provider: ${current.data.provider}`));
      console.log(chalk.dim(`  Model: ${current.data.model}`));
      console.log();
    }

    console.log(chalk.bold.white("  Supported Providers"));
    console.log(chalk.dim("  Use `huno providers configure` to set up\n"));

    for (const provider of providers) {
      // Check if configured
      let configured = false;
      for (const envKey of provider.envKeys) {
        if (process.env[envKey]) { configured = true; break; }
      }
      try {
        const config = JSON.parse(readFileSync(".huno/config.json", "utf-8"));
        if (config.apiKeys && config.apiKeys[provider.name]) configured = true;
      } catch {}

      const status = configured ? chalk.green("✓") : chalk.dim("○");
      const name = configured ? chalk.bold(provider.name) : provider.name;
      console.log(`  ${status} ${name}`);
      console.log(chalk.dim(`    default: ${provider.defaultModel}`));
      if (provider.aliases.length > 0) {
        console.log(chalk.dim(`    aliases: ${provider.aliases.join(", ")}`));
      }
      if (provider.envKeys.length > 0) {
        console.log(chalk.dim(`    env: ${provider.envKeys.join(" or ")}`));
      }
      if (provider.signupUrl) {
        console.log(chalk.dim(`    get key: ${chalk.cyan(provider.signupUrl)}`));
      }
      console.log();
    }

    console.log(chalk.dim("  ✓ = configured, ○ = not configured"));
    console.log();
  });

providersCommand
  .command("configure")
  .description("Interactively configure a provider with arrow-key selection.")
  .action(async () => {
    const result = await configureProviderInteractive();
    if (!result.ok) {
      console.error(chalk.red(result.error.message));
      if (result.error.hint) {
        console.error(chalk.yellow(result.error.hint));
      }
      process.exit(1);
    }
    // Success message already printed in configureProviderInteractive
  });

providersCommand.addCommand(providersAuditCommand);
providersCommand.addCommand(providersBenchmarkCommand);

export async function configureProviderInteractive(): Promise<Result<ProviderConfigurationSummary>> {
  const providers = listProviderInfo();

  // Step 1: Select provider with arrow keys (show configured status)
  console.log();
  console.log(chalk.bold.white("  Select a Provider"));
  const selected = await selectProviderInteractively(providers);
  if (!selected) {
    return {
      ok: false,
      error: new HunoError("No provider selected.", "PROVIDER_SELECTION_CANCELLED"),
    };
  }

  // Step 2: Show signup link if not already configured
  if (selected.name !== "ollama" && selected.signupUrl) {
    const envKey = selected.envKeys[0];
    const existingApiKey = process.env[envKey] || "";
    let configHasKey = false;
    try {
      const config = JSON.parse(readFileSync(".huno/config.json", "utf-8"));
      if (config.apiKeys && config.apiKeys[selected.name]) configHasKey = true;
    } catch {}
    if (!existingApiKey && !configHasKey) {
      console.log(chalk.dim(`    get key: ${chalk.cyan(selected.signupUrl)}`));
      console.log();
    }
  }

  // Step 4: API key input (skip for Ollama)
  const envUpdates: Record<string, string> = {
    HUNO_PROVIDER: selected.name,
  };

  if (selected.name !== "ollama") {
    const envKey = selected.envKeys[0];
    const existingApiKey = process.env[envKey] || "";
    const apiKey = await prompt(existingApiKey ? `${envKey} [stored]` : envKey, { hidden: true });
    const finalApiKey = apiKey.trim() || existingApiKey;
    if (!finalApiKey) {
      return {
        ok: false,
        error: new HunoError("API key is required for this provider.", "API_KEY_MISSING"),
      };
    }
    envUpdates[envKey] = finalApiKey;
  }

  // Step 5: Cloudflare account ID (if needed)
  let accountId = "";
  if (selected.requiresAccountId) {
    const existingAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || "";
    accountId = (
      await prompt(
        existingAccountId ? "CLOUDFLARE_ACCOUNT_ID [stored]" : "CLOUDFLARE_ACCOUNT_ID"
      )
    ).trim();
    if (!accountId && existingAccountId) accountId = existingAccountId;
    if (!accountId) {
      return {
        ok: false,
        error: new HunoError("CLOUDFLARE_ACCOUNT_ID is required.", "PROVIDER_ACCOUNT_ID_MISSING"),
      };
    }
    envUpdates.CLOUDFLARE_ACCOUNT_ID = accountId;
  }

  // Step 6: Loading state + Model selection
  let model = selected.defaultModel;
  if (selected.name !== "ollama") {
    const envKey = selected.envKeys[0];
    const apiKey = envUpdates[envKey] || process.env[envKey] || "";

    // Show loading spinner
    console.log();
    const spinner = startSpinner(`  Fetching models for ${selected.name}...`);
    const modelResult = await fetchProviderModels({
      provider: selected.name,
      apiKey,
      cloudflareAccountId: accountId || undefined,
    });
    stopSpinner(spinner);

    if (modelResult.ok && modelResult.data.length > 0) {
      console.log(chalk.green(`  ✓ Found ${modelResult.data.length} models\n`));
      console.log(chalk.bold.white("  Select a Model"));
      const selectedModel = await selectModelInteractive(modelResult.data);
      if (!selectedModel) {
        return {
          ok: false,
          error: new HunoError("No model selected.", "MODEL_SELECTION_CANCELLED"),
        };
      }
      model = selectedModel;
    } else {
      console.log(chalk.yellow("  ⚠ Could not fetch models. Using default."));
    }
  }

  // Step 7: Save
  envUpdates.HUNO_MODEL = model;
  const persistResult = await persistProviderConfig(selected.name, model, envUpdates, accountId || undefined);
  if (!persistResult.ok) {
    return persistResult;
  }

  console.log();
  console.log(chalk.green("  ✓ Provider configured successfully!"));
  console.log(chalk.dim(`  Provider: ${selected.name}`));
  console.log(chalk.dim(`  Model: ${model}`));
  console.log();

  return {
    ok: true,
    data: {
      provider: selected.name,
      model,
    },
  };
}

/**
 * Non-interactive counterpart to configureProviderInteractive(), for CI and
 * scripting (`huno configure --provider ... --api-key ...`). Trusts the
 * caller's --model rather than fetching the provider's live model list, so
 * it never needs network access to succeed.
 */
export async function configureProviderNonInteractive(opts: {
  provider: string;
  model?: string;
  apiKey?: string;
  accountId?: string;
}): Promise<Result<ProviderConfigurationSummary>> {
  const providers = listProviderInfo();
  const normalized = opts.provider.toLowerCase();
  const selected = providers.find((p) => p.name === normalized || p.aliases.includes(normalized));
  if (!selected) {
    return {
      ok: false,
      error: new HunoError(
        `Unknown provider: ${opts.provider}`,
        "PROVIDER_UNKNOWN",
        `Supported: ${providers.map((p) => p.name).join(", ")}`
      ),
    };
  }

  const envUpdates: Record<string, string> = { HUNO_PROVIDER: selected.name };
  let accountId: string | undefined;

  if (selected.name !== "ollama") {
    const envKey = selected.envKeys[0];
    const finalApiKey = opts.apiKey || process.env[envKey] || "";
    if (!finalApiKey) {
      return {
        ok: false,
        error: new HunoError(
          "API key is required for this provider.",
          "API_KEY_MISSING",
          `Pass --api-key, or set ${envKey} in your environment.`
        ),
      };
    }
    envUpdates[envKey] = finalApiKey;
  }

  if (selected.requiresAccountId) {
    accountId = opts.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    if (!accountId) {
      return {
        ok: false,
        error: new HunoError(
          "CLOUDFLARE_ACCOUNT_ID is required.",
          "PROVIDER_ACCOUNT_ID_MISSING",
          "Pass --account-id, or set CLOUDFLARE_ACCOUNT_ID in your environment."
        ),
      };
    }
    envUpdates.CLOUDFLARE_ACCOUNT_ID = accountId;
  }

  const model = opts.model || selected.defaultModel;
  envUpdates.HUNO_MODEL = model;

  const persistResult = await persistProviderConfig(selected.name, model, envUpdates, accountId);
  if (!persistResult.ok) {
    return persistResult;
  }

  return { ok: true, data: { provider: selected.name, model } };
}

// ─── Spinner ────────────────────────────────────────────────────────────────

let spinnerInterval: ReturnType<typeof setInterval> | null = null;

function startSpinner(message: string): { stop: () => void } {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  process.stdout.write(message + " " + frames[0]);
  spinnerInterval = setInterval(() => {
    i = (i + 1) % frames.length;
    process.stdout.write(`\r${message} ${frames[i]}`);
  }, 80);
  return {
    stop: () => {
      if (spinnerInterval) {
        clearInterval(spinnerInterval);
        spinnerInterval = null;
      }
      process.stdout.write("\r" + " ".repeat(message.length + 2) + "\r");
    },
  };
}

function stopSpinner(handle: { stop: () => void }): void {
  handle.stop();
}

export async function configureModelInteractive(): Promise<Result<ProviderConfigurationSummary>> {
  const current = await getCurrentProviderConfiguration();
  if (!current.ok) {
    return current;
  }

  const providerInfo = listProviderInfo().find(
    (provider) =>
      provider.name === current.data.provider ||
      provider.aliases.includes(current.data.provider)
  );
  if (!providerInfo) {
    return {
      ok: false,
      error: new HunoError(
        `Unknown configured provider: ${current.data.provider}`,
        "PROVIDER_UNKNOWN"
      ),
    };
  }

  if (providerInfo.name === "ollama") {
    return {
      ok: false,
      error: new HunoError(
        "Interactive model selection is not available for ollama yet.",
        "MODEL_SELECTION_UNAVAILABLE",
        "Set HUNO_MODEL in .env, or run /configure and choose a cloud provider."
      ),
    };
  }

  const envKey = providerInfo.envKeys[0];
  const configResult = await loadConfig();
  const config = configResult.ok ? configResult.data : defaultConfig();
  const providerDef = findProviderDefinition(providerInfo.name);
  const configuredApiKey = providerDef ? config.apiKeys?.[providerDef.configKey] : undefined;
  const existingApiKey = configuredApiKey || process.env[envKey] || "";
  const apiKey = existingApiKey
    ? ""
    : await prompt(envKey, { hidden: true });
  const finalApiKey = apiKey.trim() || existingApiKey;
  if (!finalApiKey) {
    return {
      ok: false,
      error: new HunoError("API key is required for this provider.", "API_KEY_MISSING"),
    };
  }

  let cloudflareAccountId: string | undefined;
  if (providerInfo.requiresAccountId) {
    const accountIdResult = await resolveCloudflareAccountId();
    if (!accountIdResult.ok) {
      return accountIdResult;
    }
    cloudflareAccountId = accountIdResult.data;
  }

  const modelResult = await fetchProviderModels({
    provider: providerInfo.name,
    apiKey: finalApiKey,
    cloudflareAccountId,
  });

  if (!modelResult.ok || modelResult.data.length === 0) {
    return {
      ok: false,
      error: new HunoError(
        "Could not fetch models for the current provider.",
        "PROVIDER_MODEL_LIST_FAILED",
        modelResult.ok ? "No models were returned by the provider." : modelResult.error.hint
      ),
    };
  }

  const model = await selectModelInteractive(modelResult.data);
  if (!model) {
    return {
      ok: false,
      error: new HunoError("No model selected.", "MODEL_SELECTION_CANCELLED"),
    };
  }

  const envUpdates: Record<string, string> = {
    HUNO_PROVIDER: providerInfo.name,
    HUNO_MODEL: model,
    [envKey]: finalApiKey,
  };
  if (cloudflareAccountId) {
    envUpdates.CLOUDFLARE_ACCOUNT_ID = cloudflareAccountId;
  }

  const persistResult = await persistProviderConfig(
    providerInfo.name,
    model,
    envUpdates,
    cloudflareAccountId
  );
  if (!persistResult.ok) {
    return persistResult;
  }

  return {
    ok: true,
    data: {
      provider: providerInfo.name,
      model,
    },
  };
}

export async function getCurrentProviderConfiguration(): Promise<Result<ProviderConfigurationSummary>> {
  const configResult = await loadConfig();
  const config = configResult.ok ? configResult.data : defaultConfig();
  // Priority: .huno/config.json > env vars
  const provider = config.defaultProvider || process.env.HUNO_PROVIDER;
  const model = config.defaultModel || process.env.HUNO_MODEL;

  if (!provider) {
    return {
      ok: false,
      error: new HunoError(
        "No provider is configured yet.",
        "PROVIDER_NOT_CONFIGURED",
        "Run /configure or `huno providers configure` first."
      ),
    };
  }

  return {
    ok: true,
    data: {
      provider,
      model: model || "not set",
    },
  };
}

type PromptOptions = {
  hidden?: boolean;
};

async function prompt(question: string, options: PromptOptions = {}): Promise<string> {
  if (options.hidden && process.stdin.isTTY && process.stdout.isTTY) {
    return promptHidden(question);
  }

  return new Promise((resolve) => {
    process.stdin.resume();
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`${question}: `, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    let value = "";
    const previousRawMode = stdin.isTTY ? stdin.isRaw : false;

    readline.emitKeypressEvents(stdin);
    stdin.resume();
    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }

    stdout.write(`${question}: `);

    const onKeypress = (input: string, key: { name?: string; ctrl?: boolean }): void => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        process.exit(1);
      }

      if (key.name === "return") {
        cleanup();
        stdout.write("\n");
        resolve(value);
        return;
      }

      if (key.name === "backspace") {
        if (value.length > 0) {
          value = value.slice(0, -1);
          stdout.write("\b \b");
        }
        return;
      }

      if (input && !key.ctrl && key.name !== "escape") {
        value += input;
        stdout.write("*");
      }
    };

    const cleanup = (): void => {
      stdin.off("keypress", onKeypress);
      if (stdin.isTTY) {
        stdin.setRawMode(previousRawMode);
      }
      stdin.pause();
    };

    stdin.on("keypress", onKeypress);
  });
}

export async function selectProviderInteractively(providers: ProviderInfo[]): Promise<ProviderInfo | null> {
  // Check which providers have API keys configured
  const configured = new Set<string>();
  for (const p of providers) {
    for (const envKey of p.envKeys) {
      if (process.env[envKey]) {
        configured.add(p.name);
        break;
      }
    }
    // Also check config.json
    try {
      const config = JSON.parse(readFileSync(".huno/config.json", "utf-8"));
      if (config.apiKeys && config.apiKeys[p.name]) configured.add(p.name);
    } catch {}
  }

  return selectFromDropdown({
    title: "Choose a provider",
    maxVisibleItems: 12,
    filterable: false,
    items: providers.map((provider) => {
      const isConfigured = configured.has(provider.name);
      const status = isConfigured ? chalk.hex(semantic.success)("✓") : chalk.hex(neutral.muted)(" ");
      const aliases = provider.aliases.length > 0 ? chalk.hex(neutral.muted)(` (${provider.aliases.join(", ")})`) : "";
      const configuredLabel = isConfigured ? chalk.hex(neutral.muted)(" — configured") : "";
      return {
        value: provider,
        label: `${status} ${chalk.hex(progress.active)(provider.name)}${aliases}${configuredLabel}`,
        searchableText: [provider.name, ...provider.aliases].join(" "),
      };
    }),
  });
}

async function selectModelInteractive(
  models: ProviderModelInfo[]
): Promise<string | null> {
  // Sort: free models first, then alphabetical within each group
  const sorted = [...models].sort((a, b) => {
    if (a.likelyFree && !b.likelyFree) return -1;
    if (!a.likelyFree && b.likelyFree) return 1;
    return a.id.localeCompare(b.id);
  });

  return selectFromDropdown({
    title: "Choose a model",
    maxVisibleItems: 12,
    filterable: false,
    items: sorted.map((model) => ({
      value: model.id,
      label: `${chalk.hex(progress.active)(model.id)}${model.likelyFree ? chalk.hex(semantic.success)(" (free)") : ""}`,
      searchableText: model.id,
    })),
  });
}

async function writeEnvUpdates(envPath: string, updates: Record<string, string>): Promise<void> {
  let existing = "";
  try {
    existing = await fs.readFile(envPath, "utf-8");
  } catch {
    existing = "";
  }

  const lines = existing ? existing.split(/\r?\n/) : [];
  const seen = new Set<string>();
  const nextLines = lines.map((line) => {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
    if (!match) return line;

    const key = match[1];
    if (!(key in updates)) return line;
    seen.add(key);
    return `${key}=${formatEnvValue(updates[key])}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) {
      nextLines.push(`${key}=${formatEnvValue(value)}`);
    }
  }

  const output = `${nextLines.filter((line, index, arr) => !(line === "" && index === arr.length - 1)).join("\n")}\n`;
  await fs.writeFile(envPath, output, "utf-8");
}

function formatEnvValue(value: string): string {
  if (/\s/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}

async function persistProviderConfig(
  provider: string,
  model: string,
  envUpdates: Record<string, string>,
  cloudflareAccountId?: string
): Promise<Result<void>> {
  const dirResult = await ensureHunoDir();
  if (!dirResult.ok) {
    return dirResult;
  }

  const configResult = await loadConfig();
  const config = configResult.ok ? configResult.data : defaultConfig();
  config.defaultProvider = provider;
  config.defaultModel = model;
  if (cloudflareAccountId) {
    config.cloudflareAccountId = cloudflareAccountId;
  }

  // Store API keys in config.json (single source of truth)
  const providerInfo = listProviderInfo().find(
    (p) => p.name === provider || p.aliases.includes(provider)
  );
  if (providerInfo) {
    const envKey = providerInfo.envKeys[0];
    if (envUpdates[envKey]) {
      if (!config.apiKeys) config.apiKeys = {};
      const configKey = providerInfo.name as keyof NonNullable<Config["apiKeys"]>;
      config.apiKeys[configKey] = envUpdates[envKey];
    }
  }

  const saveResult = await saveConfig(config as Config);
  if (!saveResult.ok) {
    return saveResult;
  }

  // Only write non-sensitive config to .env (no API keys)
  const safeEnvUpdates: Record<string, string> = {};
  if (envUpdates.HUNO_PROVIDER) safeEnvUpdates.HUNO_PROVIDER = envUpdates.HUNO_PROVIDER;
  if (envUpdates.HUNO_MODEL) safeEnvUpdates.HUNO_MODEL = envUpdates.HUNO_MODEL;
  if (envUpdates.CLOUDFLARE_ACCOUNT_ID) safeEnvUpdates.CLOUDFLARE_ACCOUNT_ID = envUpdates.CLOUDFLARE_ACCOUNT_ID;

  if (Object.keys(safeEnvUpdates).length > 0) {
    const envPath = path.join(process.cwd(), ".env");
    await writeEnvUpdates(envPath, safeEnvUpdates);
  }

  return { ok: true, data: undefined };
}

async function resolveCloudflareAccountId(): Promise<Result<string>> {
  const configResult = await loadConfig();
  const config = configResult.ok ? configResult.data : defaultConfig();
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || config.cloudflareAccountId || "";

  if (!accountId) {
    return {
      ok: false,
      error: new HunoError(
        "CLOUDFLARE_ACCOUNT_ID is required for Cloudflare.",
        "PROVIDER_ACCOUNT_ID_MISSING"
      ),
    };
  }

  return { ok: true, data: accountId };
}
