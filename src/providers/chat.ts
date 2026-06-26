import type { Config } from "../core/config.js";
import { OpenAICompatibleProvider } from "./openai-compatible.js";
import type { Provider } from "./base.js";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ChatCompletionOptions = {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  stream?: boolean;
  signal?: AbortSignal;
};

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<string> | string;
  approval?: "always" | "never" | "risky";
};

export type ChatCompletionResult = {
  message: ChatMessage;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export type StreamEvent =
  | { type: "delta"; content: string }
  | { type: "tool_call"; toolCall: ToolCall }
  | { type: "done"; result: ChatCompletionResult }
  | { type: "error"; message: string };

export interface StreamingProvider extends Provider {
  chat(options: ChatCompletionOptions): AsyncGenerator<StreamEvent>;
}

export function createStreamingProvider(
  base: OpenAICompatibleProvider,
  _config: Config
): StreamingProvider {
  return {
    name: base.name,
    model: base.model,

    async complete(prompt: string, context: string): Promise<{ ok: true; data: string } | { ok: false; error: any }> {
      const messages: ChatMessage[] = [];
      if (context) messages.push({ role: "system", content: context });
      messages.push({ role: "user", content: prompt });

      let final = "";
      try {
        for await (const event of this.chat({ messages })) {
          if (event.type === "delta") final += event.content;
        }
        return { ok: true, data: final };
      } catch (err) {
        return { ok: false, error: err };
      }
    },

    async *chat(options: ChatCompletionOptions): AsyncGenerator<StreamEvent> {
      const oaiMessages = options.messages.map((m) => {
        if (m.role === "tool") {
          return {
            role: "tool" as const,
            tool_call_id: (m as any).tool_call_id,
            content: (m as any).content,
          };
        }
        if (m.role === "assistant" && m.tool_calls) {
          return {
            role: "assistant" as const,
            content: m.content || null,
            tool_calls: m.tool_calls.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: { name: tc.function.name, arguments: tc.function.arguments },
            })),
          };
        }
        return { role: m.role, content: m.content };
      });

      const tools = options.tools?.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));

      const response = await fetch(`${(base as any).baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${(base as any).apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: base.model,
          messages: oaiMessages,
          tools: tools?.length ? tools : undefined,
          stream: true,
        }),
        signal: options.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        yield { type: "error", message: `${base.name} error (${response.status}): ${body.slice(0, 300)}` };
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        yield { type: "error", message: "No response body stream" };
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let finalMessage: ChatMessage = { role: "assistant", content: "", tool_calls: [] };
      let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            const result: ChatCompletionResult = { message: finalMessage, usage };
            yield { type: "done", result };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const choice = parsed.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta;
            if (delta?.content) {
              finalMessage.content += delta.content;
              yield { type: "delta", content: delta.content };
            }

            if (delta?.tool_calls?.length) {
              for (const tc of delta.tool_calls) {
                const existing = finalMessage.tool_calls!.find((t) => t.id === tc.id);
                if (existing) {
                  existing.function.arguments += tc.function?.arguments || "";
                } else {
                  finalMessage.tool_calls!.push({
                    id: tc.id,
                    type: "function",
                    function: {
                      name: tc.function.name,
                      arguments: tc.function?.arguments || "",
                    },
                  });
                  yield {
                    type: "tool_call",
                    toolCall: finalMessage.tool_calls![finalMessage.tool_calls!.length - 1],
                  };
                }
              }
            }

            if (parsed.usage) {
              usage = parsed.usage;
            }
          } catch {
            // skip malformed SSE chunks
          }
        }
      }

      const result: ChatCompletionResult = { message: finalMessage, usage };
      yield { type: "done", result };
    },
  };
}
