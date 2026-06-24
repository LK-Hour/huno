import React from "react";
import { Box, Text } from "ink";
import { neutral, semantic } from "../theme.js";

interface ErrorBoxProps {
  message: string;
  code?: string;
  hint?: string;
}

export function ErrorBox({
  message,
  code,
  hint,
}: ErrorBoxProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={semantic.error}
      paddingX={2}
      paddingY={1}
      marginTop={1}
    >
      <Text bold color={semantic.error}>
        ✖  Error{code ? ` [${code}]` : ""}
      </Text>
      <Box marginTop={1}>
        <Text color={neutral.body}>{message}</Text>
      </Box>
      {hint && (
        <Box marginTop={1}>
          <Text color={neutral.dim}>💡 {hint}</Text>
        </Box>
      )}
    </Box>
  );
}
