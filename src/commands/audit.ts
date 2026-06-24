import { Command } from "commander";
import chalk from "chalk";
import fs from "fs/promises";
import path from "path";
import { scanProject } from "../core/scanner.js";
import { type Result } from "../utils/errors.js";
import { type AuditIssue, type AuditReport, type AuditSeverity } from "../types/audit.js";

const LARGE_FILE_THRESHOLD = 500 * 1024; // 500KB
const SECRET_PATTERNS = [
  /password\s*[:=]\s*['"][^'"]+['"]/i,
  /secret\s*[:=]\s*['"][^'"]+['"]/i,
  /api_key\s*[:=]\s*['"][^'"]+['"]/i,
  /apikey\s*[:=]\s*['"][^'"]+['"]/i,
  /token\s*[:=]\s*['"][^'"]+['"]/i,
  /aws_access_key_id\s*[:=]\s*['"]?[A-Z0-9]{20}/i,
  /private_key\s*[:=]/i,
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
];

const IGNORED_DIRS_FOR_SCAN = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".turbo",
  "vendor",
  "__pycache__",
]);

const CONFIG_FILES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  "config.json",
  "config.yaml",
  "config.yml",
  ".config",
]);

function isConfigFile(filePath: string): boolean {
  const base = path.basename(filePath);
  if (CONFIG_FILES.has(base)) return true;
  if (base.startsWith(".env")) return true;
  if (base.includes("config")) return true;
  return false;
}

async function walkDir(
  dir: string,
  files: string[],
  depth = 0
): Promise<void> {
  if (depth > 3) return; // Limit depth for performance
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRS_FOR_SCAN.has(entry.name)) continue;
        if (entry.name.startsWith(".") && entry.name !== ".") continue;
        await walkDir(path.join(dir, entry.name), files, depth + 1);
      } else if (entry.isFile()) {
        files.push(path.join(dir, entry.name));
      }
    }
  } catch {
    // ignore permission errors
  }
}

async function findFilesByExtension(
  root: string,
  exts: string[]
): Promise<string[]> {
  const matches: string[] = [];
  const allFiles: string[] = [];
  await walkDir(root, allFiles);
  for (const f of allFiles) {
    const ext = path.extname(f).toLowerCase();
    if (exts.includes(ext)) matches.push(f);
  }
  return matches;
}

function hasTestFramework(pkg: any): boolean {
  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };
  const testFrameworks = [
    "jest",
    "vitest",
    "mocha",
    "ava",
    "tape",
    "jasmine",
    "cypress",
    "playwright",
    "@testing-library",
    "pytest",
    "unittest",
  ];
  return testFrameworks.some((fw) => fw in allDeps);
}

function hasTestDir(dirs: Record<string, string>): boolean {
  return Object.keys(dirs).some(
    (d) =>
      d === "tests" ||
      d === "__tests__" ||
      d === "test" ||
      d === "spec" ||
      d === "__spec__"
  );
}

function checkOutdatedDependencies(pkg: any): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };

  // Simple heuristic: flag packages with very old major versions
  const knownOutdated: Record<string, number> = {
    express: 4,
    react: 18,
    vue: 3,
    next: 14,
    typescript: 5,
    eslint: 8,
    prettier: 3,
    vite: 5,
    webpack: 5,
    "@types/node": 20,
  };

  for (const [name, version] of Object.entries(allDeps)) {
    const cleanVersion = String(version).replace(/[\^~>=<]/g, "");
    const major = parseInt(cleanVersion.split(".")[0], 10);
    if (isNaN(major)) continue;

    const minMajor = knownOutdated[name];
    if (minMajor !== undefined && major < minMajor) {
      issues.push({
        id: `outdated-${name}`,
        severity: "medium",
        category: "Dependencies",
        message: `${name}@${version} is outdated (major version ${major}, expected >=${minMajor})`,
        suggestion: `Consider upgrading ${name} to a recent version.`,
      });
    }
  }

  return issues;
}

async function scanForSecrets(
  root: string,
  allFiles: string[]
): Promise<AuditIssue[]> {
  const issues: AuditIssue[] = [];
  const textExtensions = [
    ".js",
    ".ts",
    ".jsx",
    ".tsx",
    ".py",
    ".rb",
    ".go",
    ".java",
    ".php",
    ".rs",
    ".sh",
    ".yaml",
    ".yml",
    ".json",
    ".toml",
    ".ini",
    ".cfg",
    ".conf",
  ];

  for (const filePath of allFiles) {
    if (isConfigFile(filePath)) continue;
    const ext = path.extname(filePath).toLowerCase();
    if (!textExtensions.includes(ext)) continue;

    try {
      const stat = await fs.stat(filePath);
      if (stat.size > LARGE_FILE_THRESHOLD) continue; // Skip large files

      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of SECRET_PATTERNS) {
          if (pattern.test(line)) {
            const relPath = path.relative(root, filePath);
            issues.push({
              id: `secret-${relPath}-${i + 1}`,
              severity: "high",
              category: "Security",
              message: `Potential secret/credential detected: ${line.trim().slice(0, 80)}`,
              file: relPath,
              line: i + 1,
              suggestion:
                "Move secrets to environment variables and add .env to .gitignore.",
            });
            break; // One match per line is enough
          }
        }
      }
    } catch {
      // skip unreadable files
    }
  }

  return issues;
}

async function scanCodeQuality(
  root: string,
  allFiles: string[]
): Promise<AuditIssue[]> {
  const issues: AuditIssue[] = [];
  const codeExtensions = [".js", ".ts", ".jsx", ".tsx", ".py", ".rb", ".go", ".java", ".rs"];

  for (const filePath of allFiles) {
    const ext = path.extname(filePath).toLowerCase();
    if (!codeExtensions.includes(ext)) continue;
    if (isConfigFile(filePath)) continue;

    try {
      const stat = await fs.stat(filePath);
      if (stat.size > LARGE_FILE_THRESHOLD) continue;

      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n");
      const relPath = path.relative(root, filePath);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Check for console.log
        if (/console\.(log|warn|error|info|debug)\s*\(/.test(line)) {
          // Skip if in a logger utility
          if (relPath.includes("logger") || relPath.includes("log")) continue;
          issues.push({
            id: `console-${relPath}-${i + 1}`,
            severity: "low",
            category: "Code Quality",
            message: `console.log statement found`,
            file: relPath,
            line: i + 1,
            suggestion: "Remove console statements or use a proper logging library.",
          });
        }

        // Check for TODO/FIXME
        if (/\/\/\s*(TODO|FIXME|HACK|XXX)/.test(line)) {
          issues.push({
            id: `todo-${relPath}-${i + 1}`,
            severity: "low",
            category: "Code Quality",
            message: `TODO/FIXME comment found`,
            file: relPath,
            line: i + 1,
            suggestion: "Track TODOs in your issue tracker and resolve before merging.",
          });
        }
      }
    } catch {
      // skip unreadable files
    }
  }

  return issues;
}

async function checkLargeFiles(
  root: string,
  allFiles: string[]
): Promise<AuditIssue[]> {
  const issues: AuditIssue[] = [];

  for (const filePath of allFiles) {
    try {
      const stat = await fs.stat(filePath);
      if (stat.size > LARGE_FILE_THRESHOLD) {
        const relPath = path.relative(root, filePath);
        const sizeKB = Math.round(stat.size / 1024);
        issues.push({
          id: `large-${relPath}`,
          severity: "medium",
          category: "Repository Health",
          message: `Large file detected: ${relPath} (${sizeKB}KB)`,
          file: relPath,
          suggestion:
            "Consider if this file should be tracked in git. Use Git LFS or add to .gitignore.",
        });
      }
    } catch {
      // skip
    }
  }

  return issues;
}

function severityColor(severity: AuditSeverity): (text: string) => string {
  switch (severity) {
    case "high":
      return chalk.red;
    case "medium":
      return chalk.yellow;
    case "low":
      return chalk.gray;
  }
}

function severityIcon(severity: AuditSeverity): string {
  switch (severity) {
    case "high":
      return "✗";
    case "medium":
      return "⚠";
    case "low":
      return "ℹ";
  }
}

function formatTextReport(report: AuditReport): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(chalk.bold.cyan("═".repeat(60)));
  lines.push(chalk.bold.cyan("  HUNO AUDIT REPORT"));
  lines.push(chalk.bold.cyan("═".repeat(60)));
  lines.push("");

  lines.push(chalk.white(`Project: ${report.projectName}`));
  lines.push(chalk.white(`Root: ${report.root}`));
  lines.push(chalk.white(`Generated: ${report.generatedAt}`));
  lines.push("");

  // Summary
  lines.push(chalk.bold("Summary:"));
  const { summary } = report;
  lines.push(
    `  ${chalk.red(`High: ${summary.high}`)}  ${chalk.yellow(`Medium: ${summary.medium}`)}  ${chalk.gray(`Low: ${summary.low}`)}  Total: ${summary.total}`
  );
  lines.push("");

  if (report.issues.length === 0) {
    lines.push(chalk.green("✓ No issues found! Your project looks great."));
    lines.push("");
    return lines.join("\n");
  }

  // Group by severity
  const highIssues = report.issues.filter((i) => i.severity === "high");
  const mediumIssues = report.issues.filter((i) => i.severity === "medium");
  const lowIssues = report.issues.filter((i) => i.severity === "low");

  const printGroup = (title: string, issues: AuditIssue[]) => {
    if (issues.length === 0) return;
    lines.push(chalk.bold(`── ${title} (${issues.length}) ──`));
    lines.push("");
    for (const issue of issues) {
      const color = severityColor(issue.severity);
      const icon = severityIcon(issue.severity);
      lines.push(color(`  ${icon} [${issue.category}] ${issue.message}`));
      if (issue.file) {
        lines.push(chalk.gray(`    at ${issue.file}${issue.line ? `:${issue.line}` : ""}`));
      }
      if (issue.suggestion) {
        lines.push(chalk.gray(`    → ${issue.suggestion}`));
      }
      lines.push("");
    }
  };

  printGroup("High Priority", highIssues);
  printGroup("Medium Priority", mediumIssues);
  printGroup("Low Priority", lowIssues);

  lines.push(chalk.bold.cyan("─".repeat(60)));

  if (highIssues.length > 0) {
    lines.push(chalk.red(`\n${highIssues.length} high-priority issue(s) require immediate attention.`));
  }
  if (mediumIssues.length > 0) {
    lines.push(chalk.yellow(`${mediumIssues.length} medium-priority issue(s) should be addressed soon.`));
  }

  lines.push("");
  return lines.join("\n");
}

export const auditCommand = new Command("audit")
  .description("Run static analysis on the project and report issues.")
  .option("--json", "Output results as JSON")
  .action(async (options: { json?: boolean }) => {
    console.log(chalk.cyan("Running audit..."));

    const scanResult = await scanProject();
    if (!scanResult.ok) {
      console.error(chalk.red((scanResult as any).error.toString()));
      process.exit(1);
    }

    const map = scanResult.data;
    const root = map.root;
    const issues: AuditIssue[] = [];

    // 1. Check for .env without .env.example
    const allRootFiles = await fs.readdir(root);
    const hasEnv = allRootFiles.some((f) => f.startsWith(".env"));
    const hasEnvExample = allRootFiles.includes(".env.example");
    if (hasEnv && !hasEnvExample) {
      issues.push({
        id: "missing-env-example",
        severity: "medium",
        category: "Configuration",
        message: ".env file exists but no .env.example found",
        suggestion:
          "Create a .env.example with placeholder values to document required environment variables.",
      });
    }

    // 2. Check for README.md
    const hasReadme = allRootFiles.some(
      (f) => f.toUpperCase() === "README.MD" || f.toUpperCase() === "README"
    );
    if (!hasReadme) {
      issues.push({
        id: "missing-readme",
        severity: "medium",
        category: "Documentation",
        message: "No README.md found",
        suggestion: "Add a README.md describing your project, how to install, and how to run it.",
      });
    }

    // 3. Check for LICENSE
    const hasLicense = allRootFiles.some(
      (f) =>
        f.toUpperCase().startsWith("LICENSE") ||
        f.toUpperCase() === "COPYING"
    );
    if (!hasLicense) {
      issues.push({
        id: "missing-license",
        severity: "low",
        category: "Legal",
        message: "No LICENSE file found",
        suggestion:
          "Add a LICENSE file to specify how others can use this project.",
      });
    }

    // 4. Check for .gitignore
    const hasGitignore = allRootFiles.includes(".gitignore");
    if (!hasGitignore) {
      issues.push({
        id: "missing-gitignore",
        severity: "medium",
        category: "Repository Health",
        message: "No .gitignore file found",
        suggestion:
          "Create a .gitignore to exclude node_modules, dist, .env, etc.",
      });
    }

    // 5. Check for .hunoignore
    const hasHunoignore = allRootFiles.includes(".hunoignore");
    if (!hasHunoignore) {
      issues.push({
        id: "missing-hunoignore",
        severity: "low",
        category: "Configuration",
        message: "No .hunoignore file found",
        suggestion:
          "Create a .hunoignore to exclude files from Huno's project scanning.",
      });
    }

    // 6. Check for test setup
    const testDirPresent = hasTestDir(map.directories);
    let hasTests = testDirPresent;

    // Also check for test files in src
    if (!hasTests) {
      const testFiles = await findFilesByExtension(root, [".test.ts", ".test.js", ".spec.ts", ".spec.js", ".test.py", ".spec.py"]);
      hasTests = testFiles.length > 0;
    }

    // Check package.json for test framework
    const pkgPath = path.join(root, "package.json");
    let pkg: any = null;
    try {
      const raw = await fs.readFile(pkgPath, "utf-8");
      pkg = JSON.parse(raw);
    } catch {
      // ignore
    }

    if (!hasTests && pkg && !hasTestFramework(pkg)) {
      issues.push({
        id: "missing-tests",
        severity: "medium",
        category: "Testing",
        message: "No test framework or test files detected",
        suggestion:
          "Add a test framework (e.g., vitest, jest, pytest) and write tests for your code.",
      });
    }

    // 7. Check for outdated dependencies
    if (pkg) {
      issues.push(...checkOutdatedDependencies(pkg));
    }

    // 8. Scan all files for large files, secrets, code quality
    const allFiles: string[] = [];
    await walkDir(root, allFiles);

    const largeFileIssues = await checkLargeFiles(root, allFiles);
    issues.push(...largeFileIssues);

    const secretIssues = await scanForSecrets(root, allFiles);
    issues.push(...secretIssues);

    const qualityIssues = await scanCodeQuality(root, allFiles);
    issues.push(...qualityIssues);

    // Build report
    const report: AuditReport = {
      generatedAt: new Date().toISOString(),
      projectName: map.projectName,
      root,
      summary: {
        total: issues.length,
        high: issues.filter((i) => i.severity === "high").length,
        medium: issues.filter((i) => i.severity === "medium").length,
        low: issues.filter((i) => i.severity === "low").length,
      },
      issues,
    };

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatTextReport(report));
    }

    // Exit with error code if high-priority issues found
    if (report.summary.high > 0) {
      process.exit(1);
    }
  });
