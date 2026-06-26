import React from "react";
import { Box, Text } from "ink";
import { brand, neutral, semantic } from "../theme.js";
import { StatusBar, type ReplStatus } from "./StatusBar.js";
import { InputBox } from "./InputBox.js";
import { SuggestedActions } from "./SuggestedActions.js";
import { ToolActivity, type ToolEntry } from "./ToolActivity.js";
import { PermissionPrompt } from "./PermissionPrompt.js";

// ── Types ────────────────────────────────────────────────────────────────

export type ConversationEntry =
  | { type: "user"; content: string }
  | { type: "assistant"; content: string; streaming: boolean }
  | { type: "tool"; entries: ToolEntry[] };

type RiskLevel = "low" | "medium" | "high";

export interface ApprovalData {
  action: string;
  command?: string;
  files?: string[];
  risk: RiskLevel;
}

interface ReplAppProps {
  projectName: string;
  version: string;
  provider?: string;
  model?: string;
  contextFiles?: string[];
  entries: ConversationEntry[];
  status: ReplStatus;
  onSubmit: (input: string) => void;
  onApproval?: (approved: boolean) => void;
  approvalData?: ApprovalData | null;
  suggestions: string[];
}

// ── Entry renderer ───────────────────────────────────────────────────────

function ConversationEntryView({ entry }: { entry: ConversationEntry }): React.ReactElement {
  if (entry.type === "user") {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color={brand.secondary}>  &gt; </Text>
        <Text color={neutral.body}>  {entry.content}</Text>
      </Box>
    );
  }

  if (entry.type === "assistant") {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color={brand.primary}>  ◈</Text>
        <Text color={neutral.body}>{entry.content}</Text>
        {entry.streaming && <Text color={brand.accent}> ◌</Text>}
      </Box>
    );
  }

  if (entry.type === "tool") {
    return <ToolActivity entries={entry.entries} />;
  }

  return <Box />;
}

// ── Main App ─────────────────────────────────────────────────────────────

export function ReplApp({
  projectName,
  version,
  provider,
  model,
  contextFiles,
  entries,
  status,
  onSubmit,
  onApproval,
  approvalData,
  suggestions,
}: ReplAppProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box borderStyle="round" borderColor={brand.primary} paddingX={1} marginBottom={1}>
        <Text color={brand.primary}>Huno</Text>
        <Text color={neutral.dim}> · {projectName} · v{version}</Text>
      </Box>

      {/* Conversation history */}
      {entries.map((entry, i) => (
        <ConversationEntryView entry={entry} key={i} />
      ))}

      {/* Suggested actions */}
      {status === "idle" && suggestions.length > 0 && (
        <SuggestedActions suggestions={suggestions} onSelect={onSubmit} />
      )}

      {/* Approval overlay */}
      {status === "approval" && approvalData && onApproval && (
        <PermissionPrompt
          action={approvalData.action}
          command={approvalData.command}
          files={approvalData.files}
          risk={approvalData.risk}
          onSelect={onApproval}
        />
      )}

      {/* Input box */}
      {status === "idle" && <InputBox onSubmit={onSubmit} />}

      {/* Status bar */}
      <StatusBar
        status={status}
        provider={provider}
        model={model}
        contextFiles={contextFiles?.length}
        messageCount={entries.length}
      />
    </Box>
  );
}
