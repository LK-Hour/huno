import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";

// scanProject uses process.cwd() directly, so we mock that
const TEST_ROOT = "/tmp/huno-scanner-test";

vi.mock("../../src/utils/paths.js", () => ({
  getProjectRoot: () => TEST_ROOT,
  getHunoDir: () => `${TEST_ROOT}/.huno`,
}));

describe("scanProject", () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_ROOT, { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(TEST_ROOT);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(TEST_ROOT, { recursive: true, force: true });
  });

  it("detects a Node.js project with package.json", async () => {
    await fs.writeFile(
      path.join(TEST_ROOT, "package.json"),
      JSON.stringify({ name: "test", scripts: { test: "vitest" }, devDependencies: { vitest: "^1.0.0" } }),
      "utf-8"
    );
    await fs.writeFile(path.join(TEST_ROOT, "tsconfig.json"), "{}", "utf-8");
    await fs.mkdir(path.join(TEST_ROOT, "src"), { recursive: true });

    const { scanProject } = await import("../../src/core/scanner.js");
    const result = await scanProject();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.stack.languages).toContain("TypeScript");
      expect(result.data.projectName).toBe("huno-scanner-test");
      expect(result.data.scripts).toHaveProperty("test");
      expect(result.data.tests.frameworks).toContain("vitest");
    }
  });

  it("detects missing README and LICENSE as warnings", async () => {
    await fs.writeFile(path.join(TEST_ROOT, "package.json"), "{}", "utf-8");

    const { scanProject } = await import("../../src/core/scanner.js");
    const result = await scanProject();
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ids = result.data.warnings.map((w) => w.id);
      expect(ids).toContain("missing-readme");
      expect(ids).toContain("missing-license");
    }
  });

  it("detects git repository", async () => {
    await fs.mkdir(path.join(TEST_ROOT, ".git"), { recursive: true });
    await fs.writeFile(path.join(TEST_ROOT, "package.json"), "{}", "utf-8");

    const { scanProject } = await import("../../src/core/scanner.js");
    const result = await scanProject();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.git.isRepository).toBe(true);
    }
  });

  it("ignores node_modules directories", async () => {
    await fs.writeFile(path.join(TEST_ROOT, "package.json"), "{}", "utf-8");
    await fs.mkdir(path.join(TEST_ROOT, "node_modules"), { recursive: true });
    await fs.mkdir(path.join(TEST_ROOT, "src"), { recursive: true });

    const { scanProject } = await import("../../src/core/scanner.js");
    const result = await scanProject();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.data.directories)).not.toContain("node_modules");
      expect(Object.keys(result.data.directories)).toContain("src");
    }
  });
});
