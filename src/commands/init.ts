import { Command } from "commander";
import chalk from "chalk";
import {
  ensureHunoDir,
  ensureHunoFile,
  ensureHunoSubdir,
  type InitEntry,
} from "../storage/huno-dir.js";
import { defaultConfig } from "../core/config.js";
import { serializeProjectMap, emptyProjectMap } from "../storage/project-map.js";

export const initCommand = new Command("init")
  .description("Initialize Huno in the current project.")
  .action(async () => {
    console.log(chalk.cyan("Initializing Huno..."));

    const dirResult = await ensureHunoDir();
    if (!dirResult.ok) {
      console.error(chalk.red(dirResult.error.toString()));
      process.exit(1);
    }

    const configContent = JSON.stringify(defaultConfig(), null, 2);
    const memoryContent = `# Huno Project Memory

## Decisions

- 

## Preferences

- 

## Notes

- 
`;
    const mapContent = serializeProjectMap(emptyProjectMap());
    const historyContent = "";

    const files = [
      { name: "config.json", content: configContent },
      { name: "memory.md", content: memoryContent },
      { name: "project-map.json", content: mapContent },
      { name: "history.jsonl", content: historyContent },
    ];
    const results: InitEntry[] = [];

    for (const file of files) {
      const result = await ensureHunoFile(file.name, file.content);
      if (!result.ok) {
        console.error(chalk.red(result.error.toString()));
        process.exit(1);
      }
      results.push(result.data);
    }

    for (const dirname of ["logs", "cache"]) {
      const result = await ensureHunoSubdir(dirname);
      if (!result.ok) {
        console.error(chalk.red(result.error.toString()));
        process.exit(1);
      }
      results.push(result.data);
    }

    const created = results.filter((entry) => entry.status === "created");
    const existing = results.filter((entry) => entry.status === "exists");

    if (created.length === results.length) {
      console.log(chalk.green("Huno initialized this project."));
    } else {
      console.log(chalk.green("Huno is already initialized."));
    }

    if (created.length > 0) {
      console.log();
      console.log("Created:");
      for (const entry of created) {
        console.log(chalk.green(`  ✓ ${entry.path}`));
      }
    }

    if (existing.length > 0) {
      console.log();
      console.log("Found:");
      for (const entry of existing) {
        console.log(chalk.yellow(`  ✓ ${entry.path}`));
      }
    }

    console.log();
    console.log("Next step:");
    console.log(chalk.cyan("  huno explain"));
  });
