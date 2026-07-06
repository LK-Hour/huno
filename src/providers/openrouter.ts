import { OpenAICompatibleProvider } from "./openai-compatible.js";

export class OpenRouterProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string, model?: string) {
    super({
      name: "openrouter",
      model: model || "meta-llama/llama-4-scout",
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      help: "Check your OPENROUTER_API_KEY and selected OpenRouter model.",
    });
  }
}
