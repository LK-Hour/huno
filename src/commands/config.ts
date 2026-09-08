import { Command } from "commander";
import chalk from "chalk";
import { loadConfig, saveConfig, ConfigSchema } from "../core/config.js";

function getPath(obj: unknown, keyPath: string): unknown {
  return keyPath
    .split(".")
    .reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), obj);
}

function setPath(obj: Record<string, unknown>, keyPath: string, value: unknown): void {
  const keys = keyPath.split(".");
  let target = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const next = target[key];
    if (typeof next !== "object" || next === null) target[key] = {};
    target = target[key] as Record<string, unknown>;
  }
  target[keys[keys.length - 1]] = value;
}

function coerceValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw !== "" && !Number.isNaN(Number(raw))) return Number(raw);
  return raw;
}

function flatten(obj: unknown, prefix = ""): [string, unknown][] {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [[prefix, obj]];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return flatten(value, path);
    }
    return [[path, value] as [string, unknown]];
  });
}

function maskSecret(value: string): string {
  if (value.length <= 8) return "********";
  return value.slice(0, 4) + "…" + value.slice(-4);
}

function displayValue(key: string, value: unknown): string {
  if (key.startsWith("apiKeys.") && typeof value === "string" && value) return maskSecret(value);
  return typeof value === "string" ? value : JSON.stringify(value);
}

export const configCommand = new Command("config").description(
  "Read and write .huno/config.json values (for scripting/CI). Use `huno configure` for the interactive wizard."
);

configCommand
  .command("list")
  .description("List all configuration values")
  .action(async () => {
    const result = await loadConfig();
    if (!result.ok) {
      console.error(chalk.red("  ✗ " + result.error.message));
      if (result.error.hint) console.error(chalk.dim("  " + result.error.hint));
      process.exitCode = 1;
      return;
    }
    console.log();
    for (const [key, value] of flatten(result.data)) {
      if (value === undefined) continue;
      console.log(`  ${chalk.cyan(key)} = ${displayValue(key, value)}`);
    }
    console.log();
  });

configCommand
  .command("get")
  .argument("<key>", "Dot-path key, e.g. defaultProvider or permissions.allowWrite")
  .description("Get a single configuration value")
  .action(async (key: string) => {
    const result = await loadConfig();
    if (!result.ok) {
      console.error(chalk.red("  ✗ " + result.error.message));
      if (result.error.hint) console.error(chalk.dim("  " + result.error.hint));
      process.exitCode = 1;
      return;
    }
    const value = getPath(result.data, key);
    if (value === undefined) {
      console.log(chalk.dim("  (unset)"));
      return;
    }
    console.log(displayValue(key, value));
  });

configCommand
  .command("set")
  .argument("<key>", "Dot-path key, e.g. defaultProvider or permissions.allowWrite")
  .argument("<value>", "Value to store (true/false/number/string)")
  .description("Set a single configuration value")
  .action(async (key: string, rawValue: string) => {
    const result = await loadConfig();
    if (!result.ok) {
      console.error(chalk.red("  ✗ " + result.error.message));
      console.error(chalk.dim("  Run `huno init` first."));
      process.exitCode = 1;
      return;
    }
    const config = result.data as unknown as Record<string, unknown>;
    setPath(config, key, coerceValue(rawValue));

    const validated = ConfigSchema.safeParse(config);
    if (!validated.success) {
      console.error(chalk.red(`  ✗ Invalid value for "${key}": ${validated.error.issues[0]?.message}`));
      process.exitCode = 1;
      return;
    }

    const saveResult = await saveConfig(validated.data);
    if (!saveResult.ok) {
      console.error(chalk.red("  ✗ " + saveResult.error.message));
      process.exitCode = 1;
      return;
    }
    console.log(chalk.green(`  ✓ ${key} = ${rawValue}`));
  });
