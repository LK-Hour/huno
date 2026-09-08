import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const PACKAGE_NAME = "@lk-hour/huno";
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;
const CACHE_PATH = join(homedir(), ".huno", "update-check.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — avoid hitting the registry on every launch

type Cache = { lastChecked: number; latest: string };

function readCache(): Cache | null {
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf-8"));
  } catch {
    return null;
  }
}

function writeCache(latest: string): void {
  try {
    mkdirSync(join(homedir(), ".huno"), { recursive: true });
    writeFileSync(CACHE_PATH, JSON.stringify({ lastChecked: Date.now(), latest } satisfies Cache));
  } catch {
    // Best-effort cache — fine if this fails (e.g. read-only home dir).
  }
}

/** Compares two `x.y.z` version strings. Returns true if `a` is newer than `b`. */
export function isNewerVersion(a: string, b: string): boolean {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na > nb;
  }
  return false;
}

async function fetchLatestVersion(timeoutMs: number): Promise<string | null> {
  try {
    const resp = await fetch(REGISTRY_URL, { signal: AbortSignal.timeout(timeoutMs) });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { version?: string };
    return data.version || null;
  } catch {
    return null;
  }
}

export type UpdateStatus = { current: string; latest: string; hasUpdate: boolean };

/**
 * Checks npm for the latest published version.
 * By default reuses a 24h local cache so the REPL startup path never blocks
 * on the network; pass `force: true` (e.g. for `huno update`) to always hit
 * the registry. Returns null if the check can't complete (offline, timeout).
 */
export async function checkForUpdate(
  currentVersion: string,
  opts: { force?: boolean; timeoutMs?: number } = {}
): Promise<UpdateStatus | null> {
  const { force = false, timeoutMs = 3000 } = opts;

  if (!force) {
    const cached = readCache();
    if (cached && Date.now() - cached.lastChecked < CACHE_TTL_MS) {
      return { current: currentVersion, latest: cached.latest, hasUpdate: isNewerVersion(cached.latest, currentVersion) };
    }
  }

  const latest = await fetchLatestVersion(timeoutMs);
  if (!latest) return null;

  writeCache(latest);
  return { current: currentVersion, latest, hasUpdate: isNewerVersion(latest, currentVersion) };
}

export { PACKAGE_NAME };
