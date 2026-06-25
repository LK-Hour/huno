import fs from "fs/promises";
import path from "path";
import { getHunoDir } from "../utils/paths.js";
import { HunoError, Result } from "../utils/errors.js";

export type InitEntryStatus = "created" | "exists";

export type InitEntry = {
  path: string;
  type: "file" | "directory";
  status: InitEntryStatus;
};

export async function ensureHunoDir(): Promise<Result<void>> {
  const dir = getHunoDir();
  try {
    await fs.mkdir(dir, { recursive: true });
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: new HunoError(
        `Could not create .huno directory at ${dir}`,
        "DIR_CREATE_FAILED",
        "Check directory permissions and available disk space."
      ),
    };
  }
}

export async function isHunoInitialized(): Promise<boolean> {
  return pathExists(getHunoDir());
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function writeHunoFile(
  filename: string,
  content: string
): Promise<Result<void>> {
  const dir = getHunoDir();
  try {
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, content, "utf-8");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: new HunoError(
        `Could not write .huno/${filename}`,
        "FILE_WRITE_FAILED",
        "Check directory permissions and available disk space."
      ),
    };
  }
}

export async function ensureHunoFile(
  filename: string,
  content: string
): Promise<Result<InitEntry>> {
  const dir = getHunoDir();
  const filePath = path.join(dir, filename);

  try {
    await fs.mkdir(dir, { recursive: true });

    if (await pathExists(filePath)) {
      return {
        ok: true,
        data: { path: `.huno/${filename}`, type: "file", status: "exists" },
      };
    }

    await fs.writeFile(filePath, content, "utf-8");
    return {
      ok: true,
      data: { path: `.huno/${filename}`, type: "file", status: "created" },
    };
  } catch {
    return {
      ok: false,
      error: new HunoError(
        `Could not write .huno/${filename}`,
        "FILE_WRITE_FAILED",
        "Check directory permissions and available disk space."
      ),
    };
  }
}

export async function ensureHunoSubdir(dirname: string): Promise<Result<InitEntry>> {
  const dir = getHunoDir();
  const targetDir = path.join(dir, dirname);

  try {
    await fs.mkdir(dir, { recursive: true });

    if (await pathExists(targetDir)) {
      return {
        ok: true,
        data: { path: `.huno/${dirname}/`, type: "directory", status: "exists" },
      };
    }

    await fs.mkdir(targetDir, { recursive: true });
    return {
      ok: true,
      data: { path: `.huno/${dirname}/`, type: "directory", status: "created" },
    };
  } catch {
    return {
      ok: false,
      error: new HunoError(
        `Could not create .huno/${dirname}/`,
        "DIR_CREATE_FAILED",
        "Check directory permissions and available disk space."
      ),
    };
  }
}

export async function readHunoFile(filename: string): Promise<Result<string>> {
  const filePath = path.join(getHunoDir(), filename);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return { ok: true, data: content };
  } catch (err) {
    return {
      ok: false,
      error: new HunoError(
        `Could not read .huno/${filename}`,
        "FILE_READ_FAILED",
        "Run `huno init` in this project to create the missing file."
      ),
    };
  }
}
