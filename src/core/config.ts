import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { getHunoDir } from "../utils/paths.js";
import { HunoError, Result } from "../utils/errors.js";

export const ConfigSchema = z.object({
  version: z.string().default("0.1.0"),
  projectName: z.string().optional(),
  defaultProvider: z.string().optional(),
  defaultModel: z.string().optional(),
  apiKeys: z
    .object({
      openrouter: z.string().optional(),
      gemini: z.string().optional(),
      nvidia: z.string().optional(),
      groq: z.string().optional(),
      mistral: z.string().optional(),
      cerebras: z.string().optional(),
      ollama: z.string().optional(),
    })
    .optional(),
  permissions: z
    .object({
      allowRead: z.boolean().default(true),
      allowWrite: z.string().default("ask"),
      allowCommand: z.string().default("ask"),
      allowDestructive: z.boolean().default(false),
    })
    .default({}),
  memory: z
    .object({
      enabled: z.boolean().default(true),
      storage: z.string().default("local"),
    })
    .default({}),
  ui: z
    .object({
      theme: z.string().default("default"),
      showToolCalls: z.boolean().default(true),
      showContextFiles: z.boolean().default(true),
    })
    .optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export async function loadConfig(): Promise<Result<Config>> {
  const configPath = path.join(getHunoDir(), "config.json");
  try {
    const raw = await fs.readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    const result = ConfigSchema.safeParse(parsed);
    if (!result.success) {
      return {
        ok: false,
        error: new HunoError(
          "Invalid .huno/config.json schema.",
          "CONFIG_INVALID",
          `Validation errors:\n${result.error.issues.map((e) => e.message).join("\n")}`
        ),
      };
    }
    return { ok: true, data: result.data };
  } catch (err) {
    return {
      ok: false,
      error: new HunoError(
        `Could not read .huno/config.json at ${configPath}`,
        "CONFIG_MISSING",
        "Run `huno init` in this project."
      ),
    };
  }
}

export function defaultConfig(): Config {
  return {
    version: "0.1.0",
    permissions: { allowRead: true, allowWrite: "ask", allowCommand: "ask", allowDestructive: false },
    memory: { enabled: true, storage: "local" },
  };
}