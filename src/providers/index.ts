import { loadConfig } from "../core/config.js";
import type { Provider } from "./base.js";
import { OpenRouterProvider } from "./openrouter.js";
import { OllamaProvider } from "./ollama.js";
import { HunoError, Result } from "../utils/errors.js";

export async function getActiveProvider(): Promise<Result<Provider>> {
  const configResult = await loadConfig();
  if (!configResult.ok) {
    return configResult as Result<Provider>;
  }

  const config = configResult.data;
  const providerName = config.defaultProvider || "ollama";
  const model = config.defaultModel;

  switch (providerName) {
    case "openrouter": {
      const apiKey =
        config.apiKeys?.openrouter || process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        return {
          ok: false,
          error: new HunoError(
            "OpenRouter API key not configured.",
            "API_KEY_MISSING",
            "Set OPENROUTER_API_KEY env var or add apiKeys.openrouter to .huno/config.json."
          ),
        };
      }
      return { ok: true, data: new OpenRouterProvider(apiKey, model) };
    }
    case "ollama": {
      return { ok: true, data: new OllamaProvider(model) };
    }
    default: {
      return {
        ok: false,
        error: new HunoError(
          `Unknown provider: ${providerName}`,
          "PROVIDER_UNKNOWN",
          "Supported providers: openrouter, ollama."
        ),
      };
    }
  }
}
