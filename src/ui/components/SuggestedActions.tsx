import React from "react";
import { Box, Text } from "ink";
import { brand, neutral } from "../theme.js";

interface SuggestedActionsProps {
  suggestions: string[];
  onSelect: (action: string) => void;
}

export function SuggestedActions({ suggestions, onSelect }: SuggestedActionsProps): React.ReactElement {
  if (suggestions.length === 0) return <Box />;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={neutral.muted}>  Suggested:</Text>
      {suggestions.map((s, i) => (
        <Box key={i} paddingLeft={2}>
          <Text color={brand.secondary}> {">"} </Text>
          <Text color={neutral.body}>{s}</Text>
        </Box>
      ))}
    </Box>
  );
}
