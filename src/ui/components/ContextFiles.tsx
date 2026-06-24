import React from "react";
import { Box, Text } from "ink";
import { brand, neutral, semantic } from "../theme.js";

interface ContextFilesProps {
  files: string[];
  title?: string;
}

export function ContextFiles({
  files,
  title = "Context Files",
}: ContextFilesProps): React.ReactElement {
  if (files.length === 0) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text bold color={brand.secondary}>{title}</Text>
        <Box paddingLeft={2}>
          <Text color={neutral.muted}>(none)</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color={brand.secondary}>{title}</Text>
      {files.map((file, index) => (
        <Box key={index} paddingLeft={2}>
          <Text color={semantic.info}>{"  ├─ "}</Text>
          <Text color={neutral.body}>{file}</Text>
        </Box>
      ))}
    </Box>
  );
}
