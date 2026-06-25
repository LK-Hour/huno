import { defaultConfig, loadConfig } from "../core/config.js";
import type { Provider } from "./base.js";
import { OllamaProvider } from "./ollama.js";
import { HunoError, Result } from "../utils/errors.js";
import { OpenAICompatibleProvider } from "./openai-compatible.js";
import type { Config } from "../core/config.js";

type ProviderDefinition = {
  name: string;
  aliases?: string[];
  envKeys: string[];
  configKey: keyof NonNullable<Config["apiKeys"]>;
  defaultModel: string;
  baseURL: string | ((config: Config) => Result<string>);
  defaultHeaders?: Record<string, string>;
  help: string;
};

export type ProviderInfo = {
  name: string;
  aliases: string[];
  envKeys: string[];
  defaultModel: string;
  requiresAccountId?: boolean;
};

export type ProviderModelInfo = {
  id: string;
  likelyFree: boolean;
};

export type ProviderSelectionOptions = {
  provider?: string;
  model?: string;
};

const PROVIDERS: ProviderDefinition[] = [
  {
    name: "openrouter",
    envKeys: ["OPENROUTER_API_KEY"],
    configKey: "openrouter",
    defaultModel: "google/gemini-2.0-flash-001",
    baseURL: "https://openrouter.ai/api/v1",
    help: "Set OPENROUTER_API_KEY or apiKeys.openrouter, then choose an OpenRouter model.",
  },
  {
    name: "github",
    aliases: ["github-models", "github_models"],
    envKeys: ["GITHUB_MODELS_TOKEN", "GITHUB_TOKEN"],
    configKey: "github",
    defaultModel: "openai/gpt-4.1-mini",
    baseURL: "https://models.github.ai/inference",
    defaultHeaders: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
    },
    help: "Set GITHUB_TOKEN or GITHUB_MODELS_TOKEN with GitHub Models access.",
  },
  {
    name: "google",
    aliases: ["gemini", "google-ai-studio", "google_ai_studio"],
    envKeys: ["GEMINI_API_KEY", "GOOGLE_AI_API_KEY"],
    configKey: "gemini",
    defaultModel: "gemini-3.5-flash",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    help: "Set GEMINI_API_KEY from Google AI Studio.",
  },
  {
    name: "groq",
    envKeys: ["GROQ_API_KEY"],
    configKey: "groq",
    defaultModel: "llama-3.3-70b-versatile",
    baseURL: "https://api.groq.com/openai/v1",
    help: "Set GROQ_API_KEY and choose a Groq chat model.",
  },
  {
    name: "cerebras",
    envKeys: ["CEREBRAS_API_KEY"],
    configKey: "cerebras",
    defaultModel: "gpt-oss-120b",
    baseURL: "https://api.cerebras.ai/v1",
    help: "Set CEREBRAS_API_KEY and choose an available Cerebras model.",
  },
  {
    name: "mistral",
    aliases: ["mistral-ai", "mistral_ai"],
    envKeys: ["MISTRAL_API_KEY"],
    configKey: "mistral",
    defaultModel: "mistral-small-latest",
    baseURL: "https://api.mistral.ai/v1",
    help: "Set MISTRAL_API_KEY and choose a Mistral chat model.",
  },
  {
    name: "siliconflow",
    aliases: ["silicon-flow", "silicon_flow"],
    envKeys: ["SILICONFLOW_API_KEY"],
    configKey: "siliconflow",
    defaultModel: "Pro/zai-org/GLM-4.7",
    baseURL: "https://api.siliconflow.cn/v1",
    help: "Set SILICONFLOW_API_KEY and choose a SiliconFlow chat model.",
  },
  {
    name: "cohere",
    envKeys: ["COHERE_API_KEY"],
    configKey: "cohere",
    defaultModel: "command-a-plus-05-2026",
    baseURL: "https://api.cohere.ai/compatibility/v1",
    help: "Set COHERE_API_KEY and choose a Cohere compatibility API model.",
  },
  {
    name: "huggingface",
    aliases: ["hugging-face", "hf"],
    envKeys: ["HF_TOKEN", "HUGGINGFACE_API_KEY"],
    configKey: "huggingface",
    defaultModel: "openai/gpt-oss-120b:cerebras",
    baseURL: "https://router.huggingface.co/v1",
    help: "Set HF_TOKEN and choose a Hugging Face Inference Provider chat model.",
  },
  {
    name: "cloudflare",
    aliases: ["cloudflare-workers-ai", "workers-ai", "workers_ai"],
    envKeys: ["CLOUDFLARE_API_TOKEN"],
    configKey: "cloudflare",
    defaultModel: "@cf/meta/llama-3.1-8b-instruct",
    baseURL: (config) => {
      const accountId = config.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID;
      if (!accountId) {
        return {
          ok: false,
          error: new HunoError(
            "Cloudflare account ID not configured.",
            "PROVIDER_ACCOUNT_ID_MISSING",
            "Set CLOUDFLARE_ACCOUNT_ID or cloudflareAccountId in .huno/config.json."
          ),
        };
      }
      return {
        ok: true,
        data: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
      };
    },
    help: "Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID for Workers AI.",
  },
];

export async function getActiveProvider(
  options: ProviderSelectionOptions = {}
): Promise<Result<Provider>> {
  const configResult = await loadConfig();
  if (!configResult.ok && configResult.error.code !== "CONFIG_MISSING") {
    return configResult as Result<Provider>;
  }

  const config = configResult.ok ? configResult.data : defaultConfig();
  const providerName = options.provider || process.env.HUNO_PROVIDER || config.defaultProvider || "ollama";
  const model = options.model || process.env.HUNO_MODEL || config.defaultModel;

  if (providerName === "ollama") {
    return { ok: true, data: new OllamaProvider(model) };
  }

  const provider = findProviderDefinition(providerName);
  if (!provider) {
    return {
      ok: false,
      error: new HunoError(
        `Unknown provider: ${providerName}`,
        "PROVIDER_UNKNOWN",
        `Supported providers: ${supportedProviders().join(", ")}.`
      ),
    };
  }

  const apiKey = resolveApiKey(config, provider);
  if (!apiKey) {
    return {
      ok: false,
      error: new HunoError(
        `${provider.name} API key not configured.`,
        "API_KEY_MISSING",
        provider.help
      ),
    };
  }

  const baseURL = resolveBaseURL(config, provider);
  if (!baseURL.ok) {
    return baseURL as Result<Provider>;
  }

  return {
    ok: true,
    data: new OpenAICompatibleProvider({
      name: provider.name,
      model: model || provider.defaultModel,
      apiKey,
      baseURL: baseURL.data,
      help: provider.help,
      defaultHeaders: provider.defaultHeaders,
    }),
  };
}

function findProviderDefinition(name: string): ProviderDefinition | undefined {
  const normalized = name.toLowerCase();
  return PROVIDERS.find(
    (provider) =>
      provider.name === normalized ||
      provider.aliases?.some((alias) => alias === normalized)
  );
}

function resolveApiKey(config: Config, provider: ProviderDefinition): string | null {
  const configured = config.apiKeys?.[provider.configKey];
  if (configured) {
    const envValue = process.env[configured];
    if (envValue) return envValue;

    // Config values normally name environment variables. Only treat a value as
    // a literal key when it does not look like an env var name.
    if (!/^[A-Z][A-Z0-9_]*$/.test(configured)) {
      return configured;
    }
  }

  for (const envKey of provider.envKeys) {
    const value = process.env[envKey];
    if (value) return value;
  }

  return null;
}

function resolveBaseURL(config: Config, provider: ProviderDefinition): Result<string> {
  if (typeof provider.baseURL === "string") {
    return { ok: true, data: provider.baseURL };
  }

  return provider.baseURL(config);
}

function supportedProviders(): string[] {
  return ["ollama", ...PROVIDERS.map((provider) => provider.name)];
}

export function listProviderInfo(): ProviderInfo[] {
  return [
    {
      name: "ollama",
      aliases: [],
      envKeys: ["HUNO_MODEL"],
      defaultModel: "llama3.2",
    },
    ...PROVIDERS.map((provider) => ({
      name: provider.name,
      aliases: provider.aliases || [],
      envKeys: provider.envKeys,
      defaultModel: provider.defaultModel,
      requiresAccountId: provider.name === "cloudflare",
    })),
  ];
}

export async function fetchProviderModels(options: {
  provider: string;
  apiKey?: string;
  cloudflareAccountId?: string;
}): Promise<Result<ProviderModelInfo[]>> {
  if (options.provider === "ollama") {
    return {
      ok: true,
      data: [{ id: "llama3.2", likelyFree: true }],
    };
  }

  const provider = findProviderDefinition(options.provider);
  if (!provider) {
    return {
      ok: false,
      error: new HunoError(
        `Unknown provider: ${options.provider}`,
        "PROVIDER_UNKNOWN",
        `Supported providers: ${supportedProviders().join(", ")}.`
      ),
    };
  }

  if (!options.apiKey) {
    return {
      ok: false,
      error: new HunoError(
        `${provider.name} API key not configured.`,
        "API_KEY_MISSING",
        provider.help
      ),
    };
  }

  const config = {
    ...defaultConfig(),
    cloudflareAccountId: options.cloudflareAccountId,
  } as Config;

  const baseURL = resolveBaseURL(config, provider);
  if (!baseURL.ok) {
    return baseURL;
  }

  try {
    const response = await fetch(`${baseURL.data.replace(/\/$/, "")}/models`, {
      headers: {
        ...provider.defaultHeaders,
        Authorization: `Bearer ${options.apiKey}`,
      },
    });

    const rawBody = await response.text();
    let parsed: {
      data?: Array<{ id?: string }>;
      models?: Array<{ id?: string; name?: string }>;
      error?: { message?: string };
    } | null = null;

    try {
      parsed = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        error: new HunoError(
          `${provider.name} model listing failed (${response.status}).`,
          "PROVIDER_MODEL_LIST_FAILED",
          parsed?.error?.message || provider.help
        ),
      };
    }

    const modelIds = [
      ...(parsed?.data || []).map((entry) => entry.id).filter(Boolean),
      ...(parsed?.models || []).map((entry) => entry.id || entry.name).filter(Boolean),
    ] as string[];

    const uniqueModels = [...new Set(modelIds)];
    const ranked = uniqueModels
      .map((id) => ({
        id,
        likelyFree: isLikelyFreeModel(provider.name, id),
      }))
      .sort((a, b) => {
        if (a.likelyFree !== b.likelyFree) {
          return a.likelyFree ? -1 : 1;
        }
        return a.id.localeCompare(b.id);
      });

    return { ok: true, data: ranked };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: new HunoError(
        `${provider.name} model listing failed: ${message}`,
        "PROVIDER_MODEL_LIST_FAILED",
        provider.help
      ),
    };
  }
}

function isLikelyFreeModel(providerName: string, modelId: string): boolean {
  const id = modelId.toLowerCase();
  if (/(^|[:/_-])free($|[:/_-])/.test(id)) return true;

  switch (providerName) {
    case "google":
      return /flash|gemma/.test(id);
    case "openrouter":
      return id.includes(":free");
    default:
      return /flash|mini|small|8b|7b|3b|2b|1b|gemma/.test(id);
  }
}
