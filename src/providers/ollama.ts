import OpenAI from "openai";
import { Provider } from "./base.js";
import { HunoError, Result } from "../utils/errors.js";

export class OllamaProvider implements Provider {
  readonly name = "ollama";
  readonly model: string;
  private client: OpenAI;

  constructor(model?: string, baseUrl?: string) {
    this.model = model || "llama3.2";
    this.client = new OpenAI({
      apiKey: "ollama",
      baseURL: baseUrl || "http://localhost:11434/v1",
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
            "Empty response from Ollama.",
            "PROVIDER_EMPTY_RESPONSE",
            "Make sure Ollama is running and the model is pulled."
          ),
        };
      }
      return { ok: true, data: content };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: new HunoError(
          `Ollama request failed: ${message}`,
          "PROVIDER_REQUEST_FAILED",
          "Make sure Ollama is running (ollama serve) and the model is pulled (ollama pull)."
        ),
      };
    }
  }
}
