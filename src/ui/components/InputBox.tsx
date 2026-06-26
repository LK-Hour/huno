import React from "react";
import { Box, Text } from "ink";
import { brand, neutral } from "../theme.js";

interface InputBoxProps {
  onSubmit: (value: string) => void;
  placeholder?: string;
}

export function InputBox({ onSubmit, placeholder = "Ask anything about your codebase..." }: InputBoxProps): React.ReactElement {
  const [value, setValue] = React.useState("");
  const { useInput } = require("ink") as { useInput: (handler: (input: string, key: { return?: boolean; backspace?: boolean }) => void) => void };

  useInput((input, key) => {
    if (key.return) {
      if (value.trim()) {
        onSubmit(value.trim());
        setValue("");
      }
    } else if (key.backspace) {
      setValue((prev: string) => prev.slice(0, -1));
    } else if (input && !key.return) {
      setValue((prev: string) => prev + input);
    }
  });

  return (
    <Box marginTop={1}>
      <Text color={brand.secondary}>  &gt; </Text>
      {value.length === 0 ? (
        <Text color={neutral.muted}>{placeholder}</Text>
      ) : (
        <Text color={neutral.body}>{value}</Text>
      )}
    </Box>
  );
}
