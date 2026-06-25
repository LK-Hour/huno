import { Command } from "commander";
import fs from "fs/promises";
import path from "path";
import readline from "readline";
import chalk from "chalk";
import {
  fetchProviderModels,
  listProviderInfo,
  type ProviderInfo,
  type ProviderModelInfo,
} from "../providers/index.js";
import { defaultConfig, loadConfig, saveConfig, type Config } from "../core/config.js";
import { ensureHunoDir } from "../storage/huno-dir.js";
import { HunoError, type Result } from "../utils/errors.js";

export type ProviderConfigurationSummary = {
  provider: string;
  model: string;
};

export const providersCommand = new Command("providers")
  .description("List supported model providers and required environment variables.")
  .action(() => {
    const providers = listProviderInfo();

    console.log(chalk.cyan("Supported providers"));
    console.log();

    for (const provider of providers) {
      console.log(chalk.green(provider.name));
      console.log(`  default model: ${provider.defaultModel}`);
      if (provider.aliases.length > 0) {
        console.log(`  aliases: ${provider.aliases.join(", ")}`);
      }
      if (provider.envKeys.length > 0) {
        console.log(`  env: ${provider.envKeys.join(" or ")}`);
      }
      if (provider.requiresAccountId) {
        console.log("  extra: CLOUDFLARE_ACCOUNT_ID");
      }
      console.log();
    }

    console.log("Setup:");
    console.log("  1. Create or edit .env in your project root.");
    console.log("  2. Add the provider key, for example GROQ_API_KEY=...");
    console.log("  3. Run with --provider, or set HUNO_PROVIDER in .env.");
    console.log();
    console.log("Use:");
    console.log(chalk.cyan('  huno ask "question" --provider groq --model llama-3.3-70b-versatile'));
    console.log(chalk.cyan("  HUNO_PROVIDER=google HUNO_MODEL=gemini-3.5-flash huno ask \"question\""));
  });

providersCommand
  .command("configure")
  .description("Interactively configure a provider and save it to .env and .huno/config.json.")
  .action(async () => {
    const result = await configureProviderInteractive();
    if (!result.ok) {
      console.error(chalk.red(result.error.message));
      if (result.error.hint) {
        console.error(chalk.yellow(result.error.hint));
      }
      process.exit(1);
    }

    console.log();
    console.log(chalk.green(`Configured provider: ${result.data.provider}`));
    console.log(`Default model: ${result.data.model}`);
    console.log(`Saved settings to ${chalk.cyan(".env")} and ${chalk.cyan(".huno/config.json")}.`);
  });

export async function configureProviderInteractive(): Promise<Result<ProviderConfigurationSummary>> {
  const providers = listProviderInfo();
  const selected = await selectProviderInteractively(providers);

  if (!selected) {
    return {
      ok: false,
      error: new HunoError("No provider selected.", "PROVIDER_SELECTION_CANCELLED"),
    };
  }

  const envUpdates: Record<string, string> = {
    HUNO_PROVIDER: selected.name,
  };

  let accountId = "";
  if (selected.requiresAccountId) {
    const existingAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || "";
    accountId = (
      await prompt(
        existingAccountId ? "CLOUDFLARE_ACCOUNT_ID [stored]" : "CLOUDFLARE_ACCOUNT_ID"
      )
    ).trim();
    if (!accountId && existingAccountId) {
      accountId = existingAccountId;
    }
    if (!accountId) {
      return {
        ok: false,
        error: new HunoError(
          "CLOUDFLARE_ACCOUNT_ID is required for Cloudflare.",
          "PROVIDER_ACCOUNT_ID_MISSING"
        ),
      };
    }
    envUpdates.CLOUDFLARE_ACCOUNT_ID = accountId;
  }

  let model = selected.defaultModel;
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

    const modelResult = await fetchProviderModels({
      provider: selected.name,
      apiKey: finalApiKey,
      cloudflareAccountId: accountId || undefined,
    });

    if (modelResult.ok && modelResult.data.length > 0) {
      const selectedModel = await selectModelInteractively(modelResult.data);
      if (!selectedModel) {
        return {
          ok: false,
          error: new HunoError("No model selected.", "MODEL_SELECTION_CANCELLED"),
        };
      }
      model = selectedModel;
    } else {
      console.log();
      console.log(chalk.yellow("Could not fetch models automatically. Using the provider default model."));
    }
  }

  envUpdates.HUNO_MODEL = model;
  const persistResult = await persistProviderConfig(selected.name, model, envUpdates, accountId || undefined);
  if (!persistResult.ok) {
    return persistResult;
  }

  return {
    ok: true,
    data: {
      provider: selected.name,
      model,
    },
  };
}

export async function configureModelInteractive(): Promise<Result<ProviderConfigurationSummary>> {
  const current = await getCurrentProviderConfiguration();
  if (!current.ok) {
    return current;
  }

  const providerInfo = listProviderInfo().find((provider) => provider.name === current.data.provider);
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
  const existingApiKey = process.env[envKey] || "";
  const apiKey = await prompt(existingApiKey ? `${envKey} [stored]` : envKey, { hidden: true });
  const finalApiKey = apiKey.trim() || existingApiKey;
  if (!finalApiKey) {
    return {
      ok: false,
      error: new HunoError("API key is required for this provider.", "API_KEY_MISSING"),
    };
  }

  const cloudflareAccountId =
    providerInfo.requiresAccountId
      ? (await resolveCloudflareAccountId()).data
      : undefined;

  if (providerInfo.requiresAccountId && !cloudflareAccountId) {
    return {
      ok: false,
      error: new HunoError(
        "CLOUDFLARE_ACCOUNT_ID is required for Cloudflare.",
        "PROVIDER_ACCOUNT_ID_MISSING"
      ),
    };
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

  const model = await selectModelInteractively(modelResult.data);
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
  const provider = process.env.HUNO_PROVIDER || config.defaultProvider;
  const model = process.env.HUNO_MODEL || config.defaultModel;

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
    };

    stdin.on("keypress", onKeypress);
  });
}

async function selectProviderInteractively(providers: ProviderInfo[]): Promise<ProviderInfo | null> {
  return selectFromList(
    "Choose a provider",
    providers.map((provider) => ({
      value: provider,
      label: provider.name,
    }))
  );
}

async function selectModelInteractively(
  models: ProviderModelInfo[]
): Promise<string | null> {
  return selectFromList(
    "Choose a model",
    models.map((model) => ({
      value: model.id,
      label: model.id,
    }))
  );
}

type ListItem<T> = {
  value: T;
  label: string;
};

async function selectFromList<T>(
  title: string,
  items: ListItem<T>[]
): Promise<T | null> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log(chalk.cyan(title));
    console.log();
    items.forEach((item, index) => {
      console.log(`${index + 1}. ${item.label}`);
    });
    console.log();

    const input = await prompt("Number");
    const index = Number.parseInt(input.trim(), 10);
    if (!Number.isNaN(index) && index >= 1 && index <= items.length) {
      return items[index - 1].value;
    }
    return null;
  }

  return new Promise((resolve) => {
    let index = 0;
    const stdin = process.stdin;
    const stdout = process.stdout;
    const previousRawMode = stdin.isTTY ? stdin.isRaw : false;
    let renderedLineCount = 0;
    const maxVisibleItems = Math.max(
      5,
      Math.min(items.length, (stdout.rows || 24) - 6, 12)
    );

    readline.emitKeypressEvents(stdin);
    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }

    const render = (): void => {
      const lines = [`${chalk.cyan(title)}`, ""];
      const windowStart = Math.max(
        0,
        Math.min(
          index - Math.floor(maxVisibleItems / 2),
          items.length - maxVisibleItems
        )
      );
      const visibleItems = items.slice(windowStart, windowStart + maxVisibleItems);

      if (windowStart > 0) {
        lines.push(chalk.dim(`  ... ${windowStart} more above`));
      }

      visibleItems.forEach((item, visibleIndex) => {
        const itemIndex = windowStart + visibleIndex;
        const prefix = itemIndex === index ? chalk.green(">") : " ";
        const line = itemIndex === index ? chalk.bold(item.label) : item.label;
        lines.push(`${prefix} ${line}`);
      });

      const remainingBelow = items.length - (windowStart + visibleItems.length);
      if (remainingBelow > 0) {
        lines.push(chalk.dim(`  ... ${remainingBelow} more below`));
      }

      lines.push("", chalk.dim("Use up/down arrows and press Enter."));

      if (renderedLineCount > 0) {
        readline.moveCursor(stdout, 0, -(renderedLineCount - 1));
        readline.cursorTo(stdout, 0);
        readline.clearScreenDown(stdout);
      }

      stdout.write(lines.join("\n"));
      renderedLineCount = lines.length;
    };

    const cleanup = (): void => {
      stdin.off("keypress", onKeypress);
      if (stdin.isTTY) {
        stdin.setRawMode(previousRawMode);
      }
      if (renderedLineCount > 0) {
        readline.moveCursor(stdout, 0, -(renderedLineCount - 1));
        readline.cursorTo(stdout, 0);
        readline.clearScreenDown(stdout);
      }
      stdout.write("\n");
    };

    const onKeypress = (_: string, key: { name?: string; ctrl?: boolean }): void => {
      if (key.name === "up") {
        index = index === 0 ? items.length - 1 : index - 1;
        render();
        return;
      }
      if (key.name === "down") {
        index = index === items.length - 1 ? 0 : index + 1;
        render();
        return;
      }
      if (key.name === "return") {
        const selected = items[index].value;
        cleanup();
        resolve(selected);
        return;
      }
      if (key.ctrl && key.name === "c") {
        cleanup();
        process.exit(1);
      }
    };

    render();
    stdin.on("keypress", onKeypress);
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

  const saveResult = await saveConfig(config as Config);
  if (!saveResult.ok) {
    return saveResult;
  }

  const envPath = path.join(process.cwd(), ".env");
  await writeEnvUpdates(envPath, envUpdates);

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
