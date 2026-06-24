import React from "react";
import { Box, Text } from "ink";
import { neutral, semantic } from "../theme.js";

interface WarningBoxProps {
  message: string;
  title?: string;
}

export function WarningBox({
  message,
  title = "Warning",
}: WarningBoxProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={semantic.warning}
      paddingX={2}
      paddingY={1}
      marginTop={1}
    >
      <Text bold color={semantic.warning}>
        ⚠  {title}
      </Text>
      <Box marginTop={1}>
        <Text color={neutral.body}>{message}</Text>
      </Box>
    </Box>
  );
}
