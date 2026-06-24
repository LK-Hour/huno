import fs from "fs/promises";
import path from "path";
import { getHunoDir } from "../utils/paths.js";
import { HunoError, Result } from "../utils/errors.js";

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