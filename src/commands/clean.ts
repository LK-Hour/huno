import { Command } from "commander";
import chalk from "chalk";
import fs from "fs/promises";
import path from "path";
import readline from "readline";
import { getHunoDir } from "../utils/paths.js";
import { isHunoInitialized, DEFAULT_MEMORY_TEMPLATE } from "../storage/huno-dir.js";
import { defaultConfig, saveConfig } from "../core/config.js";
import { serializeProjectMap, emptyProjectMap } from "../storage/project-map.js";

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(chalk.yellow(`  ${question} (y/N): `), (answer) => {
      rl.close();
      resolve(["y", "yes"].includes(answer.trim().toLowerCase()));
    });
  });
}

async function clearDirContents(dir: string): Promise<number> {
  try {
    const entries = await fs.readdir(dir);
    for (const entry of entries) {
      await fs.rm(path.join(dir, entry), { recursive: true, force: true });
    }
    return entries.length;
  } catch {
    return 0;
  }
}

export const cleanCommand = new Command("clean")
  .description("Clear Huno's regenerable cache and logs for this project.")
  .action(async () => {
    if (!(await isHunoInitialized())) {
      console.log(chalk.yellow("  Huno isn't initialized in this project. Nothing to clean."));
      return;
    }

    const dir = getHunoDir();
    const cacheCount = await clearDirContents(path.join(dir, "cache"));
    const logsCount = await clearDirContents(path.join(dir, "logs"));

    console.log();
    console.log(chalk.green(`  ✓ Cleared ${cacheCount} cache file(s)`));
    console.log(chalk.green(`  ✓ Cleared ${logsCount} log file(s)`));
    console.log();
    console.log(chalk.dim("  Config, memory, and history were left untouched — use `huno reset` to clear those too."));
    console.log();
  });

export const resetCommand = new Command("reset")
  .description("Reset this project's Huno state to defaults (config, memory, history, project map, cache).")
  .option("-y, --yes", "Skip the confirmation prompt")
  .action(async (opts: { yes?: boolean }) => {
    if (!(await isHunoInitialized())) {
      console.log(chalk.yellow("  Huno isn't initialized in this project. Nothing to reset."));
      return;
    }

    console.log();
    console.log(chalk.yellow("  This will erase:"));
    console.log(chalk.dim("    - .huno/config.json    (provider, API keys, settings)"));
    console.log(chalk.dim("    - .huno/memory.md      (saved project memory)"));
    console.log(chalk.dim("    - .huno/history.jsonl  (session history)"));
    console.log(chalk.dim("    - .huno/project-map.json (cached project scan)"));
    console.log(chalk.dim("    - .huno/cache/ and .huno/logs/"));
    console.log();

    if (!opts.yes && !(await confirm("Continue?"))) {
      console.log(chalk.dim("  Cancelled."));
      console.log();
      return;
    }

    const dir = getHunoDir();
    await clearDirContents(path.join(dir, "cache"));
    await clearDirContents(path.join(dir, "logs"));

    const saveResult = await saveConfig(defaultConfig());
    if (!saveResult.ok) {
      console.error(chalk.red("  ✗ " + saveResult.error.message));
      process.exit(1);
    }
    await fs.writeFile(path.join(dir, "history.jsonl"), "", "utf-8");
    await fs.writeFile(path.join(dir, "project-map.json"), serializeProjectMap(emptyProjectMap()), "utf-8");
    await fs.writeFile(path.join(dir, "memory.md"), DEFAULT_MEMORY_TEMPLATE, "utf-8");

    console.log();
    console.log(chalk.green("  ✓ Reset complete. Run `huno configure` to set up a provider again."));
    console.log();
  });
