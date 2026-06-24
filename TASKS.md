# TASKS.md

> Implementation roadmap and execution checklist for **Huno**.

This document tells implementation agents exactly what to build, in what order, and how to verify each milestone.

Read this together with:

```text
README.md          → product vision and high-level feature set
AGENTS.md          → rules for AI agents working on this project
ARCHITECTURE.md    → internal technical architecture
PRODUCT_SPEC.md    → exact product behavior and command requirements
TASKS.md           → implementation roadmap and checklist
```

---

## 1. Purpose of This File

This file exists to prevent agents from guessing.

When an implementation agent works on Huno, it should not start with:

```text
Build the whole product.
```

Instead, it should follow small controlled milestones.

Each milestone includes:

- Goal
- Scope
- Files to create or modify
- Tasks
- Acceptance criteria
- Validation commands
- Stop conditions

The agent must complete one milestone at a time.

---

## 2. Implementation Rule

Agents must follow this rule:

> **Do not move to the next milestone until the current milestone passes its acceptance criteria.**

If a milestone cannot be fully completed, the agent must stop and report:

```text
What was completed
What failed
Why it failed
What files changed
What validation was run
What should be done next
```

Agents must not silently skip failed tasks.

---

## 3. Current Strategic Direction

Huno should be built in this order:

```text
Milestone 0: Repository preparation
Milestone 1: CLI foundation
Milestone 2: Local .huno project storage
Milestone 3: Project scanner
Milestone 4: Project map
Milestone 5: huno init
Milestone 6: huno explain
Milestone 7: Memory system
Milestone 8: huno remember / huno recall
Milestone 9: Audit engine
Milestone 10: huno audit
Milestone 11: Provider abstraction
Milestone 12: Context builder
Milestone 13: huno ask
Milestone 14: Terminal UI polish
Milestone 15: Documentation generator
Milestone 16: Permission and risk system
Milestone 17: Safe command runner
Milestone 18: Safe file editing
Milestone 19: Multi-agent system
Milestone 20: Packaging and release
```

The first real implementation target should be:

```bash
huno init
huno explain
```

These two commands create the foundation without requiring AI model providers.

---

## 4. Global Development Standards

These apply to every milestone.

## 4.1 Required Behavior

Every implemented command must:

- Work from the terminal
- Handle missing files gracefully
- Produce clear output
- Avoid fake success messages
- Avoid silent failures
- Avoid printing secrets
- Return meaningful exit codes
- Avoid unrelated changes

## 4.2 Required Validation

When possible, run:

```bash
pnpm typecheck
pnpm test
pnpm build
```

If these commands do not exist yet, create them when the milestone requires it.

## 4.3 Required Agent Report

At the end of every implementation session, the agent should report:

```text
Completed:
- ...

Changed files:
- ...

Validation:
- ...

Not completed:
- ...

Next recommended task:
- ...
```

## 4.4 No Fake Validation

Do not claim validation passed unless the command was actually run.

Correct:

```text
Validation:
- Ran `pnpm build` successfully.
```

Correct:

```text
Validation:
- Not run. The project does not have a build script yet.
```

Incorrect:

```text
Tests should pass.
```

---

## 5. Milestone 0: Repository Preparation

## Goal

Prepare the repository documentation and baseline files so implementation agents have enough context.

## Status

Documentation preparation milestone.

## Scope

Create or ensure these files exist:

```text
README.md
AGENTS.md
ARCHITECTURE.md
PRODUCT_SPEC.md
TASKS.md
.env.example
.gitignore
.hunoignore
LICENSE
```

## Tasks

```text
[ ] Ensure README.md exists.
[ ] Ensure AGENTS.md exists.
[ ] Ensure ARCHITECTURE.md exists.
[ ] Ensure PRODUCT_SPEC.md exists.
[ ] Ensure TASKS.md exists.
[ ] Create .env.example.
[ ] Create .gitignore.
[ ] Create .hunoignore.
[ ] Choose initial license.
```

## Recommended `.env.example`

```bash
OPENROUTER_API_KEY=
GEMINI_API_KEY=
NVIDIA_API_KEY=
GROQ_API_KEY=
MISTRAL_API_KEY=
CEREBRAS_API_KEY=
```

## Recommended `.gitignore`

```gitignore
node_modules/
dist/
build/
coverage/
.env
.env.*
!.env.example
.DS_Store
.huno/cache/
.huno/logs/
*.log
```

## Recommended `.hunoignore`

```gitignore
.git/
node_modules/
dist/
build/
.next/
coverage/
.cache/
venv/
.venv/
__pycache__/
.pytest_cache/
.env
.env.*
*.log
*.pem
*.key
```

## Acceptance Criteria

```text
[ ] Documentation files exist.
[ ] .env.example exists and contains provider env names.
[ ] .gitignore exists.
[ ] .hunoignore exists.
[ ] No secrets are committed.
```

## Stop Condition

Stop after repository preparation is complete.

Do not implement application code in this milestone unless explicitly instructed.

---

## 6. Milestone 1: CLI Foundation

## Goal

Create a working TypeScript npm CLI package with a `huno` command.

## Scope

This milestone should only create the basic CLI skeleton.

No project scanning yet.

No AI providers yet.

No memory system yet.

## Files to Create

```text
package.json
tsconfig.json
src/index.ts
src/utils/errors.ts
src/utils/logger.ts
```

Optional:

```text
src/types/result.ts
```

## Dependencies

Required:

```text
commander
```

Development dependencies:

```text
typescript
tsx
@types/node
```

Optional but useful:

```text
vitest
```

## Tasks

```text
[ ] Create package.json.
[ ] Configure package as ESM.
[ ] Add CLI binary field for `huno`.
[ ] Add TypeScript config.
[ ] Create src/index.ts with shebang.
[ ] Register base CLI command.
[ ] Add --help support.
[ ] Add --version support.
[ ] Add placeholder command registration structure.
[ ] Add scripts: dev, build, typecheck.
[ ] Confirm CLI runs locally.
```

## Minimum `package.json`

```json
{
  "name": "huno",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "huno": "./dist/index.js"
  },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "commander": "^14.0.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

## Minimum `src/index.ts`

```ts
#!/usr/bin/env node

import { Command } from "commander";

const program = new Command();

program
  .name("huno")
  .description("Project-aware AI developer tool")
  .version("0.1.0");

program.parse();
```

## Validation Commands

```bash
pnpm install
pnpm dev -- --help
pnpm dev -- --version
pnpm typecheck
pnpm build
```

## Acceptance Criteria

```text
[ ] `pnpm install` works.
[ ] `pnpm dev -- --help` works.
[ ] `pnpm dev -- --version` works.
[ ] `pnpm typecheck` passes.
[ ] `pnpm build` passes.
[ ] dist/index.js is created after build.
[ ] CLI does not crash when run with no arguments.
```

## Stop Condition

Stop after the CLI skeleton works.

Do not add project scanner in this milestone unless explicitly instructed.

---

## 7. Milestone 2: Local `.huno` Project Storage

## Goal

Implement utilities for creating and managing the local `.huno/` directory.

## Scope

Create storage functions only.

Do not implement the full `huno init` command yet unless combining with Milestone 5 is explicitly requested.

## Files to Create

```text
src/storage/huno-dir.ts
src/storage/config-store.ts
src/storage/memory-store.ts
src/storage/project-map-store.ts
src/storage/history-store.ts
src/utils/paths.ts
src/types/config.ts
```

## `.huno` Structure

```text
.huno/
├── config.json
├── memory.md
├── project-map.json
├── history.jsonl
├── logs/
└── cache/
```

## Tasks

```text
[ ] Create path resolution utility.
[ ] Create function to find project root.
[ ] Create function to resolve .huno path.
[ ] Create function to check if .huno exists.
[ ] Create function to create .huno directory.
[ ] Create default config object.
[ ] Create default memory file content.
[ ] Create default project-map placeholder.
[ ] Create empty history file.
[ ] Create logs directory.
[ ] Create cache directory.
[ ] Ensure existing files are not overwritten.
```

## Required Functions

Suggested:

```ts
resolveProjectRoot(cwd?: string): string
getHunoDir(root: string): string
isHunoInitialized(root: string): Promise<boolean>
ensureHunoDir(root: string): Promise<void>
ensureDefaultHunoFiles(root: string): Promise<InitResult>
```

## Init Result Type

```ts
type InitFileStatus = {
  path: string;
  status: "created" | "exists" | "skipped";
};

type InitResult = {
  root: string;
  hunoDir: string;
  files: InitFileStatus[];
};
```

## Validation Commands

```bash
pnpm typecheck
pnpm build
```

## Acceptance Criteria

```text
[ ] Storage utilities create .huno correctly.
[ ] Existing files are not overwritten.
[ ] Default config is valid JSON.
[ ] Default memory is valid Markdown.
[ ] Default project-map is valid JSON.
[ ] TypeScript passes.
```

## Stop Condition

Stop after storage utilities work.

---

## 8. Milestone 3: Project Scanner

## Goal

Implement a rule-based scanner that detects basic project structure.

## Scope

The scanner should work without AI.

The scanner should not read the entire content of every source file.

It should detect structure, config, frameworks, scripts, and important files.

## Files to Create

```text
src/core/scanner.ts
src/types/project.ts
src/utils/ignore.ts
src/utils/fs.ts
```

## Tasks

```text
[ ] Define ProjectMap type.
[ ] Define ProjectStack type.
[ ] Define ImportantFile type.
[ ] Define ImportantDirectory type.
[ ] Implement ignored directory rules.
[ ] Detect package.json.
[ ] Detect package manager.
[ ] Detect TypeScript.
[ ] Detect Next.js.
[ ] Detect React.
[ ] Detect Vite.
[ ] Detect Python.
[ ] Detect FastAPI.
[ ] Detect Docker.
[ ] Detect README.
[ ] Detect LICENSE.
[ ] Detect .env.example.
[ ] Detect test directories.
[ ] Detect Git repository.
[ ] Extract package.json scripts.
[ ] Extract package dependencies summary.
[ ] Generate warnings.
```

## Must Ignore

```text
.git/
node_modules/
dist/
build/
.next/
coverage/
.cache/
venv/
.venv/
__pycache__/
.pytest_cache/
.huno/cache/
```

## Recommended ProjectMap Type

```ts
export type ProjectMap = {
  version: string;
  projectName: string;
  root: string;
  generatedAt: string;
  stack: ProjectStack;
  packageManagers: string[];
  importantFiles: ImportantFile[];
  importantDirectories: ImportantDirectory[];
  scripts: Record<string, string>;
  warnings: ProjectWarning[];
};
```

## Validation Commands

```bash
pnpm typecheck
pnpm build
```

Optional if tests exist:

```bash
pnpm test
```

## Acceptance Criteria

```text
[ ] Scanner works without AI provider.
[ ] Scanner detects a basic Node project.
[ ] Scanner detects package manager from lockfile.
[ ] Scanner detects TypeScript from tsconfig.json.
[ ] Scanner detects Next.js from next config or dependency.
[ ] Scanner detects Python/FastAPI from requirements or source hints.
[ ] Scanner detects Docker files.
[ ] Scanner respects ignored directories.
[ ] Scanner returns warnings for missing docs/config.
```

## Stop Condition

Stop after scanner returns a usable ProjectMap object.

---

## 9. Milestone 4: Project Map Storage

## Goal

Save and load project maps from `.huno/project-map.json`.

## Scope

This milestone connects scanner output to local storage.

## Files to Create or Modify

```text
src/storage/project-map-store.ts
src/core/project-map.ts
src/types/project.ts
```

## Tasks

```text
[ ] Implement saveProjectMap.
[ ] Implement loadProjectMap.
[ ] Implement hasProjectMap.
[ ] Implement safe JSON writing.
[ ] Handle corrupted project-map.json gracefully.
[ ] Add generatedAt timestamp when saving.
[ ] Ensure project map can be regenerated.
```

## Behavior

If `.huno/` exists:

```text
huno explain should later save the generated project map.
```

If `.huno/` does not exist:

```text
Scanner can still run, but map is not saved.
```

## Validation Commands

```bash
pnpm typecheck
pnpm build
```

## Acceptance Criteria

```text
[ ] Project map can be saved.
[ ] Project map can be loaded.
[ ] Corrupted JSON produces a useful error.
[ ] Save does not fail if .huno exists.
[ ] TypeScript passes.
```

## Stop Condition

Stop when scanner output can be persisted and loaded.

---

## 10. Milestone 5: `huno init`

## Goal

Implement the real `huno init` command.

## Scope

This command initializes local Huno storage.

No AI provider needed.

No scanner required, although project name can be inferred from directory name.

## Files to Create or Modify

```text
src/commands/init.ts
src/index.ts
src/storage/huno-dir.ts
src/storage/config-store.ts
src/storage/memory-store.ts
src/storage/history-store.ts
src/ui/renderer.tsx or src/ui/basic-renderer.ts
```

## Tasks

```text
[ ] Register `huno init` in CLI.
[ ] Resolve project root.
[ ] Create .huno directory.
[ ] Create config.json.
[ ] Create memory.md.
[ ] Create project-map.json placeholder.
[ ] Create history.jsonl.
[ ] Create logs directory.
[ ] Create cache directory.
[ ] Avoid overwriting existing files.
[ ] Print created/existing file status.
[ ] Suggest `huno explain`.
[ ] Return non-zero exit code on failure.
```

## Expected Output

```text
Huno initialized this project.

Created:
✓ .huno/config.json
✓ .huno/memory.md
✓ .huno/project-map.json
✓ .huno/history.jsonl
✓ .huno/logs/
✓ .huno/cache/

Next step:
huno explain
```

## Existing Project Output

```text
Huno is already initialized.

Found:
✓ .huno/config.json
✓ .huno/memory.md
✓ .huno/history.jsonl

Next step:
huno explain
```

## Validation Commands

```bash
pnpm dev -- init
pnpm typecheck
pnpm build
```

Manual check:

```bash
ls -la .huno
cat .huno/config.json
cat .huno/memory.md
```

## Acceptance Criteria

```text
[ ] `huno init` command exists.
[ ] Creates all required .huno files/directories.
[ ] Does not overwrite existing files silently.
[ ] Works without API key.
[ ] Prints clear result.
[ ] Suggests `huno explain`.
[ ] TypeScript passes.
[ ] Build passes.
```

## Stop Condition

Stop after `huno init` works.

---

## 11. Milestone 6: `huno explain`

## Goal

Implement `huno explain` using the rule-based project scanner.

## Scope

No AI provider needed.

The command should scan the current project, summarize it, and save `.huno/project-map.json` if initialized.

## Files to Create or Modify

```text
src/commands/explain.ts
src/index.ts
src/core/scanner.ts
src/storage/project-map-store.ts
src/ui/components/ProjectCard.tsx
src/ui/renderer.tsx or src/ui/basic-renderer.ts
```

## Tasks

```text
[ ] Register `huno explain`.
[ ] Resolve project root.
[ ] Run project scanner.
[ ] Build ProjectMap.
[ ] Save project map if .huno exists.
[ ] Render project name.
[ ] Render detected stack.
[ ] Render package manager.
[ ] Render important files.
[ ] Render important directories.
[ ] Render scripts.
[ ] Render warnings.
[ ] Suggest next commands.
[ ] Support --json.
[ ] Support missing .huno gracefully.
```

## Expected Output

```text
Huno Project Intelligence

Project:
- Name: huno
- Root: /path/to/huno

Detected Stack:
- Language: TypeScript
- Runtime: Node.js
- Package Manager: pnpm

Important Files:
- package.json
- tsconfig.json
- README.md

Available Scripts:
- dev
- build
- typecheck

Warnings:
- No test script found

Suggested next commands:
- huno audit
- huno remember "important project decision"
```

## JSON Output

Command:

```bash
huno explain --json
```

Must output valid JSON only.

No terminal cards, symbols, or prose outside JSON.

## Validation Commands

```bash
pnpm dev -- explain
pnpm dev -- explain --json
pnpm typecheck
pnpm build
```

## Acceptance Criteria

```text
[ ] `huno explain` works without API key.
[ ] Detects basic stack.
[ ] Detects package manager.
[ ] Shows important files and directories.
[ ] Shows scripts.
[ ] Shows warnings.
[ ] Saves .huno/project-map.json when initialized.
[ ] Works even if .huno does not exist.
[ ] --json outputs valid JSON only.
[ ] TypeScript passes.
[ ] Build passes.
```

## Stop Condition

Stop after `huno init` and `huno explain` both work.

This is the first major demo point.

---

## 12. Milestone 7: Memory System

## Goal

Implement core memory functions for project notes.

## Scope

This milestone creates memory logic but does not necessarily expose commands yet.

## Files to Create or Modify

```text
src/core/memory.ts
src/storage/memory-store.ts
src/types/memory.ts
```

## Tasks

```text
[ ] Define MemoryEntry type.
[ ] Load memory.md.
[ ] Append timestamped memory.
[ ] Search memory by query.
[ ] Preserve existing memory sections.
[ ] Handle missing memory file.
[ ] Handle empty memory file.
[ ] Avoid destructive rewrites.
```

## Required Features

```text
appendMemory(note: string, options?: { tags?: string[] }): Promise<void>
searchMemory(query: string): Promise<MemorySearchResult[]>
loadMemory(): Promise<string>
```

## Validation Commands

```bash
pnpm typecheck
pnpm build
```

Optional tests:

```bash
pnpm test
```

## Acceptance Criteria

```text
[ ] Can append memory.
[ ] Can search memory.
[ ] Existing memory is preserved.
[ ] Missing .huno produces clear error.
[ ] Works without provider.
```

## Stop Condition

Stop after memory core works.

---

## 13. Milestone 8: `huno remember` and `huno recall`

## Goal

Expose memory system through CLI commands.

## Scope

Implement two user-facing commands.

No AI provider needed.

## Files to Create or Modify

```text
src/commands/remember.ts
src/commands/recall.ts
src/index.ts
src/core/memory.ts
src/storage/memory-store.ts
```

## Tasks: `huno remember`

```text
[ ] Register `huno remember <note>`.
[ ] Validate note is not empty.
[ ] Ensure .huno exists.
[ ] Append timestamped note.
[ ] Confirm saved memory.
[ ] Suggest recall command.
```

## Tasks: `huno recall`

```text
[ ] Register `huno recall <query>`.
[ ] Validate query is not empty.
[ ] Ensure memory file exists.
[ ] Search memory.
[ ] Render matching results.
[ ] Handle no results.
```

## Expected `remember` Output

```text
Saved memory:

"The backend uses FastAPI and SQLAlchemy."

You can recall it with:
huno recall backend
```

## Expected `recall` Output

```text
Memory results for: backend

1. 2026-06-24:
   The backend uses FastAPI and SQLAlchemy.
```

## Validation Commands

```bash
pnpm dev -- remember "The project uses TypeScript."
pnpm dev -- recall TypeScript
pnpm typecheck
pnpm build
```

## Acceptance Criteria

```text
[ ] `huno remember` appends memory.
[ ] `huno recall` finds memory.
[ ] Empty input is handled.
[ ] Missing .huno is handled with suggestion to run init.
[ ] Works without provider.
[ ] TypeScript passes.
[ ] Build passes.
```

## Stop Condition

Stop after both commands work.

---

## 14. Milestone 9: Audit Engine

## Goal

Create rule-based project audit logic.

## Scope

This milestone creates the audit engine but does not need to expose CLI yet.

No AI provider required.

## Files to Create

```text
src/core/audit.ts
src/types/audit.ts
```

## Audit Categories

```text
docs
testing
security
architecture
dependencies
developer-experience
configuration
```

## Initial Rule-Based Checks

```text
[ ] Missing README.md.
[ ] Missing LICENSE.
[ ] Missing .env.example.
[ ] Missing test script.
[ ] Missing build script.
[ ] Missing tests directory.
[ ] Multiple package manager lockfiles.
[ ] TypeScript strict mode disabled.
[ ] Docker files exist but README does not mention Docker.
[ ] TODO/FIXME comments exist.
[ ] Potential committed secrets.
[ ] Large source files.
[ ] Missing .gitignore.
[ ] Missing .hunoignore.
```

## Audit Issue Type

```ts
type AuditIssue = {
  id: string;
  title: string;
  severity: "high" | "medium" | "low" | "info";
  category:
    | "docs"
    | "testing"
    | "security"
    | "architecture"
    | "dependencies"
    | "developer-experience"
    | "configuration";
  evidence: string[];
  recommendation: string;
  confidence: "high" | "medium" | "low";
};
```

## Validation Commands

```bash
pnpm typecheck
pnpm build
```

Optional tests:

```bash
pnpm test
```

## Acceptance Criteria

```text
[ ] Audit engine runs without AI.
[ ] Issues include evidence.
[ ] Issues include recommendations.
[ ] Severity is assigned.
[ ] No invented issues.
[ ] Empty project is handled.
```

## Stop Condition

Stop after audit engine returns structured report.

---

## 15. Milestone 10: `huno audit`

## Goal

Expose audit engine through CLI.

## Scope

Implement `huno audit`.

No AI provider required for basic audit.

## Files to Create or Modify

```text
src/commands/audit.ts
src/index.ts
src/core/audit.ts
src/types/audit.ts
src/ui/components/AuditTable.tsx
```

## Tasks

```text
[ ] Register `huno audit`.
[ ] Run project scanner.
[ ] Run audit engine.
[ ] Render issues by severity.
[ ] Render evidence.
[ ] Render recommendations.
[ ] Render strengths if available.
[ ] Support --json.
[ ] Save history entry if .huno exists.
```

## Expected Output

```text
Huno Audit Report

High Priority:
1. Missing .env.example
   Evidence:
   - No .env.example file found.
   Recommendation:
   - Add .env.example with required environment variables.

Medium Priority:
1. No test script found
   Evidence:
   - package.json does not define a test script.
   Recommendation:
   - Add a test script or document why tests are not used.

Strengths:
- README.md found.
- TypeScript config found.
```

## Validation Commands

```bash
pnpm dev -- audit
pnpm dev -- audit --json
pnpm typecheck
pnpm build
```

## Acceptance Criteria

```text
[ ] `huno audit` works without provider.
[ ] Issues are evidence-backed.
[ ] JSON output is valid JSON only.
[ ] Empty projects are handled.
[ ] TypeScript passes.
[ ] Build passes.
```

## Stop Condition

Stop after audit command works.

---

## 16. Milestone 11: Provider Abstraction

## Goal

Create a provider layer that can support multiple AI providers.

## Scope

Implement provider interfaces and at least one mock provider.

Do not build `huno ask` yet unless explicitly instructed.

## Files to Create

```text
src/providers/base.ts
src/providers/mock.ts
src/providers/openai-compatible.ts
src/providers/openrouter.ts
src/providers/ollama.ts
src/core/provider-router.ts
src/types/provider.ts
```

## Tasks

```text
[ ] Define ChatMessage type.
[ ] Define ModelProvider interface.
[ ] Define GenerateOptions type.
[ ] Define provider error type.
[ ] Implement MockProvider.
[ ] Implement provider router.
[ ] Implement missing API key error.
[ ] Implement OpenAI-compatible base provider.
[ ] Prepare OpenRouter provider.
[ ] Prepare Ollama provider structure.
```

## Provider Interface

```ts
export interface ModelProvider {
  name: string;
  generate(messages: ChatMessage[], options?: GenerateOptions): Promise<string>;
  stream?(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): AsyncIterable<StreamChunk>;
}
```

## Validation Commands

```bash
pnpm typecheck
pnpm build
```

Optional:

```bash
pnpm test
```

## Acceptance Criteria

```text
[ ] Commands do not depend on one provider.
[ ] MockProvider works.
[ ] Missing provider config gives useful error.
[ ] Provider router can select default provider.
[ ] TypeScript passes.
```

## Stop Condition

Stop after provider abstraction exists.

---

## 17. Milestone 12: Context Builder

## Goal

Build the context system for project-aware AI answers.

## Scope

Prepare relevant project information before calling a model.

## Files to Create

```text
src/core/context.ts
src/tools/search-code.ts
src/tools/read-file.ts
src/utils/redact.ts
src/types/context.ts
```

## Tasks

```text
[ ] Load project map.
[ ] Search memory.
[ ] Search files by query.
[ ] Rank candidate files.
[ ] Read selected file excerpts.
[ ] Redact secrets.
[ ] Build context object.
[ ] Track context files used.
[ ] Respect ignored files.
[ ] Avoid binary files.
[ ] Avoid huge files.
```

## Context Output

```ts
type BuiltContext = {
  projectSummary: string;
  memorySnippets: MemorySnippet[];
  fileContexts: FileContext[];
  warnings: string[];
};
```

## Validation Commands

```bash
pnpm typecheck
pnpm build
```

Optional:

```bash
pnpm test
```

## Acceptance Criteria

```text
[ ] Context builder does not send whole repo.
[ ] Context files are tracked.
[ ] Secrets are redacted.
[ ] Ignored files are skipped.
[ ] Relevant memory is included.
[ ] TypeScript passes.
```

## Stop Condition

Stop after context builder works with mock data.

---

## 18. Milestone 13: `huno ask`

## Goal

Implement project-aware AI question answering.

## Scope

Use provider abstraction and context builder.

## Files to Create or Modify

```text
src/commands/ask.ts
src/index.ts
src/core/context.ts
src/core/provider-router.ts
src/prompts/system.ts
src/prompts/ask.ts
src/ui/components/ContextFiles.tsx
```

## Tasks

```text
[ ] Register `huno ask <question>`.
[ ] Validate question.
[ ] Load or create project map.
[ ] Search relevant memory.
[ ] Search relevant files.
[ ] Build context.
[ ] Select provider.
[ ] Call provider.
[ ] Render answer.
[ ] Show context files used.
[ ] Handle missing provider clearly.
[ ] Log history.
```

## Expected Output

```text
Using context:
- backend/src/api/auth.py
- backend/src/models/user.py
- .huno/memory.md

Answer:
Authentication appears to be handled in backend/src/api/auth.py...
```

## Missing Provider Output

```text
No model provider is configured.

Set an API key:
export OPENROUTER_API_KEY="..."

Then configure Huno:
huno config provider openrouter
```

## Validation Commands

```bash
pnpm dev -- ask "what is this project?"
pnpm typecheck
pnpm build
```

If using mock provider:

```bash
HUNO_PROVIDER=mock pnpm dev -- ask "what is this project?"
```

## Acceptance Criteria

```text
[ ] `huno ask` validates input.
[ ] Missing provider is handled.
[ ] Mock provider works.
[ ] Context files are shown.
[ ] Secrets are redacted.
[ ] No hallucinated file paths.
[ ] TypeScript passes.
[ ] Build passes.
```

## Stop Condition

Stop after `huno ask` works with mock provider and at least one real provider if configured.

---

## 19. Milestone 14: Terminal UI Polish

## Goal

Improve Huno terminal output using Ink + termcn or a clean fallback renderer.

## Scope

This milestone improves presentation, not core logic.

## Files to Create or Modify

```text
src/ui/renderer.tsx
src/ui/theme.ts
src/ui/components/Header.tsx
src/ui/components/ProjectCard.tsx
src/ui/components/ProgressSteps.tsx
src/ui/components/ContextFiles.tsx
src/ui/components/WarningBox.tsx
src/ui/components/ErrorBox.tsx
src/ui/components/AuditTable.tsx
```

## Dependencies

Recommended:

```text
ink
react
termcn
```

Alternative fallback:

```text
chalk
ora
inquirer
```

## Tasks

```text
[ ] Add consistent Huno header.
[ ] Add project summary component.
[ ] Add warning component.
[ ] Add error component.
[ ] Add context files component.
[ ] Add audit report component.
[ ] Add progress steps.
[ ] Keep JSON output clean.
[ ] Avoid excessive emojis.
[ ] Ensure output is readable in small terminals.
```

## Acceptance Criteria

```text
[ ] Output is structured and readable.
[ ] JSON mode remains raw JSON only.
[ ] Error output is actionable.
[ ] No visual clutter.
[ ] TypeScript passes.
[ ] Build passes.
```

## Stop Condition

Stop after UI is improved without changing command behavior.

---

## 14.5: Interactive REPL Mode (Claude Code / Gemini CLI Style)

## Goal

Implement an interactive REPL mode so users can run `huno` with no arguments and get a persistent prompt loop — similar to Claude Code or Gemini CLI.

## Scope

When the user runs `huno` with no subcommand, they enter an interactive session. Inside the REPL:

- A branded Huno header is shown
- The user types commands/questions at a `>` prompt
- The user can type natural language questions (routed to `huno ask`)
- The user can type slash commands (`/audit`, `/explain`, `/remember`, `/recall`, `/help`, `/exit`)
- File context from the current project is displayed
- The session persists until the user types `/exit` or presses Ctrl+C

## User Experience

```bash
$ huno
╭─ Huno ─────────────────────────────────────╮
│  ██╗  ██╗██╗   ██╗███╗   ██╗ ██████╗       │
│  ██║  ██║██║   ██║████╗  ██║██╔═══██╗      │
│  ███████║██║   ██║██╔██╗ ██║██║   ██║      │
│  ██╔══██║██║   ██║██║╚██╗██║██║   ██║      │
│  ██║  ██║╚██████╔╝██║ ╚████║╚██████╔╝      │
│  ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝       │
│                                             │
│  Project: huno                              │
│  Type a question or /help for commands.     │
╰─────────────────────────────────────────────╯

> where is authentication handled?

Using context:
  - src/commands/ask.ts
  - src/core/context.ts
  - .huno/memory.md

Answer:
Authentication is not yet implemented in this project.

> /audit

Running audit...

[audit results shown]

> /exit
Goodbye!
```

## Files to Create

```text
src/repl.ts          — REPL loop logic
src/ui/components/ReplPrompt.tsx — The input prompt component
```

## Files to Modify

```text
src/index.ts         — Add REPL mode when no command given
src/ui/components/index.ts — Export ReplPrompt
```

## Tasks

```text
[ ] Create src/repl.ts with REPL loop logic.
[ ] Create src/ui/components/ReplPrompt.tsx for the input area.
[ ] Route natural language input to buildContext() + provider.
[ ] Route slash commands (/audit, /explain, /remember, /recall, /help, /exit).
[ ] Show project context (project name, stack) in header.
[ ] Show file context (recent files from project map) in REPL header.
[ ] Handle Ctrl+C gracefully with goodbye message.
[ ] Handle /exit command.
[ ] Show typing indicator while waiting for provider response.
[ ] Keep JSON output clean (no Ink in --json mode).
```

## Slash Commands

```text
/help        — Show available commands
/audit       — Run huno audit
/explain     — Run huno explain
/remember    — Save a memory (prompts for text)
/recall      — Search memories (prompts for query)
/context    — Show current project context files
/exit        — Exit REPL
/clear       — Clear screen
```

## Input Routing

```text
Input starts with /     → Route as slash command
Input is plain text     → Route to ask command (build context + provider)
Empty input             → Ignore, re-prompt
```

## Validation Commands

```bash
npx tsx src/index.ts           # Should enter REPL
npx tsx src/index.ts --help    # Should still show help
npx tsx src/index.ts audit     # Should still run audit directly
```

## Acceptance Criteria

```text
[ ] `huno` with no args enters interactive REPL
[ ] Natural language routes to ask
[ ] Slash commands work (/help, /audit, /explain, /exit)
[ ] Ctrl+C exits gracefully
[ ] Project context shown in header
[ ] Direct commands still work (huno audit, huno explain, etc.)
```

## Stop Condition

After REPL mode works with ask + slash commands.

---

## 20. Milestone 15: Documentation Generator

## Goal

Implement `huno doc` for generating documentation from project context.

## Scope

Future feature after ask/context/provider works.

## Files to Create

```text
src/commands/doc.ts
src/prompts/doc.ts
src/core/doc-generator.ts
```

## Tasks

```text
[ ] Register `huno doc`.
[ ] Support doc types: readme, architecture, setup.
[ ] Scan project.
[ ] Load project map.
[ ] Load memory.
[ ] Generate documentation draft.
[ ] Ask before writing.
[ ] Do not overwrite silently.
[ ] Show context files used.
```

## Validation Commands

```bash
pnpm dev -- doc readme
pnpm typecheck
pnpm build
```

## Acceptance Criteria

```text
[ ] Docs reflect actual project structure.
[ ] No fake commands are invented.
[ ] Existing files are not overwritten without approval.
[ ] Missing provider is handled.
[ ] TypeScript passes.
```

## Stop Condition

Stop after one documentation type works safely.

---

## 21. Milestone 16: Permission and Risk System

## Goal

Implement a central permission and risk layer before command execution or file editing.

## Scope

This milestone is required before `huno run` or `huno fix`.

## Files to Create

```text
src/core/risk.ts
src/core/permissions.ts
src/types/permissions.ts
src/ui/components/ApprovalPrompt.tsx
```

## Tasks

```text
[ ] Define risk levels.
[ ] Implement command risk classifier.
[ ] Implement file operation risk classifier.
[ ] Implement permission request type.
[ ] Implement approval prompt.
[ ] Default high-risk actions to No.
[ ] Default destructive actions to deny unless explicit.
[ ] Add tests for risk classification.
```

## Risk Levels

```text
low
medium
high
destructive
```

## Validation Commands

```bash
pnpm typecheck
pnpm build
pnpm test
```

## Acceptance Criteria

```text
[ ] Risk classifier works.
[ ] Approval prompt shows action, reason, risk, default.
[ ] High-risk defaults to No.
[ ] Destructive actions are blocked by default.
[ ] Tests cover common risky commands.
```

## Stop Condition

Stop after permission system is testable.

---

## 22. Milestone 17: Safe Command Runner

## Goal

Implement `huno run` for approved terminal commands.

## Scope

Natural language to command can be simple at first.

The important part is safety.

## Files to Create

```text
src/commands/run.ts
src/tools/run-command.ts
src/core/risk.ts
src/core/permissions.ts
```

## Tasks

```text
[ ] Register `huno run <task>`.
[ ] Map common tasks to commands.
[ ] Show proposed command.
[ ] Classify risk.
[ ] Ask approval.
[ ] Execute only after approval.
[ ] Stream or capture output.
[ ] Summarize result.
[ ] Log history.
```

## Acceptance Criteria

```text
[ ] Commands are never run silently.
[ ] Risk is shown.
[ ] User can cancel.
[ ] Command output is shown.
[ ] Failures are clear.
[ ] History is logged.
```

## Stop Condition

Stop after safe command execution works for simple known commands.

---

## 23. Milestone 18: Safe File Editing

## Goal

Implement controlled file editing.

## Scope

This prepares for `huno fix`.

## Files to Create

```text
src/tools/write-file.ts
src/tools/patch-file.ts
src/tools/git-diff.ts
src/commands/fix.ts
```

## Tasks

```text
[ ] Create file writing tool.
[ ] Create patch tool if needed.
[ ] Require approval before writing.
[ ] Show diff after change.
[ ] Preserve user work.
[ ] Avoid overwriting unknown changes.
[ ] Log changed files.
```

## Acceptance Criteria

```text
[ ] No silent file edits.
[ ] Diff is shown.
[ ] User approval is required.
[ ] Cancel leaves files unchanged.
[ ] Changed files are logged.
```

## Stop Condition

Stop after safe file editing primitives work.

---

## 24. Milestone 19: Multi-Agent System

## Goal

Implement future `huno team` workflows.

## Scope

Do not build this until core single-agent commands are stable.

## Files to Create

```text
src/agents/manager.ts
src/agents/researcher.ts
src/agents/developer.ts
src/agents/reviewer.ts
src/agents/tester.ts
src/agents/coordinator.ts
src/agents/message.ts
src/commands/team.ts
```

## Tasks

```text
[ ] Define agent roles.
[ ] Define agent message type.
[ ] Define task state.
[ ] Implement manager planning.
[ ] Implement researcher context gathering.
[ ] Implement reviewer critique.
[ ] Implement tester validation suggestions.
[ ] Add max turn limit.
[ ] Add stop condition.
[ ] Consolidate final output.
```

## Acceptance Criteria

```text
[ ] Agents have distinct roles.
[ ] No infinite loops.
[ ] Tool usage is visible.
[ ] Commands/file edits still require approval.
[ ] Final answer is consolidated.
```

## Stop Condition

Stop after one controlled multi-agent workflow works.

---

## 25. Milestone 20: Packaging and Release

## Goal

Prepare Huno for npm distribution.

## Scope

Package build output, README instructions, versioning, and publish readiness.

## Tasks

```text
[ ] Confirm package name.
[ ] Confirm CLI binary works.
[ ] Add files field to package.json.
[ ] Ensure dist is built.
[ ] Add README install instructions.
[ ] Add LICENSE.
[ ] Add CHANGELOG.md.
[ ] Add npm publish checklist.
[ ] Test global install locally.
```

## Local Package Test

```bash
pnpm build
npm pack
npm install -g ./huno-0.1.0.tgz
huno --help
huno init
huno explain
```

## Acceptance Criteria

```text
[ ] npm package can be packed.
[ ] Global install works locally.
[ ] `huno` binary works after install.
[ ] README includes installation.
[ ] No secrets included in package.
```

## Stop Condition

Stop after local package install works.

---

## 26. Suggested First Agent Prompt

Use this prompt for the first implementation agent:

```text
Read README.md, AGENTS.md, ARCHITECTURE.md, PRODUCT_SPEC.md, and TASKS.md.

Implement only Milestone 1 and Milestone 5 if the foundation is missing:
- Create a TypeScript npm CLI skeleton.
- Implement `huno init`.
- Do not implement AI providers.
- Do not implement multi-agent features.
- Do not implement code editing.
- Do not run destructive commands.

After implementation, run:
- pnpm install
- pnpm dev -- --help
- pnpm dev -- init
- pnpm typecheck
- pnpm build

Then report:
- changed files
- validation results
- what is ready
- what should be done next
```

If the agent is expected to include `huno explain` too:

```text
Then implement Milestone 6:
- Implement rule-based project scanning.
- Implement `huno explain`.
- Save `.huno/project-map.json` when initialized.
- Support `huno explain --json`.
- Do not use AI providers.

Validate:
- pnpm dev -- explain
- pnpm dev -- explain --json
- pnpm typecheck
- pnpm build
```

---

## 27. Suggested Implementation Order for First Sprint

First sprint should include:

```text
[ ] Milestone 1: CLI Foundation
[ ] Milestone 2: Local .huno Project Storage
[ ] Milestone 3: Project Scanner
[ ] Milestone 4: Project Map Storage
[ ] Milestone 5: huno init
[ ] Milestone 6: huno explain
```

First sprint should not include:

```text
[ ] AI provider integration
[ ] huno ask
[ ] huno fix
[ ] huno run
[ ] multi-agent system
[ ] cloud sync
```

## First Sprint Demo

The demo should be:

```bash
pnpm install
pnpm dev -- --help
pnpm dev -- init
pnpm dev -- explain
pnpm dev -- explain --json
pnpm build
```

Expected result:

```text
A user can initialize Huno and get a useful project explanation without configuring any AI provider.
```

---

## 28. Definition of Done

A milestone is done only when:

```text
[ ] The requested command or module works.
[ ] TypeScript passes.
[ ] Build passes.
[ ] Errors are handled.
[ ] Output is clear.
[ ] No secrets are printed.
[ ] No unrelated changes were made.
[ ] Documentation is updated if behavior changed.
[ ] The agent reports validation honestly.
```

---

## 29. Task Priority

Use this priority list when unsure.

## Priority 1: Foundation

```text
CLI works
Local storage works
Scanner works
Project map works
```

## Priority 2: Useful Local Features

```text
Explain
Memory
Recall
Audit
```

## Priority 3: AI Features

```text
Provider abstraction
Context builder
Ask
Documentation generation
```

## Priority 4: Automation

```text
Permission system
Run command
File editing
Fix
```

## Priority 5: Advanced Systems

```text
Multi-agent workflows
Cloud sync
Dashboard
Plugins
```

---

## 30. Final Instruction

Do not build Huno as a giant autonomous agent first.

Build it as a reliable project intelligence CLI.

The first strong product moment is:

```bash
huno explain
```

If that command can understand a real project clearly, Huno has a foundation.

Everything else grows from there.

> **Who knows your codebase? Huno knows.**
