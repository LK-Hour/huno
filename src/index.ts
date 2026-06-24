#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";

import { initCommand } from "./commands/init.js";
import { explainCommand } from "./commands/explain.js";
import { rememberCommand } from "./commands/remember.js";
import { recallCommand } from "./commands/recall.js";
import { askCommand } from "./commands/ask.js";
import { auditCommand } from "./commands/audit.js";
import { runRepl } from "./repl.js";

const program = new Command();

program
  .name("huno")
  .description("AI-powered project-aware developer assistant.")
  .version("0.1.0");

program.addCommand(initCommand);
program.addCommand(explainCommand);
program.addCommand(rememberCommand);
program.addCommand(recallCommand);
program.addCommand(auditCommand);
program.addCommand(askCommand);

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