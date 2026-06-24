import React from "react";
import { Box, Text } from "ink";
import { brand, neutral } from "../theme.js";

interface HeaderProps {
  tagline?: string;
}

export function Header({ tagline = "Your AI project assistant" }: HeaderProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={brand.primary}>
        {"  ██╗  ██╗██╗   ██╗███╗   ██╗ ██████╗ "}
      </Text>
      <Text bold color={brand.primary}>
        {"  ██║  ██║██║   ██║████╗  ██║██╔═══██╗"}
      </Text>
      <Text bold color={brand.primary}>
        {"  ███████║██║   ██║██╔██╗ ██║██║   ██║"}
      </Text>
      <Text bold color={brand.primary}>
        {"  ██╔══██║██║   ██║██║╚██╗██║██║   ██║"}
      </Text>
      <Text bold color={brand.primary}>
        {"  ██║  ██║╚██████╔╝██║ ╚████║╚██████╔╝"}
      </Text>
      <Text bold color={brand.primary}>
        {"  ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ "}
      </Text>
      <Box marginTop={1}>
        <Text color={neutral.dim}>{tagline}</Text>
      </Box>
    </Box>
  );
}
