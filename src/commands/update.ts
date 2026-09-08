import { Command } from "commander";
import chalk from "chalk";
import { spawn } from "child_process";
import { checkForUpdate, PACKAGE_NAME } from "../utils/version-check.js";
import { VERSION } from "../utils/version.js";
import { brand } from "../ui/theme.js";

function runNpmInstall(): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("npm", ["install", "-g", `${PACKAGE_NAME}@latest`], { stdio: "inherit" });
    child.on("error", () => resolve(1));
    child.on("close", (code) => resolve(code ?? 1));
  });
}

export const updateCommand = new Command("update")
  .description("Check for and install the latest version of Huno.")
  .option("--check", "Only check for updates, don't install")
  .action(async (opts: { check?: boolean }) => {
    console.log();
    console.log(chalk.dim(`  Current version: v${VERSION}`));
    console.log(chalk.dim("  Checking npm for the latest version..."));

    const status = await checkForUpdate(VERSION, { force: true, timeoutMs: 8000 });

    if (!status) {
      console.log();
      console.log(chalk.yellow("  ⚠ Couldn't reach npm to check for updates."));
      console.log(chalk.dim(`  Check your connection, or run: npm install -g ${PACKAGE_NAME}@latest`));
      console.log();
      process.exit(1);
    }

    if (!status.hasUpdate) {
      console.log();
      console.log(chalk.green(`  ✓ You're up to date (v${status.current}).`));
      console.log();
      return;
    }

    console.log();
    console.log(chalk.hex(brand.secondary)(`  ✨ Update available: v${status.current} → v${status.latest}`));

    if (opts.check) {
      console.log(chalk.dim(`  Run \`huno update\` to install it.`));
      console.log();
      return;
    }

    console.log(chalk.dim(`  Installing ${PACKAGE_NAME}@${status.latest} globally...`));
    console.log();
    const code = await runNpmInstall();
    console.log();
    if (code === 0) {
      console.log(chalk.green(`  ✓ Updated to v${status.latest}. Restart huno to use the new version.`));
    } else {
      console.log(chalk.red("  ✗ Update failed."));
      console.log(chalk.dim(`  Try running it manually: npm install -g ${PACKAGE_NAME}@latest`));
      console.log(chalk.dim("  (If you installed with sudo/a different package manager, use that instead.)"));
      console.log();
      process.exit(1);
    }
    console.log();
  });
