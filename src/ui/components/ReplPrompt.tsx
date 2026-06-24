import React from "react";
import { Box, Text } from "ink";
import { brand, neutral } from "../theme.js";

interface ReplPromptProps {
  projectName: string;
  input: string;
  isLoading: boolean;
}

export function ReplPrompt({ projectName, input, isLoading }: ReplPromptProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={brand.primary}>  </Text>
        <Text color={neutral.muted}>{projectName}</Text>
        <Text color={neutral.dim}> · </Text>
        <Text color={neutral.dim}>huno</Text>
      </Box>
      <Box>
        <Text color={brand.secondary}>{"> "}</Text>
        <Text color={neutral.body}>{input}</Text>
        {isLoading && (
          <Text color={brand.accent}> ...</Text>
        )}
      </Box>
    </Box>
  );
}
