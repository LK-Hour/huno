export type AuditSeverity = "high" | "medium" | "low";

export type AuditIssue = {
  id: string;
  severity: AuditSeverity;
  category: string;
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
};

export type AuditReport = {
  generatedAt: string;
  projectName: string;
  root: string;
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
  issues: AuditIssue[];
};
