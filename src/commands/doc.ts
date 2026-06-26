import { Command } from "commander";
import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import { scanProject } from "../core/scanner.js";
import { readMemoryFile, parseMemoryEntries } from "../storage/memory-file.js";
import { getProjectRoot } from "../utils/paths.js";
import { HunoError } from "../utils/errors.js";

export const docCommand = new Command("doc")
  .description("Generate project documentation based on codebase analysis.")
  .option("-o, --output <path>", "Write output to file instead of stdout")
  .option("--no-memory", "Exclude project memory from docs")
  .action(async (options: { output?: string; memory?: boolean }) => {
    const root = getProjectRoot();

    // 1. Scan the project
    const scanResult = await scanProject();
    if (!scanResult.ok) {
      throw new HunoError(
        "Project scan failed. Run `huno init` first.",
        "DOC_SCAN_FAILED",
        scanResult.error?.hint
      );
    }

    const map = scanResult.data;

    // 2. Read memory (optional)
    let memoryEntries: Array<{ text: string; date?: string }> = [];
    if (options.memory !== false) {
      const memoryResult = await readMemoryFile();
      if (memoryResult.ok) {
        memoryEntries = parseMemoryEntries(memoryResult.data);
      }
    }

    // 3. Read package.json for description
    let description = "";
    try {
      const pkgRaw = await fs.readFile(path.join(root, "package.json"), "utf-8");
      const pkg = JSON.parse(pkgRaw);
      description = pkg.description || "";
    } catch {
      // ignore
    }

    // 4. Generate markdown
    const doc = generateDoc(map, description, memoryEntries);

    // 5. Output
    if (options.output) {
      const outputPath = path.isAbsolute(options.output)
        ? options.output
        : path.join(root, options.output);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, doc, "utf-8");
      console.log(chalk.green(`  ✓ Documentation written to ${path.relative(root, outputPath)}`));
    } else {
      console.log(doc);
    }
  });

function generateDoc(
  map: {
    projectName: string;
    stack: { languages: string[]; frameworks: string[]; database: string[]; infrastructure: string[] };
    packageManagers: string[];
    importantFiles: string[];
    directories: Record<string, string>;
    scripts: Record<string, string>;
    tests: { directories: string[]; files: string[]; scripts: string[]; frameworks: string[] };
    warnings: Array<{ message: string; suggestion?: string }>;
  },
  description: string,
  memoryEntries: Array<{ text: string; date?: string }>
): string {
  const lines: string[] = [];

  // Title
  const title = map.projectName !== "unknown" ? map.projectName : path.basename(getProjectRoot());
  lines.push(`# ${title}`);
  lines.push("");

  if (description) {
    lines.push(`> ${description}`);
    lines.push("");
  }

  // Overview
  lines.push("## Overview");
  lines.push("");

  const stackItems: string[] = [];
  if (map.stack.languages.length > 0) stackItems.push(`**Languages:** ${map.stack.languages.join(", ")}`);
  if (map.stack.frameworks.length > 0) stackItems.push(`**Frameworks:** ${map.stack.frameworks.join(", ")}`);
  if (map.stack.database.length > 0) stackItems.push(`**Database:** ${map.stack.database.join(", ")}`);
  if (map.stack.infrastructure.length > 0) stackItems.push(`**Infrastructure:** ${map.stack.infrastructure.join(", ")}`);
  if (map.packageManagers.length > 0) stackItems.push(`**Package Manager:** ${map.packageManagers.join(", ")}`);

  if (stackItems.length > 0) {
    lines.push(stackItems.join("  "));
    lines.push("");
  }

  // Directory structure
  const dirs = Object.keys(map.directories).filter(
    (d) => !d.startsWith(".") && d !== "node_modules"
  );
  if (dirs.length > 0) {
    lines.push("## Project Structure");
    lines.push("");
    lines.push("```");
    dirs.forEach((dir) => {
      lines.push(`├── ${dir}`);
    });
    map.importantFiles.forEach((file) => {
      lines.push(`├── ${file}`);
    });
    lines.push("```");
    lines.push("");
  }

  // Scripts
  const scriptKeys = Object.keys(map.scripts);
  if (scriptKeys.length > 0) {
    lines.push("## Scripts");
    lines.push("");
    lines.push("| Script | Command |");
    lines.push("|--------|---------|");
    scriptKeys.forEach((name) => {
      lines.push(`| \`${name}\` | \`${map.scripts[name]}\` |`);
    });
    lines.push("");
  }

  // Testing
  if (map.tests.frameworks.length > 0 || map.tests.scripts.length > 0) {
    lines.push("## Testing");
    lines.push("");
    if (map.tests.frameworks.length > 0) {
      lines.push(`**Framework:** ${map.tests.frameworks.join(", ")}`);
    }
    if (map.tests.scripts.length > 0) {
      lines.push(`**Scripts:** ${map.tests.scripts.map((s) => `\`${s}\``).join(", ")}`);
    }
    if (map.tests.directories.length > 0) {
      lines.push(`**Directories:** ${map.tests.directories.join(", ")}`);
    }
    lines.push("");
  }

  // Memory / Project knowledge
  if (memoryEntries.length > 0) {
    lines.push("## Project Notes");
    lines.push("");
    memoryEntries.forEach((entry) => {
      const date = entry.date ? ` (${entry.date})` : "";
      lines.push(`- ${entry.text}${date}`);
    });
    lines.push("");
  }

  // Warnings / recommendations
  if (map.warnings.length > 0) {
    lines.push("## Recommendations");
    lines.push("");
    map.warnings.forEach((w) => {
      lines.push(`- ⚠ ${w.message}${w.suggestion ? ` — ${w.suggestion}` : ""}`);
    });
    lines.push("");
  }

  // Footer
  lines.push("---");
  lines.push("");
  lines.push(`*Generated by [Huno](https://github.com/LK-Hour/huno) on ${new Date().toISOString().split("T")[0]}*`);

  return lines.join("\n");
}
