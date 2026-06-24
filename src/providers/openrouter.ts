import OpenAI from "openai";
import { Provider } from "./base.js";
import { HunoError, Result } from "../utils/errors.js";

export class OpenRouterProvider implements Provider {
  readonly name = "openrouter";
  readonly model: string;
  private client: OpenAI;

  constructor(apiKey: string, model?: string) {
    this.model = model || "google/gemini-2.0-flash-001";
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });
  }

  async complete(prompt: string, context: string): Promise<Result<string>> {
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
      if (context) {
        messages.push({ role: "system", content: context });
      }
      messages.push({ role: "user", content: prompt });

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return {
          ok: false,
          error: new HunoError(
            "Empty response from OpenRouter.",
            "PROVIDER_EMPTY_RESPONSE",
            "Try again or check your API key."
          ),
        };
      }
      return { ok: true, data: content };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: new HunoError(
          `OpenRouter request failed: ${message}`,
          "PROVIDER_REQUEST_FAILED",
          "Check your OPENROUTER_API_KEY and internet connection."
        ),
      };
    }
  }
}
