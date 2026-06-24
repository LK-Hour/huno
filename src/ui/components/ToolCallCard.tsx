import React from "react";
import { Box, Text } from "ink";
import { brand, neutral, semantic } from "../theme.js";

interface ToolCallCardProps {
  toolName: string;
  input?: Record<string, unknown>;
  result?: string;
  success?: boolean;
}

export function ToolCallCard({
  toolName,
  input,
  result,
  success = true,
}: ToolCallCardProps): React.ReactElement {
  const statusColor = success ? semantic.success : semantic.error;
  const statusLabel = success ? "success" : "error";

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={success ? brand.secondary : semantic.error}
      paddingX={2}
      paddingY={1}
      marginTop={1}
    >
      <Box justifyContent="space-between">
        <Text bold color={brand.secondary}>⚙  {toolName}</Text>
        <Text color={statusColor}>{statusLabel}</Text>
      </Box>

      {input && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={neutral.muted}>Input:</Text>
          {Object.entries(input).map(([key, value]) => (
            <Box key={key} paddingLeft={2}>
              <Text color={neutral.dim}>{key}: </Text>
              <Text color={neutral.body}>
                {typeof value === "string" ? value : JSON.stringify(value)}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {result && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={neutral.muted}>Result:</Text>
          <Box paddingLeft={2}>
            <Text color={neutral.body}>{result}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
