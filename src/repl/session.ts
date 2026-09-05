import type { ChatMessage } from "../providers/chat.js";
import type { Snapshot } from "../core/conversation.js";

/**
 * Mutable REPL session state: conversation history, active provider/model
 * overrides, and undo snapshots. Replaces the old module-level `let`s so
 * the REPL loop no longer relies on process-wide singleton state.
 */
export class ReplSession {
  history: ChatMessage[] = [];
  providerName: string | undefined;
  modelName: string | undefined;
  snapshots: Snapshot[] = [];

  /** Full reset — used by /clear, /new, and after a full reconfigure. */
  reset(): void {
    this.history = [];
    this.providerName = undefined;
    this.modelName = undefined;
    this.snapshots = [];
  }
}
