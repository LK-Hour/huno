import { createInterface } from "readline";
import chalk from "chalk";

export type RiskLevel = "low" | "medium" | "high";

export type RiskAssessment = {
  risk: RiskLevel;
  description: string;
};

export function classifyRisk(toolName: string, args: Record<string, unknown>): RiskAssessment {
  if (toolName === "write_file") {
    return { risk: "medium", description: "Write to " + (args.path as string) };
  }
  if (toolName === "patch_file") {
    return { risk: "medium", description: "Patch " + (args.path as string) };
  }
  if (toolName === "test_runner") {
    const filter = args.filter as string | undefined;
    return { risk: "low", description: "Run test suite" + (filter ? ` (filter: ${filter})` : "") };
  }
  if (toolName === "run_command" || toolName === "shell_exec") {
    const command = (args.command as string) || "";
    const description = "Run: " + command;
    const cmd = command.toLowerCase();
    if (cmd.includes("rm ") || cmd.includes("delete") || cmd.includes("drop") || cmd.includes("docker compose down")) {
      return { risk: "high", description };
    }
    if (cmd.includes("install") || cmd.includes("push") || cmd.includes("deploy")) {
      return { risk: "medium", description };
    }
    return { risk: "low", description };
  }
  return { risk: "low", description: toolName };
}

export function promptApproval(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(message + " ", (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes");
    });
  });
}

/**
 * Classifies, displays, and prompts for approval of a tool call in one step.
 * Shared by every entry point that drives a tool-using conversation (ask, repl)
 * so the approval UX and risk logic can't drift between them.
 */
export async function requestApproval(
  toolName: string,
  args: Record<string, unknown>
): Promise<boolean> {
  const { risk, description } = classifyRisk(toolName, args);

  console.log();
  if (risk === "high") {
    console.log(chalk.red(`  ⚠ HIGH RISK: ${description}`));
    console.log(chalk.dim("  This may cause irreversible changes."));
  } else if (risk === "medium") {
    console.log(chalk.yellow(`  ⚠ ${description}? [risk: ${risk}]`));
  } else {
    console.log(chalk.cyan(`  → ${description} [risk: ${risk}]`));
  }

  return promptApproval(risk === "high" ? "  Allow? [y/N]" : "  Allow? [Y/n]");
}
