import { Provider } from "./base.js";
import { HunoError, Result } from "../utils/errors.js";

export class OllamaProvider implements Provider {
  readonly name = "ollama";
  readonly model: string;
  private readonly baseURL: string;

  constructor(model?: string, baseUrl?: string) {
    this.model = model || "llama3.2";
    this.baseURL = (baseUrl || "http://localhost:11434/v1").replace(/\/$/, "");
  }

  async complete(prompt: string, context: string): Promise<Result<string>> {
    try {
      const messages: Array<{ role: string; content: string }> = [];
      if (context) {
        messages.push({ role: "system", content: context });
      }
      messages.push({ role: "user", content: prompt });

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer ollama",
        },
        body: JSON.stringify({ model: this.model, messages }),
      });

      if (!response.ok) {
        return {
          ok: false,
          error: new HunoError(
            `Ollama request failed: ${response.status} ${response.statusText}`,
            "PROVIDER_REQUEST_FAILED",
            "Make sure Ollama is running (ollama serve) and the model is pulled."
          ),
        };
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content;
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
