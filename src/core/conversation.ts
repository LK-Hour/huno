import type { ChatMessage, StreamingProvider, ToolDefinition, StreamEvent, ToolCall } from "../providers/chat.js";
import { renderUI } from "../ui/renderer.js";
import React from "react";
import { Box, Text } from "ink";
import chalk from "chalk";
import { createInterface } from "readline";

export type ConversationOptions = {
  provider: StreamingProvider;
  tools: ToolDefinition[];
  maxTurns?: number;
  signal?: AbortSignal;
  onStream?: (text: string) => void;
  onToolCall?: (name: string, args: string) => void;
  onApprove?: (toolName: string, args: Record<string, unknown>) => Promise<boolean>;
};

export type Snapshot = {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  undo: () => Promise<string>;
};

export type ConversationResult = {
  messages: ChatMessage[];
  snapshots: Snapshot[];
};

function promptApproval(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(message + " [y/N] ", (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes");
    });
  });
}

export async function runConversation(
  userMessage: string,
  history: ChatMessage[],
  options: ConversationOptions
): Promise<ConversationResult> {
  const { provider, tools, maxTurns = 20, signal } = options;
  const messages: ChatMessage[] = [...history];
  const snapshots: Snapshot[] = [];

  // Append user message
  messages.push({ role: "user", content: userMessage });

  let turns = 0;
  while (turns < maxTurns) {
    turns++;

    // Stream the response
    const stream = provider.chat({ messages, tools, stream: true, signal });

    let assistantContent = "";
    let assistantToolCalls: ToolCall[] = [];
    let firstDelta = true;

    for await (const event of stream) {
      if (event.type === "delta") {
        if (firstDelta && !options.onStream) {
          process.stdout.write("\n");
          firstDelta = false;
        }
        assistantContent += event.content;
        if (options.onStream) {
          options.onStream(event.content);
        } else {
          process.stdout.write(event.content);
        }
      } else if (event.type === "tool_call") {
        if (assistantToolCalls.length === 0 && !options.onStream) {
          process.stdout.write("\n");
        }
        assistantToolCalls.push(event.toolCall);
        if (options.onStream) {
          const tcArgs = event.toolCall.function.arguments.slice(0, 80) + (event.toolCall.function.arguments.length > 80 ? "..." : "");
          process.stdout.write(chalk.dim("  ⚡ " + event.toolCall.function.name + "(" + tcArgs + ")\n"));
        } else if (options.onToolCall) {
          options.onToolCall(event.toolCall.function.name, event.toolCall.function.arguments);
        } else {
          renderUI(
            React.createElement(
              Box,
              { marginTop: 1 },
              React.createElement(
                Text,
                { dimColor: true },
                "  ⚡ " + event.toolCall.function.name + "(" + event.toolCall.function.arguments.slice(0, 80) + (event.toolCall.function.arguments.length > 80 ? "..." : "") + ")"
              )
            )
          );
        }
      } else if (event.type === "error") {
        throw new Error(event.message);
      }
    }

    // If no tool calls, conversation turn is complete
    if (!assistantToolCalls.length) {
      if (assistantContent && !options.onStream) {
        process.stdout.write("\n");
        messages.push({ role: "assistant", content: assistantContent });
      }
      if (assistantContent && options.onStream) {
        messages.push({ role: "assistant", content: assistantContent });
      }
      break;
    }

    // Push assistant message with tool calls
    messages.push({
      role: "assistant",
      content: assistantContent,
      tool_calls: assistantToolCalls,
    });

    // Execute tool calls (with approval) and collect results
    for (const tc of assistantToolCalls) {
      const tool = tools.find((t) => t.name === tc.function.name);
      if (!tool) {
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: 'Error: unknown tool "' + tc.function.name + '"',
        });
        continue;
      }

      let args: Record<string, unknown>;
      try {
        args = JSON.parse(tc.function.arguments || "{}");
      } catch {
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: "Error: invalid JSON arguments",
        });
        continue;
      }

      // Approval check
      if (tool.approval === "always" && options.onApprove) {
        const approved = await options.onApprove(tc.function.name, args);
        if (!approved) {
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: "Denied by user.",
          });
          continue;
        }
      }

      try {
        // Take snapshot before executing (for undo)
        const snapshot = await takeSnapshot(tc.id, tool.name, args);

        const result = await tool.handler(args);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: typeof result === "string" ? result : JSON.stringify(result),
        });

        if (snapshot) {
          snapshots.push(snapshot);
        }
      } catch (err) {
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: "Error: " + (err instanceof Error ? err.message : String(err)),
        });
      }
    }
  }

  return { messages, snapshots };
}

async function takeSnapshot(
  toolCallId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<Snapshot | null> {
  // Only snapshot destructive operations
  if (toolName === "write_file" || toolName === "patch_file") {
    const fs = await import("fs/promises");
    const path = await import("path");
    const { getProjectRoot } = await import("../utils/paths.js");
    const fullPath = path.isAbsolute(args.path as string)
      ? args.path as string
      : path.join(getProjectRoot(), args.path as string);

    let prevContent: string | null = null;
    try {
      prevContent = await fs.readFile(fullPath, "utf-8");
    } catch {
      prevContent = null; // file didn't exist
    }

    return {
      toolCallId,
      toolName,
      args,
      undo: async () => {
        if (prevContent === null) {
          try {
            await fs.unlink(fullPath);
            return "Undid: deleted " + args.path;
          } catch {
            return "Undo failed: could not delete " + args.path;
          }
        } else {
          await fs.writeFile(fullPath, prevContent, "utf-8");
          return "Undid: restored " + args.path;
        }
      },
    };
  }

  if (toolName === "run_command") {
    // For commands, we can't easily undo — just record that it ran
    return {
      toolCallId,
      toolName,
      args,
      undo: async () => "Cannot undo command: " + (args.command as string),
    };
  }

  return null;
}
