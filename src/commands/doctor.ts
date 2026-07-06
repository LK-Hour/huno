import { Command } from "commander";
import chalk from "chalk";
import { existsSync } from "fs";
import { join } from "path";
import { getActiveProvider } from "../providers/index.js";

const ok = (msg: string) => console.log(chalk.green("  ✓ ") + msg);
const fail = (msg: string) => console.log(chalk.red("  ✗ ") + msg);
const warn = (msg: string) => console.log(chalk.yellow("  ⚠ ") + msg);

export const doctorCommand = new Command("doctor")
  .description("Check environment and configuration for common issues.")
  .action(async () => {
    console.log();
    console.log(chalk.bold.white("  Huno Doctor"));
    console.log(chalk.dim("  ─────────────────────────────────────────"));
    console.log();

    let issues = 0;

    // 1. Node.js version
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1), 10);
    if (major >= 18) {
      ok(`Node.js ${nodeVersion}`);
    } else {
      fail(`Node.js ${nodeVersion} — requires v18 or later`);
      issues++;
    }

    // 2. .env file
    const envPath = join(process.cwd(), ".env");
    if (existsSync(envPath)) {
      ok(".env file present");
    } else {
      warn(".env file not found (optional but recommended)");
    }

    // 3. .huno/ directory
    const hunoDir = join(process.cwd(), ".huno");
    if (existsSync(hunoDir)) {
      ok(".huno/ directory present");
    } else {
      fail(".huno/ directory missing — run `huno init`");
      issues++;
    }

    // 4. API keys check
    const providerEnvKeys = [
      "OPENROUTER_API_KEY",
      "GITHUB_TOKEN",
      "GITHUB_MODELS_TOKEN",
      "GEMINI_API_KEY",
      "GOOGLE_AI_API_KEY",
      "GROQ_API_KEY",
      "CEREBRAS_API_KEY",
      "MISTRAL_API_KEY",
      "SILICONFLOW_API_KEY",
      "COHERE_API_KEY",
      "HF_TOKEN",
      "HUGGINGFACE_API_KEY",
      "CLOUDFLARE_API_TOKEN",
    ];
    const configuredKeys = providerEnvKeys.filter((k) => process.env[k]);
    if (configuredKeys.length > 0) {
      ok(`API keys set: ${configuredKeys.join(", ")}`);
    } else {
      // Check .huno/config.json
      let configHasKey = false;
      try {
        const { readFileSync } = await import("fs");
        const config = JSON.parse(readFileSync(join(process.cwd(), ".huno", "config.json"), "utf-8"));
        configHasKey = config.apiKeys && Object.values(config.apiKeys).some(Boolean);
      } catch {}
      if (configHasKey) {
        ok("API key configured in .huno/config.json");
      } else {
        fail("No API keys configured — run `huno configure`");
        issues++;
      }
    }

    // 5. Provider configured
    const providerResult = await getActiveProvider();
    if (providerResult.ok) {
      ok(`Provider: ${providerResult.data.name} / ${providerResult.data.model}`);
    } else {
      fail(`Provider not configured — run \`huno configure\``);
      issues++;
    }

    // 6. Connectivity test
    if (providerResult.ok) {
      const p = providerResult.data as any;
      if (p.baseURL && typeof p.baseURL === "string" && p.baseURL.startsWith("http")) {
        try {
          const resp = await fetch(`${p.baseURL.replace(/\/$/, "")}/models`, {
            headers: p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {},
            signal: AbortSignal.timeout(5000),
          });
          if (resp.ok || resp.status === 401 || resp.status === 403) {
            // 401/403 = reachable but auth issue is handled elsewhere
            ok("Provider endpoint reachable");
          } else {
            warn(`Provider endpoint returned HTTP ${resp.status}`);
          }
        } catch {
          warn("Provider endpoint unreachable (may be offline or no network)");
        }
      }
    }

    // 7. git
    try {
      const { execSync } = await import("child_process");
      const gitVersion = execSync("git --version", { encoding: "utf-8" }).trim();
      ok(gitVersion);
    } catch {
      warn("git not found (optional — needed for git tools)");
    }

    console.log();
    if (issues === 0) {
      console.log(chalk.green("  ✓ All checks passed!"));
    } else {
      console.log(chalk.red(`  ✗ ${issues} issue(s) found.`));
    }
    console.log();
  });
