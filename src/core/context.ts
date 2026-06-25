import fs from "fs/promises";
import path from "path";
import { getProjectRoot } from "../utils/paths.js";
import { readHunoFile } from "../storage/huno-dir.js";
import { readMemoryFile, parseMemoryEntries, searchMemory } from "../storage/memory-file.js";
import { parseProjectMap, type ProjectMap } from "../storage/project-map.js";
import { HunoError, Result } from "../utils/errors.js";
import { readHunoIgnore, isIgnored } from "../utils/ignore.js";
import type { ContextBuildResult } from "../types/context.js";

const MAX_FILE_SIZE = 3000; // characters per file excerpt
const MAX_FILES = 5;
const MAX_CONTENT_SEARCH_FILES = 3;
const DEFAULT_IGNORE_PATTERNS = [
  ".git",
  ".huno",
  "node_modules",
  "dist",
  "build",
  ".next",
  "coverage",
  ".turbo",
  ".cache",
  "venv",
  ".venv",
  "__pycache__",
];
const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java",
  ".rb", ".php", ".cs", ".c", ".cpp", ".h", ".hpp", ".swift",
  ".kt", ".scala", ".sh", ".sql", ".css", ".scss", ".html",
  ".vue", ".svelte",
]);

/**
 * Extract keywords from a question — individual words longer than 2 chars.
 */
function extractKeywords(question: string): string[] {
  return question
    .toLowerCase()
    .split(/[\s,;.!?()[\]{}'"<>/\\|@#$%^&*~`+=-]+/)
    .filter((w) => w.length > 2);
}

/**
 * Simple keyword matching to find relevant files from the project map.
 */
function findRelevantFiles(
  question: string,
  projectMap: ProjectMap | null
): string[] {
  if (!projectMap) return [];

  const q = question.toLowerCase();
  const candidates: string[] = [];

  // Check important files
  for (const f of projectMap.importantFiles) {
    const name = path.basename(f).toLowerCase();
    const dir = path.dirname(f).toLowerCase();
    if (
      q.includes(name) ||
      q.includes(f.toLowerCase()) ||
      q.includes(dir)
    ) {
      candidates.push(f);
    }
  }

  // Check directories
  for (const dir of Object.keys(projectMap.directories)) {
    if (q.includes(dir.toLowerCase())) {
      candidates.push(dir);
    }
  }

  // Check scripts
  for (const script of Object.keys(projectMap.scripts)) {
    if (q.includes(script.toLowerCase())) {
      candidates.push(`npm run ${script}`);
    }
  }

  return candidates.slice(0, MAX_FILES);
}

/**
 * Find files by content search — scan source files for question keywords.
 * Returns up to maxFiles extra file paths that matched content but not path.
 */
async function findFilesByContent(
  root: string,
  keywords: string[],
  alreadyFound: Set<string>,
  ignorePatterns: string[]
): Promise<string[]> {
  if (keywords.length === 0) return [];

  const results: { filePath: string; matchCount: number }[] = [];
  const visited = new Set<string>();

  async function scanDir(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(root, fullPath);

      // Skip ignored paths
      if (isIgnored(relPath, ignorePatterns)) continue;
      // Skip node_modules, .git, common non-source dirs
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".huno") continue;

      if (entry.isDirectory()) {
        // Limit depth to avoid scanning huge trees
        if (visited.size < 200) {
          visited.add(fullPath);
          await scanDir(fullPath);
        }
        continue;
      }

      // Only scan code files
      if (!CODE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      // Skip if already found by path matching
      if (alreadyFound.has(relPath)) continue;
      // Skip large files (> 100KB)
      try {
        const stat = await fs.stat(fullPath);
        if (stat.size > 100_000) continue;
      } catch {
        continue;
      }

      try {
        const content = await fs.readFile(fullPath, "utf-8");
        const contentLower = content.toLowerCase();
        let matchCount = 0;
        for (const kw of keywords) {
          if (contentLower.includes(kw)) {
            matchCount++;
          }
        }
        if (matchCount > 0) {
          results.push({ filePath: relPath, matchCount });
        }
      } catch {
        // skip unreadable files
      }
    }
  }

  await scanDir(root);

  // Sort by match count descending, take top N
  results.sort((a, b) => b.matchCount - a.matchCount);
  return results.slice(0, MAX_CONTENT_SEARCH_FILES).map((r) => r.filePath);
}

/**
 * Try to find a relevant section of a code file based on keywords.
 * Returns the section around the first keyword match, or null if no match.
 */
function findRelevantSection(content: string, keywords: string[]): string | null {
  const lines = content.split("\n");
  if (lines.length <= 100) return null; // file is small enough already

  const lowerLines = lines.map((l) => l.toLowerCase());

  // Find the first line that matches any keyword
  for (let i = 0; i < lowerLines.length; i++) {
    for (const kw of keywords) {
      if (lowerLines[i].includes(kw)) {
        // Include context: 10 lines before and 30 lines after
        const start = Math.max(0, i - 10);
        const end = Math.min(lines.length, i + 30);
        const section = lines.slice(start, end).join("\n");
        const prefix = start > 0 ? `... (lines 1-${start} omitted)\n` : "";
        const suffix = end < lines.length ? `\n... (lines ${end + 1}-${lines.length} omitted)` : "";
        return `${prefix}[lines ${start + 1}-${end}]:\n${section}${suffix}`;
      }
    }
  }

  return null;
}

async function readFileExcerpt(filePath: string, keywords: string[]): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");

    // For files with more than 100 lines, try to find relevant section
    if (lines.length > 100 && keywords.length > 0) {
      const section = findRelevantSection(content, keywords);
      if (section) {
        if (section.length > MAX_FILE_SIZE) {
          return section.slice(0, MAX_FILE_SIZE) + "\n... (truncated)";
        }
        return section;
      }
    }

    // Default: read first 100 lines (or up to MAX_FILE_SIZE chars)
    const first100 = lines.slice(0, 100).join("\n");
    if (first100.length > MAX_FILE_SIZE) {
      return first100.slice(0, MAX_FILE_SIZE) + "\n... (truncated)";
    }

    // If total content fits within MAX_FILE_SIZE, return it all
    if (content.length <= MAX_FILE_SIZE) {
      return content;
    }

    // Otherwise return first 100 lines + note about truncation
    if (lines.length > 100) {
      return first100 + `\n... (${lines.length - 100} more lines)`;
    }
    return content;
  } catch {
    return null;
  }
}

export async function buildContext(
  question: string
): Promise<Result<ContextBuildResult>> {
  const root = getProjectRoot();
  const relevantFiles: { path: string; excerpt: string }[] = [];
  const keywords = extractKeywords(question);

  // 0. Read .hunoignore patterns
  const ignorePatterns = [...DEFAULT_IGNORE_PATTERNS, ...(await readHunoIgnore())];

  // 1. Read project-map.json
  let projectMapStr: string | null = null;
  let projectMap: ProjectMap | null = null;
  const mapResult = await readHunoFile("project-map.json");
  if (mapResult.ok) {
    projectMapStr = mapResult.data;
    const parseResult = parseProjectMap(mapResult.data);
    if (parseResult.ok) {
      projectMap = parseResult.data;
    }
  }

  // 2. Read memory.md
  let memoryStr: string | null = null;
  const memoryResult = await readMemoryFile();
  if (memoryResult.ok) {
    memoryStr = memoryResult.data;
  }

  // 3. Search memory for relevant entries (with relevance ranking)
  if (memoryStr) {
    const entries = parseMemoryEntries(memoryStr);
    const relevant = searchMemory(entries, question);
    if (relevant.length > 0) {
      memoryStr = relevant.map((e) => `- ${e.raw}`).join("\n");
    }
  }

  // 4. Find and read relevant files (by path matching)
  const filePaths = findRelevantFiles(question, projectMap);
  const foundPaths = new Set<string>();

  for (const relPath of filePaths) {
    if (relPath.startsWith("npm run ")) continue; // skip script references
    if (isIgnored(relPath, ignorePatterns)) continue; // skip ignored files

    const fullPath = path.join(root, relPath);
    const excerpt = await readFileExcerpt(fullPath, keywords);
    if (excerpt) {
      relevantFiles.push({ path: relPath, excerpt });
      foundPaths.add(relPath);
    }
  }

  // 5. Content search — find files that match by content but not path
  if (keywords.length > 0) {
    const contentMatches = await findFilesByContent(root, keywords, foundPaths, ignorePatterns);
    for (const relPath of contentMatches) {
      const fullPath = path.join(root, relPath);
      const excerpt = await readFileExcerpt(fullPath, keywords);
      if (excerpt) {
        relevantFiles.push({ path: relPath, excerpt });
      }
    }
  }

  // 6. Build system prompt
  const systemParts: string[] = [
    "You are Huno, an AI assistant that knows the user's codebase.",
    "Answer questions based on the provided project context.",
    "If you don't have enough context, say so honestly.",
    "Be concise and cite file names when referencing code.",
  ];

  if (projectMap) {
    systemParts.push(
      `\n## Project: ${projectMap.projectName}\n` +
        `Languages: ${projectMap.stack.languages.join(", ") || "unknown"}\n` +
        `Frameworks: ${projectMap.stack.frameworks.join(", ") || "none detected"}\n` +
        `Database: ${projectMap.stack.database.join(", ") || "none detected"}\n` +
        `Infrastructure: ${projectMap.stack.infrastructure.join(", ") || "none detected"}`
    );
  }

  const systemPrompt = systemParts.join("\n");
  const userPrompt = question;

  return {
    ok: true,
    data: {
      question,
      systemPrompt,
      userPrompt,
      files: {
        projectMap: projectMapStr,
        memory: memoryStr,
        relevantFiles,
      },
    },
  };
}
