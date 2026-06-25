import { Provider } from "./base.js";
import { HunoError, Result } from "../utils/errors.js";

export type OpenAICompatibleProviderOptions = {
  name: string;
  model: string;
  apiKey: string;
  baseURL: string;
  help: string;
  defaultHeaders?: Record<string, string>;
};

export class OpenAICompatibleProvider implements Provider {
  readonly name: string;
  readonly model: string;
  private readonly help: string;
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: OpenAICompatibleProviderOptions) {
    this.name = options.name;
    this.model = options.model;
    this.help = options.help;
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL.replace(/\/$/, "");
    this.defaultHeaders = options.defaultHeaders || {};
  }

  async complete(prompt: string, context: string): Promise<Result<string>> {
    try {
      const messages: Array<{ role: "system" | "user"; content: string }> = [];
      if (context) {
        messages.push({ role: "system", content: context });
      }
      messages.push({ role: "user", content: prompt });

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          ...this.defaultHeaders,
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages,
        }),
      });

      const rawBody = await response.text();
      let data: ChatCompletionResponse | null = null;
      try {
        data = rawBody ? (JSON.parse(rawBody) as ChatCompletionResponse) : null;
      } catch {
        // Keep the raw provider response available in the error below.
      }

      if (!response.ok) {
        const providerMessage =
          data?.error?.message || rawBody.slice(0, 300) || response.statusText;
        return {
          ok: false,
          error: new HunoError(
            `${this.name} request failed (${response.status}): ${providerMessage}`,
            "PROVIDER_REQUEST_FAILED",
            this.help
          ),
        };
      }

      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        return {
          ok: false,
          error: new HunoError(
            `Empty response from ${this.name}.`,
            "PROVIDER_EMPTY_RESPONSE",
            this.help
          ),
        };
      }

      return { ok: true, data: content };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: new HunoError(
          `${this.name} request failed: ${message}`,
          "PROVIDER_REQUEST_FAILED",
          this.help
        ),
      };
    }
  }
}

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};
