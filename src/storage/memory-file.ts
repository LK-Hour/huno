import fs from "fs/promises";
import path from "path";
import { getHunoDir } from "../utils/paths.js";
import { HunoError, Result } from "../utils/errors.js";

export async function appendMemory(entry: string): Promise<Result<void>> {
  try {
    const dir = getHunoDir();
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, "memory.md");
    const timestamp = new Date().toISOString().slice(0, 10);
    const line = `- ${timestamp}: ${entry}\n`;
    await fs.appendFile(filePath, line, "utf-8");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: new HunoError(
        "Failed to append memory.",
        "MEMORY_WRITE_FAILED",
        "Check .huno/memory.md permissions."
      ),
    };
  }
}

export async function readMemoryFile(): Promise<Result<string>> {
  const filePath = path.join(getHunoDir(), "memory.md");
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return { ok: true, data: content };
  } catch (err) {
    return {
      ok: false,
      error: new HunoError(
        `Could not read .huno/memory.md`,
        "MEMORY_READ_FAILED",
        "Run `huno init` to create the file."
      ),
    };
  }
}

export type MemoryEntry = {
  raw: string;
  date?: string;
  text: string;
};

export function parseMemoryEntries(content: string): MemoryEntry[] {
  const lines = content.split(/\r?\n/);
  const entries: MemoryEntry[] = [];
  let inBullet = false;
  let current = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inBullet && current.trim()) {
        entries.push({ raw: current.trim(), text: current.trim() });
        current = "";
        inBullet = false;
      }
      continue;
    }
    if (trimmed.startsWith("- ")) {
      if (inBullet && current.trim()) {
        entries.push({ raw: current.trim(), text: current.trim() });
      }
      current = trimmed.slice(2);
      inBullet = true;
    } else if (inBullet) {
      current += " " + trimmed;
    }
  }
  if (inBullet && current.trim()) {
    entries.push({ raw: current.trim(), text: current.trim() });
  }

  // Parse date if present (YYYY-MM-DD: or YYYY-MM-DD:)
  return entries.map((e) => {
    const dateMatch = e.raw.match(/^(\d{4}-\d{2}-\d{2}):\s*(.*)$/);
    if (dateMatch) {
      return { raw: e.raw, date: dateMatch[1], text: dateMatch[2] };
    }
    return e;
  });
}

export function searchMemory(entries: MemoryEntry[], query: string): MemoryEntry[] {
  const q = query.toLowerCase();
  const queryWords = q.split(/\s+/).filter((w) => w.length > 1);

  if (queryWords.length === 0) {
    return entries.filter((e) => e.text.toLowerCase().includes(q));
  }

  // Score each entry by how many distinct query words it matches
  const scored = entries.map((entry) => {
    const textLower = entry.text.toLowerCase();
    let score = 0;
    for (const word of queryWords) {
      if (textLower.includes(word)) {
        score++;
      }
    }
    return { entry, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // If at least one match, return top 5 by score
  const matched = scored.filter((s) => s.score > 0);
  if (matched.length > 0) {
    return matched.slice(0, 5).map((s) => s.entry);
  }

  // If no matches at all, return all entries so the LLM still has context
  return entries;
}