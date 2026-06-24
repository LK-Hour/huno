import { getProjectRoot } from "../utils/paths.js";
import { HunoError, Result } from "../utils/errors.js";

export type ProjectMap = {
  version: string;
  projectName: string;
  root: string;
  generatedAt: string;
  stack: {
    languages: string[];
    frameworks: string[];
    database: string[];
    infrastructure: string[];
  };
  packageManagers: string[];
  importantFiles: string[];
  directories: Record<string, string>;
  scripts: Record<string, string>;
};

export function emptyProjectMap(): ProjectMap {
  return {
    version: "0.1.0",
    projectName: "",
    root: getProjectRoot(),
    generatedAt: new Date().toISOString(),
    stack: {
      languages: [],
      frameworks: [],
      database: [],
      infrastructure: [],
    },
    packageManagers: [],
    importantFiles: [],
    directories: {},
    scripts: {},
  };
}

export function serializeProjectMap(map: ProjectMap): string {
  return JSON.stringify(map, null, 2);
}

export function parseProjectMap(json: string): Result<ProjectMap> {
  try {
    const data = JSON.parse(json) as ProjectMap;
    // Minimal sanity checks without Zod for now.
    if (!data || typeof data !== "object") {
      return {
        ok: false,
        error: new HunoError(
          "Invalid project map: not an object.",
          "PROJECT_MAP_INVALID",
          "Run `huno init` or `huno explain` to regenerate the project map."
        ),
      };
    }
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: new HunoError(
        "Failed to parse project map JSON.",
        "PROJECT_MAP_PARSE_FAILED",
        "The file may be corrupted. Try regenerating with `huno explain`."
      ),
    };
  }
}