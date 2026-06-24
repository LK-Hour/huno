import fs from "fs/promises";
import path from "path";
import { getProjectRoot, getHunoDir } from "../utils/paths.js";
import { readHunoFile } from "../storage/huno-dir.js";
import { readMemoryFile, parseMemoryEntries, searchMemory } from "../storage/memory-file.js";
import { parseProjectMap, type ProjectMap } from "../storage/project-map.js";
import { HunoError, Result } from "../utils/errors.js";
import type { ContextBuildResult } from "../types/context.js";

const MAX_FILE_SIZE = 2000; // characters per file excerpt
const MAX_FILES = 5;

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

async function readFileExcerpt(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    if (content.length > MAX_FILE_SIZE) {
      return content.slice(0, MAX_FILE_SIZE) + "\n... (truncated)";
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

  // 3. Search memory for relevant entries
  if (memoryStr) {
    const entries = parseMemoryEntries(memoryStr);
    const relevant = searchMemory(entries, question);
    if (relevant.length > 0) {
      memoryStr = relevant.map((e) => `- ${e.raw}`).join("\n");
    }
  }

  // 4. Find and read relevant files
  const filePaths = findRelevantFiles(question, projectMap);
  for (const relPath of filePaths) {
    if (relPath.startsWith("npm run ")) continue; // skip script references
    const fullPath = path.join(root, relPath);
    const excerpt = await readFileExcerpt(fullPath);
    if (excerpt) {
      relevantFiles.push({ path: relPath, excerpt });
    }
  }

  // 5. Build system prompt
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
