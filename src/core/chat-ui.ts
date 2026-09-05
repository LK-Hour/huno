import type { ContextBuildResult } from "../types/context.js";

export const TOOL_LABELS: Record<string, string> = {
  read_file: "Reading",
  write_file: "Writing",
  patch_file: "Patching",
  list_files: "Listing",
  search_files: "Searching",
  run_command: "Running",
  git_status: "Checking git",
  git_diff: "Diffing",
  git_log: "Reading git log",
  git_branch: "Checking branches",
  get_project_map: "Loading project map",
  get_memory: "Recalling memory",
  save_memory: "Saving memory",
  list_definitions: "Scanning definitions",
  fetch_url: "Fetching",
  find_references: "Finding references",
  analyze_dependencies: "Analyzing deps",
  test_runner: "Running tests",
  code_metrics: "Computing metrics",
  check_env: "Checking env",
  shell_exec: "Executing",
  get_config: "Reading config",
};

/** Formats a single "→ Reading src/index.ts" style line for a tool call. */
export function describeToolCall(toolName: string, argsStr: string): string {
  const label = TOOL_LABELS[toolName] || toolName;
  try {
    const args = JSON.parse(argsStr);
    const detail = args.path || args.command || args.query || args.pattern || "";
    if (detail) return `  → ${label} ${detail}`;
  } catch {}
  return `  → ${label}...`;
}

export function buildFullPrompt(context: ContextBuildResult): string {
  const parts: string[] = [];
  if (context.files.relevantFiles.length > 0) {
    parts.push("## Relevant Files:");
    for (const f of context.files.relevantFiles) {
      parts.push(`\n### ${f.path}\n\`\`\`\n${f.excerpt}\n\`\`\``);
    }
  }
  if (context.files.memory) {
    parts.push(`\n## Project Memory:\n${context.files.memory}`);
  }
  parts.push(`\n## Question:\n${context.question}`);
  return parts.join("\n");
}
