import React from "react";
import { Box, Text, useInput } from "ink";
import { brand, neutral, semantic, risk as riskColors } from "../theme.js";

type RiskLevel = "low" | "medium" | "high";

interface PermissionPromptProps {
  action: string;
  command?: string;
  files?: string[];
  risk: RiskLevel;
  onSelect: (approved: boolean) => void;
}

const riskLabels: Record<RiskLevel, string> = {
  low: "Low Risk",
  medium: "Medium Risk",
  high: "High Risk",
};

export function PermissionPrompt({ action, command, files, risk, onSelect }: PermissionPromptProps): React.ReactElement {
  const [selected, setSelected] = React.useState(true); // true = Allow, false = Deny
  const riskColor = riskColors[risk];

  useInput((input, key) => {
    if (key.leftArrow || key.rightArrow || input === " ") {
      setSelected((prev: boolean) => !prev);
    }
    if (key.return) {
      onSelect(selected);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="double" borderColor={riskColor} paddingX={2} paddingY={1} marginTop={1}>
      <Box justifyContent="space-between">
        <Text color={brand.primary}>Permission Required</Text>
        <Text color={riskColor}>[{riskLabels[risk]}]</Text>
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

      {files && files.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={neutral.muted}>Files:</Text>
          {files.map((f, i) => (
            <Box key={i} paddingLeft={2}>
              <Text color={neutral.dim}>· {f}</Text>
            </Box>
          ))}
        </Box>
      )}

      <Box marginTop={1} gap={2}>
        <Box borderStyle={selected ? "single" : undefined} borderColor={selected ? semantic.success : undefined} paddingX={1}>
          <Text color={selected ? semantic.success : neutral.muted}>{selected ? ">" : " "} Allow</Text>
        </Box>
        <Box borderStyle={!selected ? "single" : undefined} borderColor={!selected ? semantic.error : undefined} paddingX={1}>
          <Text color={!selected ? semantic.error : neutral.muted}>{!selected ? ">" : " "} Deny</Text>
        </Box>
      </Box>
    </Box>
  );
}
