import React from "react";
import { Box, Text } from "ink";
import { brand, neutral, semantic } from "../theme.js";

export type ToolEntry = {
  toolName: string;
  argsPreview: string;
  status: "running" | "done" | "error";
  result?: string;
};

interface ToolActivityProps {
  entries: ToolEntry[];
}

export function ToolActivity({ entries }: ToolActivityProps): React.ReactElement {
  if (entries.length === 0) return <Box />;

  return (
    <Box flexDirection="column" marginTop={1}>
      {entries.map((entry, i) => {
        const icon = entry.status === "running" ? "◌" : entry.status === "done" ? "✓" : "✗";
        const color = entry.status === "running" ? brand.accent : entry.status === "done" ? semantic.success : semantic.error;

        return (
          <Box key={i}>
            <Text color={color}>  {icon} </Text>
            {entry.status === "running" ? (
              <Text color={neutral.dim}>{entry.toolName}({entry.argsPreview})</Text>
            ) : (
              <Text color={neutral.dim}>{entry.toolName}{entry.result ? " — " + entry.result : ""}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
