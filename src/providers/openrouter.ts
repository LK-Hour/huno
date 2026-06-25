import { OpenAICompatibleProvider } from "./openai-compatible.js";

export class OpenRouterProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string, model?: string) {
    super({
      name: "openrouter",
      model: model || "google/gemini-2.0-flash-001",
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      help: "Check your OPENROUTER_API_KEY and selected OpenRouter model.",
    });
  }
}
