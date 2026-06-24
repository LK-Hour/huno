import { Command } from "commander";
import chalk from "chalk";
import { scanProject } from "../core/scanner.js";
import { writeHunoFile } from "../storage/huno-dir.js";
import { serializeProjectMap } from "../storage/project-map.js";

export const explainCommand = new Command("explain")
  .description("Scan the repository and explain the project.")
  .action(async () => {
    console.log(chalk.cyan("Scanning project..."));

    const result = await scanProject();
    if (!result.ok) {
      console.error(chalk.red(result.error.toString()));
      process.exit(1);
    }

    const map = result.data;

    const saveResult = await writeHunoFile("project-map.json", serializeProjectMap(map));
    if (!saveResult.ok) {
      console.warn(chalk.yellow(`Warning: could not save project map: ${saveResult.error.message}`));
    }

    console.log();
    console.log(chalk.green("Project: ") + chalk.white(map.projectName));
    console.log();

    if (map.stack.languages.length) {
      console.log(chalk.green("Languages:"));
      for (const lang of map.stack.languages) console.log(`  - ${lang}`);
      console.log();
    }

    if (map.stack.frameworks.length) {
      console.log(chalk.green("Frameworks:"));
      for (const fw of map.stack.frameworks) console.log(`  - ${fw}`);
      console.log();
    }

    if (map.stack.database.length) {
      console.log(chalk.green("Database:"));
      for (const db of map.stack.database) console.log(`  - ${db}`);
      console.log();
    }

    if (map.stack.infrastructure.length) {
      console.log(chalk.green("Infrastructure:"));
      for (const infra of map.stack.infrastructure) console.log(`  - ${infra}`);
      console.log();
    }

    if (map.packageManagers.length) {
      console.log(chalk.green("Package managers:"));
      for (const pm of map.packageManagers) console.log(`  - ${pm}`);
      console.log();
    }

    if (Object.keys(map.scripts).length) {
      console.log(chalk.green("Scripts:"));
      for (const [name, cmd] of Object.entries(map.scripts)) {
        console.log(`  - ${name}: ${cmd}`);
      }
      console.log();
    }

    if (Object.keys(map.directories).length) {
      console.log(chalk.green("Directories:"));
      for (const [name, rel] of Object.entries(map.directories)) {
        console.log(`  - ${rel}`);
      }
      console.log();
    }

    if (map.importantFiles.length) {
      console.log(chalk.green("Important files:"));
      for (const file of map.importantFiles) console.log(`  - ${file}`);
      console.log();
    }

    console.log(chalk.gray("Suggested next commands:"));
    console.log('  huno ask "how does this project work?"');
    console.log("  huno audit");
  });