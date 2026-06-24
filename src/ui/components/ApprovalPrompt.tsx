import React from "react";
import { Box, Text } from "ink";
import { brand, neutral, risk as riskColors, semantic } from "../theme.js";

type RiskLevel = "low" | "medium" | "high";

interface ApprovalPromptProps {
  action: string;
  files?: string[];
  reason?: string;
  risk: RiskLevel;
  command?: string;
}

const riskLabels: Record<RiskLevel, string> = {
  low: "Low Risk",
  medium: "Medium Risk",
  high: "High Risk",
};

export function ApprovalPrompt({
  action,
  files,
  reason,
  risk,
  command,
}: ApprovalPromptProps): React.ReactElement {
  const riskColor = riskColors[risk];

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={riskColor}
      paddingX={2}
      paddingY={1}
      marginTop={1}
    >
      <Box justifyContent="space-between">
        <Text bold color={brand.primary}>Approval Required</Text>
        <Text bold color={riskColor}>
          [{riskLabels[risk]}]
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color={neutral.muted}>Action: </Text>
        <Text color={neutral.heading}>{action}</Text>
      </Box>

      {command && (
        <Box marginTop={1}>
          <Text color={neutral.muted}>Command: </Text>
          <Text color={semantic.info}>{command}</Text>
        </Box>
      )}

      {reason && (
        <Box marginTop={1}>
          <Text color={neutral.muted}>Reason: </Text>
          <Text color={neutral.body}>{reason}</Text>
        </Box>
      )}

      {files && files.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={neutral.muted}>Files affected:</Text>
          {files.map((file, index) => (
            <Box key={index} paddingLeft={2}>
              <Text color={neutral.dim}>• </Text>
              <Text color={neutral.body}>{file}</Text>
            </Box>
          ))}
        </Box>
      )}

      <Box marginTop={1} borderStyle="single" borderColor={neutral.border} paddingX={1}>
        <Text color={neutral.dim}>
          Approve? {risk === "high" ? "[y/N]" : "[Y/n]"}
        </Text>
      </Box>
    </Box>
  );
}
