import React from "react";
import { Box, Text } from "ink";
import { brand, neutral, semantic } from "../theme.js";

type ReplStatus = "idle" | "streaming" | "approval";

interface StatusBarProps {
  provider?: string;
  model?: string;
  contextFiles?: number;
  messageCount?: number;
  status: ReplStatus;
}

export function StatusBar({ provider, model, contextFiles = 0, messageCount = 0, status }: StatusBarProps): React.ReactElement {
  const stateIcon = status === "streaming" ? "◌" : status === "approval" ? "!" : "●";
  const stateColor = status === "streaming" ? brand.accent : status === "approval" ? semantic.warning : brand.secondary;

  return (
    <Box marginTop={1} borderStyle="single" borderColor={neutral.border} paddingX={1}>
      <Text color={stateColor}>{stateIcon} </Text>
      <Text color={neutral.dim}>{provider || "none"} · {model || "none"}</Text>
      {contextFiles > 0 && <Text color={neutral.muted}> · {contextFiles} ctx</Text>}
      {messageCount > 0 && <Text color={neutral.muted}> · {messageCount} msgs</Text>}
    </Box>
  );
}

export type { ReplStatus };
