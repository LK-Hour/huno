import { Command } from "commander";
import chalk from "chalk";
import { ensureHunoDir, writeHunoFile } from "../storage/huno-dir.js";
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

    for (const file of files) {
      const result = await writeHunoFile(file.name, file.content);
      if (!result.ok) {
        console.error(chalk.red(result.error.toString()));
        process.exit(1);
      }
    }

    console.log(chalk.green("Created .huno/"));
    console.log("  - config.json");
    console.log("  - memory.md");
    console.log("  - project-map.json");
    console.log("  - history.jsonl");
    console.log();
    console.log("Next steps:");
    console.log("  huno explain");
  });