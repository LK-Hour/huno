import fs from "fs/promises";
import fspath from "path";
import { getHunoDir } from "../utils/paths.js";

export const MAX_HISTORY = 500;

export function getHistoryPath(): string {
  return fspath.join(getHunoDir(), "input_history.txt");
}

export async function loadHistory(): Promise<string[]> {
  try {
    const content = await fs.readFile(getHistoryPath(), "utf-8");
    return content.split("\n").filter(Boolean).slice(-MAX_HISTORY);
  } catch {
    return [];
  }
}

export async function saveHistory(entry: string): Promise<void> {
  if (!entry.trim()) return;
  try {
    const historyPath = getHistoryPath();
    await fs.mkdir(fspath.dirname(historyPath), { recursive: true });
    await fs.appendFile(historyPath, entry + "\n");
  } catch {
    /* best effort */
  }
}
