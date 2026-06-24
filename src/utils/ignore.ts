import fs from "fs/promises";
import path from "path";
import { getProjectRoot } from "./paths.js";

/**
 * Read .hunoignore from project root, if it exists.
 * Returns an array of glob pattern strings (blank lines and comments ignored).
 */
export async function readHunoIgnore(): Promise<string[]> {
  const filePath = path.join(getProjectRoot(), ".hunoignore");
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
  } catch {
    return [];
  }
}

/**
 * Convert a simple glob pattern to a RegExp.
 * Supports:
 *   - `*` matches any characters except `/`
 *   - `**` matches any characters including `/`
 *   - `?` matches a single character
 *   - Trailing `/` matches directories
 */
function globToRegex(pattern: string): RegExp {
  // Determine if the pattern is anchored to the end (directory match)
  const isDirPattern = pattern.endsWith("/");

  // Escape regex special chars except * and ?
  let regexStr = "";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === "*" && pattern[i + 1] === "*") {
      regexStr += ".*";
      i += 2;
    } else if (ch === "*") {
      regexStr += "[^/]*";
      i++;
    } else if (ch === "?") {
      regexStr += ".";
      i++;
    } else if (/[.+^${}()|[\]\\]/.test(ch)) {
      regexStr += "\\" + ch;
      i++;
    } else {
      regexStr += ch;
      i++;
    }
  }

  // If it's a dir pattern, allow matching the dir or anything inside it
  if (isDirPattern) {
    regexStr = `^(${regexStr})($|/)`;
  } else {
    regexStr = `^(${regexStr})$`;
  }

  return new RegExp(regexStr);
}

/**
 * Check whether a given file path matches any of the ignore patterns.
 * The filePath should be relative to the project root.
 */
export function isIgnored(filePath: string, patterns: string[]): boolean {
  // Normalize: remove leading ./ and use forward slashes
  const normalized = filePath.replace(/^\.\//g, "").replace(/\\/g, "/");

  for (const pattern of patterns) {
    // Handle negation
    const negated = pattern.startsWith("!");
    const actualPattern = negated ? pattern.slice(1) : pattern;

    // For patterns without wildcards or slashes, also match by basename
    const hasWildcard = actualPattern.includes("*") || actualPattern.includes("?");
    const hasSlash = actualPattern.includes("/");

    let regex: RegExp;
    if (hasSlash || hasWildcard) {
      regex = globToRegex(actualPattern);
    } else {
      // Simple name match: match against the full path or basename
      regex = new RegExp(`^(${actualPattern})$|/${actualPattern}$`);
    }

    const matches = regex.test(normalized);

    if (matches) {
      return !negated;
    }

    // Also check basename for non-slash patterns without wildcards
    if (!hasSlash && !hasWildcard) {
      const basename = path.basename(normalized);
      if (basename === actualPattern) {
        return !negated;
      }
    }
  }

  return false;
}
