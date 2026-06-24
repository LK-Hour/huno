export type ContextFiles = {
  projectMap: string | null;
  memory: string | null;
  relevantFiles: { path: string; excerpt: string }[];
};

export type ContextBuildResult = {
  question: string;
  systemPrompt: string;
  userPrompt: string;
  files: ContextFiles;
};
