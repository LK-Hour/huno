import React from "react";
import { Box, Text } from "ink";
import { brand, neutral, semantic } from "../theme.js";

type Severity = "info" | "warning" | "error" | "critical";

interface AuditFinding {
  severity: Severity;
  category: string;
  message: string;
  file?: string;
}

interface AuditTableProps {
  findings: AuditFinding[];
  title?: string;
}

const severityIcons: Record<Severity, string> = {
  info: "ℹ",
  warning: "⚠",
  error: "✖",
  critical: "‼",
};

const severityColors: Record<Severity, string> = {
  info: semantic.info,
  warning: semantic.warning,
  error: semantic.error,
  critical: semantic.error,
};

const severityOrder: Record<Severity, number> = {
  critical: 0,
  error: 1,
  warning: 2,
  info: 3,
};

export function AuditTable({
  findings,
  title = "Audit Results",
}: AuditTableProps): React.ReactElement {
  if (findings.length === 0) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text bold color={brand.secondary}>{title}</Text>
        <Box paddingLeft={2} marginTop={1}>
          <Text color={semantic.success}>✔  No issues found.</Text>
        </Box>
      </Box>
    );
  }

  // Sort by severity (critical first)
  const sorted = [...findings].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color={brand.secondary}>
        {title} ({findings.length} {findings.length === 1 ? "finding" : "findings"})
      </Text>

      {/* Header row */}
      <Box marginTop={1} paddingLeft={1}>
        <Text bold color={neutral.muted}>
          {"  Sev.  Category           Message"}
        </Text>
      </Box>
      <Box>
        <Text color={neutral.border}>
          {"  ─────────────────────────────────────────────"}
        </Text>
      </Box>

      {sorted.map((finding, index) => {
        const color = severityColors[finding.severity];
        const icon = severityIcons[finding.severity];
        const sev = finding.severity.toUpperCase().padEnd(6);
        const cat = finding.category.padEnd(18);

        return (
          <Box key={index} paddingLeft={1}>
            <Text color={color}>
              {icon} {sev} {cat} {finding.message}
            </Text>
            {finding.file && (
              <Text color={neutral.dim}>
                {" ".repeat(30)}→ {finding.file}
              </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
