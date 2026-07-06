import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import { parseMemoryEntries, searchMemory } from "../../src/storage/memory-file.js";
import type { MemoryEntry } from "../../src/storage/memory-file.js";

// Mock paths to use a temp dir
vi.mock("../../src/utils/paths.js", () => ({
  getProjectRoot: () => "/tmp/huno-test",
  getHunoDir: () => "/tmp/huno-test/.huno",
}));

describe("parseMemoryEntries", () => {
  it("parses simple bullet entries", () => {
    const content = "- hello world\n- second entry\n";
    const entries = parseMemoryEntries(content);
    expect(entries).toHaveLength(2);
    expect(entries[0].text).toBe("hello world");
    expect(entries[1].text).toBe("second entry");
  });

  it("parses dated entries", () => {
    const content = "- 2024-06-15: added new feature\n";
    const entries = parseMemoryEntries(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe("2024-06-15");
    expect(entries[0].text).toBe("added new feature");
  });

  it("handles multi-line bullet continuation", () => {
    const content = "- first line\n  continued here\n- second\n";
    const entries = parseMemoryEntries(content);
    expect(entries).toHaveLength(2);
    expect(entries[0].text).toContain("continued here");
  });

  it("returns empty for empty content", () => {
    expect(parseMemoryEntries("")).toHaveLength(0);
    expect(parseMemoryEntries("\n\n")).toHaveLength(0);
  });
});

describe("searchMemory", () => {
  const entries: MemoryEntry[] = [
    { raw: "2024-01-01: setup docker", date: "2024-01-01", text: "setup docker" },
    { raw: "2024-01-02: fix auth bug", date: "2024-01-02", text: "fix auth bug" },
    { raw: "2024-01-03: deploy api", date: "2024-01-03", text: "deploy api" },
    { raw: "review docker compose", text: "review docker compose" },
  ];

  it("finds entries matching query words", () => {
    const results = searchMemory(entries, "docker");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((e) => e.text.includes("docker"))).toBe(true);
  });

  it("ranks multi-word matches higher", () => {
    const results = searchMemory(entries, "docker compose");
    expect(results[0].text).toBe("review docker compose");
  });

  it("returns all entries when no match", () => {
    const results = searchMemory(entries, "xyznonexistent");
    expect(results).toHaveLength(entries.length);
  });
});

describe("appendMemory / readMemoryFile", () => {
  const testDir = "/tmp/huno-test/.huno";

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm("/tmp/huno-test", { recursive: true, force: true });
  });

  it("appendMemory writes to memory.md", async () => {
    const { appendMemory } = await import("../../src/storage/memory-file.js");
    const result = await appendMemory("test entry");
    expect(result.ok).toBe(true);
    const content = await fs.readFile(`${testDir}/memory.md`, "utf-8");
    expect(content).toContain("test entry");
  });

  it("readMemoryFile reads existing file", async () => {
    await fs.writeFile(`${testDir}/memory.md`, "- 2024-01-01: hello\n", "utf-8");
    const { readMemoryFile } = await import("../../src/storage/memory-file.js");
    const result = await readMemoryFile();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toContain("hello");
  });

  it("readMemoryFile returns error for missing file", async () => {
    await fs.rm(`${testDir}/memory.md`, { force: true });
    const { readMemoryFile } = await import("../../src/storage/memory-file.js");
    const result = await readMemoryFile();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("MEMORY_READ_FAILED");
  });
});
