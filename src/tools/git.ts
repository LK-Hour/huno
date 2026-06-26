import { execSync } from "child_process";
import { getProjectRoot } from "../utils/paths.js";
import type { ToolDefinition } from "../providers/chat.js";

function runGit(args: string[]): string {
  try {
    const output = execSync(`git ${args.join(" ")}`, {
      cwd: getProjectRoot(),
      encoding: "utf-8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output || "(no output)";
  } catch (err: any) {
    if (err.status) return "Exit code " + err.status + ": " + (err.stderr || err.message);
    return "Error: " + err.message;
  }
}

export function gitTools(): ToolDefinition[] {
  return [
    {
      name: "git_status",
      description: "Show the current git status including staged, unstaged, and untracked files. Useful for understanding project state before making changes.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      handler: async () => {
        const status = runGit(["status"]);
        const short = runGit(["status", "--porcelain"]);
        const lines = short.split("\n").filter(Boolean);
        return `## Git Status\n\n${status}\n\nSummary: ${lines.length} change${lines.length !== 1 ? "s" : ""}`;
      },
    },
    {
      name: "git_diff",
      description: "Show the diff of unstaged changes. Optionally show staged changes with --staged, or diff between two refs with --from and --to.",
      parameters: {
        type: "object",
        properties: {
          staged: { type: "boolean", description: "Show staged diff instead of unstaged" },
          from: { type: "string", description: "Starting ref (commit, branch, or tag)" },
          to: { type: "string", description: "Ending ref (defaults to HEAD if from is set)" },
          path: { type: "string", description: "Limit diff to a specific file or directory path" },
        },
        required: [],
      },
      handler: async (args) => {
        const staged = args.staged ? "--staged" : "";
        const from = args.from as string | undefined;
        const to = args.to as string | undefined;
        const path = args.path as string | undefined;

        let cmdArgs: string[];
        if (from && to) {
          cmdArgs = ["diff", from, to];
        } else if (from) {
          cmdArgs = ["diff", from, "HEAD"];
        } else {
          cmdArgs = ["diff"];
          if (staged) cmdArgs.push("--staged");
        }

        if (path) cmdArgs.push("--", path);

        // Use --stat first for summary, then full diff
        const stat = runGit([...cmdArgs, "--stat"]);
        const diff = runGit(cmdArgs);

        // Truncate if too long
        const maxLen = 5000;
        const truncated = diff.length > maxLen ? diff.slice(0, maxLen) + `\n... (${diff.length - maxLen} more characters)` : diff;

        return `## Git Diff\n\nFiles changed:\n${stat}\n\nFull diff:\n${truncated}`;
      },
    },
    {
      name: "git_log",
      description: "Show recent commit history. Supports limiting count and filtering by path.",
      parameters: {
        type: "object",
        properties: {
          count: { type: "number", description: "Number of recent commits to show (default: 10)" },
          path: { type: "string", description: "Show only commits affecting this file or directory" },
          author: { type: "string", description: "Filter by author" },
        },
        required: [],
      },
      handler: async (args) => {
        const count = (args.count as number) || 10;
        const path = args.path as string | undefined;
        const author = args.author as string | undefined;

        let cmdArgs = ["log", `--max-count=${count}`, "--format=format:%h %ai %an%n  %s", "--no-pager"];
        if (author) cmdArgs.push(`--author=${author}`);
        if (path) cmdArgs.push("--", path);

        const log = runGit(cmdArgs);
        return `## Recent Commits (last ${count})\n\n${log}`;
      },
    },
    {
      name: "git_branch",
      description: "Show the current git branch and list all local branches.",
      parameters: {
        type: "object",
        properties: {
          all: { type: "boolean", description: "Include remote branches" },
        },
        required: [],
      },
      handler: async (args) => {
        const all = args.all ? "-a" : "";
        const current = runGit(["branch", "--show-current"]);
        const branches = runGit(["branch", all].filter(Boolean));
        return `## Current Branch: ${current.trim()}\n\n## All Branches\n\n${branches}`;
      },
    },
  ];
}