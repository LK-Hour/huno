import type { ChatMessage } from "../providers/chat.js";

const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  "gpt-4": 8192,
  "gpt-4o": 128000,
  "gpt-4.1": 1047576,
  "gpt-4.1-mini": 1047576,
  "claude-sonnet": 200000,
  "claude-sonnet-4": 200000,
  "gemini-2.0-flash": 1048576,
  "gemini-2.5-pro": 1048576,
  default: 128000,
};

function estimateTokens(messages: ChatMessage[]): number {
  // Rough: 1 token ≈ 4 chars
  return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
}

export function trimToBudget(messages: ChatMessage[], maxTokens: number = MODEL_CONTEXT_LIMITS.default): ChatMessage[] {
  const budget = Math.floor(maxTokens * 0.85); // leave 15% for response
  const total = estimateTokens(messages);

  if (total <= budget) return messages;

  // Keep system messages + trim oldest user/assistant pairs
  const systemMsgs = messages.filter((m) => m.role === "system");
  const chatMsgs = messages.filter((m) => m.role !== "system");

  while (chatMsgs.length > 2 && estimateTokens([...systemMsgs, ...chatMsgs]) > budget) {
    // Remove oldest pair (user + assistant)
    if (chatMsgs[0].role === "user" && chatMsgs[1]?.role === "assistant") {
      chatMsgs.splice(0, 2);
    } else {
      chatMsgs.shift();
    }
  }

  return [...systemMsgs, ...chatMsgs];
}
