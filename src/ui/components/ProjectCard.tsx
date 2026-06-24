import React from "react";
import { Box, Text } from "ink";
import { brand, neutral, semantic } from "../theme.js";

interface ProjectCardProps {
  name: string;
  stack: string;
  filesCount: number;
  status?: "active" | "idle";
}

export function ProjectCard({
  name,
  stack,
  filesCount,
  status = "active",
}: ProjectCardProps): React.ReactElement {
  const statusColor = status === "active" ? semantic.success : neutral.muted;
  const statusIcon = status === "active" ? "●" : "○";

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={brand.primary}
      paddingX={2}
      paddingY={1}
      marginTop={1}
    >
      <Box justifyContent="space-between">
        <Text bold color={brand.primary}>
          {name}
        </Text>
        <Text color={statusColor}>
          {statusIcon} {status}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text color={neutral.muted}>Stack: </Text>
        <Text color={neutral.body}>{stack}</Text>
      </Box>
      <Box>
        <Text color={neutral.muted}>Files: </Text>
        <Text color={neutral.body}>{filesCount}</Text>
      </Box>
    </Box>
  );
}
