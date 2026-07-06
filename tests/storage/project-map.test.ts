import { describe, it, expect, vi } from "vitest";
import {
  serializeProjectMap,
  parseProjectMap,
  emptyProjectMap,
} from "../../src/storage/project-map.js";

vi.mock("../../src/utils/paths.js", () => ({
  getProjectRoot: () => "/tmp/huno-test",
  getHunoDir: () => "/tmp/huno-test/.huno",
}));

describe("emptyProjectMap", () => {
  it("returns a valid empty map with defaults", () => {
    const map = emptyProjectMap();
    expect(map.version).toBe("0.1.0");
    expect(map.root).toBe("/tmp/huno-test");
    expect(map.stack.languages).toEqual([]);
    expect(map.stack.frameworks).toEqual([]);
    expect(map.git.isRepository).toBe(false);
    expect(map.warnings).toEqual([]);
  });
});

describe("serializeProjectMap", () => {
  it("produces valid JSON", () => {
    const map = emptyProjectMap();
    map.projectName = "test-project";
    const json = serializeProjectMap(map);
    const parsed = JSON.parse(json);
    expect(parsed.projectName).toBe("test-project");
  });
});

describe("parseProjectMap", () => {
  it("parses valid JSON into ProjectMap", () => {
    const map = emptyProjectMap();
    map.projectName = "my-app";
    const json = serializeProjectMap(map);
    const result = parseProjectMap(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.projectName).toBe("my-app");
      expect(result.data.version).toBe("0.1.0");
    }
  });

  it("returns error for invalid JSON", () => {
    const result = parseProjectMap("not valid json {{{");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PROJECT_MAP_PARSE_FAILED");
  });

  it("returns error for non-object JSON", () => {
    const result = parseProjectMap("null");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PROJECT_MAP_INVALID");
  });

  it("roundtrips through serialize/parse", () => {
    const original = emptyProjectMap();
    original.projectName = "roundtrip";
    original.stack.languages = ["TypeScript"];
    const result = parseProjectMap(serializeProjectMap(original));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.projectName).toBe("roundtrip");
      expect(result.data.stack.languages).toEqual(["TypeScript"]);
    }
  });
});
