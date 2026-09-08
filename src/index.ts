#!/usr/bin/env node

//  █████   █████ █████  █████ ██████   █████    ███████   
// ░░███   ░░███ ░░███  ░░███ ░░██████ ░░███   ███░░░░░███ 
//  ░███    ░███  ░███   ░███  ░███░███ ░███  ███     ░░███
//  ░███████████  ░███   ░███  ░███░░███░███ ░███      ░███
//  ░███░░░░░███  ░███   ░███  ░███ ░░██████ ░███      ░███
//  ░███    ░███  ░███   ░███  ░███  ░░█████ ░░███     ███ 
//  █████   █████ ░░████████   █████  ░░█████ ░░░███████░  
// ░░░░░   ░░░░░   ░░░░░░░░   ░░░░░    ░░░░░    ░░░░░░░    


import "dotenv/config";
import { Command } from "commander";
import chalk from "chalk";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Read version from package.json so it stays in sync automatically
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));
const VERSION = pkg.version;

import { initCommand } from "./commands/init.js";
import { explainCommand } from "./commands/explain.js";
import { rememberCommand } from "./commands/remember.js";
import { recallCommand } from "./commands/recall.js";
import { docCommand } from "./commands/doc.js";
import { askCommand } from "./commands/ask.js";
import { auditCommand } from "./commands/audit.js";
import { lintCommand } from "./commands/lint.js";
import { providersCommand } from "./commands/providers.js";
import { modelCommand } from "./commands/model.js";
import { doctorCommand } from "./commands/doctor.js";
import { configureCommand } from "./commands/configure.js";
import { updateCommand } from "./commands/update.js";
import { configCommand } from "./commands/config.js";
import { createCompletionCommand } from "./commands/completion.js";
import { runRepl } from "./repl.js";

const program = new Command();

program
  .name("huno")
  .description("AI-powered project-aware developer assistant.")
  .version(VERSION);

program.addCommand(initCommand);
program.addCommand(explainCommand);
program.addCommand(rememberCommand);
program.addCommand(recallCommand);
program.addCommand(docCommand);
program.addCommand(auditCommand);
program.addCommand(lintCommand);
program.addCommand(askCommand);
program.addCommand(providersCommand);
program.addCommand(modelCommand);
program.addCommand(doctorCommand);
program.addCommand(configureCommand);
program.addCommand(updateCommand);
program.addCommand(configCommand);
program.addCommand(createCompletionCommand(program));

// If no arguments given, launch interactive REPL
if (process.argv.length <= 2) {
  runRepl().catch((err: unknown) => {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : err}`));
    process.exit(1);
  });
} else {
  program.parseAsync(process.argv).catch((err: unknown) => {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : err}`));
    process.exit(1);
  });
}
