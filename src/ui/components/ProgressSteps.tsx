import React from "react";
import { Box, Text } from "ink";
import { progress, neutral } from "../theme.js";

interface Step {
  label: string;
}

interface ProgressStepsProps {
  steps: Step[];
  current: number; // 0-based index of the active step
}

export function ProgressSteps({ steps, current }: ProgressStepsProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      {steps.map((step, index) => {
        let color: string;
        let icon: string;

        if (index < current) {
          color = progress.done;
          icon = "✔";
        } else if (index === current) {
          color = progress.active;
          icon = "▶";
        } else {
          color = progress.pending;
          icon = "○";
        }

        return (
          <Box key={index} paddingLeft={2}>
            <Text color={color}>
              {icon}  {index + 1}. {step.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
