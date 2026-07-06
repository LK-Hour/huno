import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import { ConfigSchema, defaultConfig, loadConfig, saveConfig } from "../../src/core/config.js";

vi.mock("../../src/utils/paths.js", () => ({
  getProjectRoot: () => "/tmp/huno-config-test",
  getHunoDir: () => "/tmp/huno-config-test/.huno",
}));

describe("defaultConfig", () => {
  it("returns a valid config object", () => {
    const cfg = defaultConfig();
    expect(cfg.version).toBe("0.1.0");
    expect(cfg.permissions.allowRead).toBe(true);
    expect(cfg.permissions.allowWrite).toBe("ask");
    expect(cfg.memory.enabled).toBe(true);
    expect(cfg.history.maxMessages).toBe(50);
  });

  it("passes ConfigSchema validation", () => {
    const cfg = defaultConfig();
    const result = ConfigSchema.safeParse(cfg);
    expect(result.success).toBe(true);
  });
});

describe("ConfigSchema", () => {
  it("validates a minimal config", () => {
    const result = ConfigSchema.safeParse({ version: "0.1.0" });
    expect(result.success).toBe(true);
  });

  it("applies defaults for missing optional fields", () => {
    const result = ConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe("0.1.0");
      expect(result.data.permissions.allowRead).toBe(true);
      expect(result.data.memory.enabled).toBe(true);
    }
  });

  it("rejects invalid types", () => {
    const result = ConfigSchema.safeParse({ version: 123 });
    expect(result.success).toBe(false);
  });
});

describe("loadConfig / saveConfig", () => {
  const testDir = "/tmp/huno-config-test/.huno";

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm("/tmp/huno-config-test", { recursive: true, force: true });
  });

  it("saveConfig writes and loadConfig reads back", async () => {
    const cfg = defaultConfig();
    cfg.projectName = "test-proj";
    const saveResult = await saveConfig(cfg);
    expect(saveResult.ok).toBe(true);

    const loadResult = await loadConfig();
    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      expect(loadResult.data.projectName).toBe("test-proj");
    }
  });

  it("loadConfig returns error for missing file", async () => {
    const result = await loadConfig();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CONFIG_MISSING");
  });

  it("loadConfig returns error for invalid JSON", async () => {
    await fs.writeFile(`${testDir}/config.json`, "not json!", "utf-8");
    const result = await loadConfig();
    expect(result.ok).toBe(false);
  });
});
