# ARCHITECTURE.md

> Technical architecture blueprint for **Huno**.

This document explains how Huno should be built internally. It is intended for human developers and AI implementation agents working on the project.

Read this together with:

```text
README.md   → product vision and feature overview
AGENTS.md   → rules and instructions for implementation agents
TASKS.md    → implementation milestones and checklists
```

This file focuses on **system design**.

---

## 1. Architecture Summary

Huno is a terminal-first AI developer tool.

It is designed as a **local-first developer harness** around language models.

The language model is not the product by itself. The product is the full system around the model:

```text
Huno
├── CLI command layer
├── Terminal UI
├── Project scanner
├── Project map
├── Memory system
├── Context builder
├── Model provider router
├── Tool system
├── Permission and risk layer
├── Storage layer
└── Future multi-agent runtime
```

The core promise:

> Huno knows your codebase.

To achieve that, Huno must understand the local project, remember decisions, retrieve relevant files, and communicate clearly through the terminal.

---

## 2. Core Design Goals

### 2.1 Local-First

Huno should work inside a local repository without requiring cloud sync.

The default project state is stored in:

```text
.huno/
```

Cloud features can be added later, but the core product must work locally.

### 2.2 Project-Aware

Huno must use actual project context.

It should inspect:

- Repository structure
- Config files
- Package files
- Source files
- Project memory
- Git metadata
- Documentation

It should avoid generic answers when project-specific evidence is available.

### 2.3 Provider-Flexible

Huno must not depend on a single AI provider.

The provider layer should support:

- OpenRouter
- Google Gemini
- NVIDIA NIM
- Groq
- Mistral
- Cerebras
- Ollama
- Local OpenAI-compatible servers
- Future providers

The rest of the system should call a common provider interface.

### 2.4 Safe by Default

The user must stay in control.

Huno may read files and scan code by default, but writing files, deleting files, running shell commands, installing packages, or changing git state requires approval.

### 2.5 Terminal-Native

Huno should feel like a modern terminal product.

It should use structured terminal output:

- Cards
- Tables
- Progress steps
- Context file lists
- Tool-call blocks
- Approval prompts
- Diffs
- Warnings

The first version should be command-based, not a full-screen dashboard.

### 2.6 Incremental

Build Huno in layers.

Do not build the full multi-agent system first.

Recommended order:

```text
1. CLI foundation
2. Project scanner
3. Project map
4. Init command
5. Explain command
6. Memory
7. Ask command
8. Audit command
9. Documentation generation
10. Safe terminal execution
11. Code editing
12. Multi-agent workflows
```

---

## 3. High-Level System Diagram

```text
┌─────────────────────────────────────────────────────────────┐
│                         User Terminal                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                          Huno CLI                           │
│                  src/index.ts + command router              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Command Layer                        │
│ init | explain | ask | remember | recall | audit | doc | fix │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Huno Core Runtime                     │
├─────────────────────────────────────────────────────────────┤
│ Config Manager                                              │
│ Project Scanner                                             │
│ Project Map Builder                                         │
│ Memory Manager                                              │
│ Context Builder                                             │
│ Provider Router                                             │
│ Tool Registry                                               │
│ Permission Manager                                          │
│ Risk Classifier                                             │
│ History Logger                                              │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ Local Storage │     │ Model Provider│     │ Terminal UI   │
│ .huno/        │     │ OpenRouter    │     │ Ink + termcn  │
│ JSON/MD/JSONL │     │ Gemini        │     │ Renderer      │
│ SQLite later  │     │ Ollama        │     │ Prompts       │
└───────────────┘     └───────────────┘     └───────────────┘
```

---

## 4. Recommended Repository Structure

```text
huno/
├── src/
│   ├── index.ts
│   ├── commands/
│   │   ├── init.ts
│   │   ├── explain.ts
│   │   ├── ask.ts
│   │   ├── remember.ts
│   │   ├── recall.ts
│   │   ├── audit.ts
│   │   ├── doc.ts
│   │   ├── run.ts
│   │   └── fix.ts
│   ├── core/
│   │   ├── runtime.ts
│   │   ├── config.ts
│   │   ├── scanner.ts
│   │   ├── project-map.ts
│   │   ├── context.ts
│   │   ├── memory.ts
│   │   ├── provider-router.ts
│   │   ├── permissions.ts
│   │   ├── risk.ts
│   │   ├── history.ts
│   │   └── errors.ts
│   ├── tools/
│   │   ├── registry.ts
│   │   ├── read-file.ts
│   │   ├── write-file.ts
│   │   ├── list-files.ts
│   │   ├── search-code.ts
│   │   ├── run-command.ts
│   │   ├── git-status.ts
│   │   └── git-diff.ts
│   ├── ui/
│   │   ├── renderer.tsx
│   │   ├── theme.ts
│   │   └── components/
│   │       ├── Header.tsx
│   │       ├── ProjectCard.tsx
│   │       ├── ProgressSteps.tsx
│   │       ├── ContextFiles.tsx
│   │       ├── ToolCallCard.tsx
│   │       ├── ApprovalPrompt.tsx
│   │       ├── AuditTable.tsx
│   │       ├── WarningBox.tsx
│   │       └── ErrorBox.tsx
│   ├── providers/
│   │   ├── base.ts
│   │   ├── openai-compatible.ts
│   │   ├── openrouter.ts
│   │   ├── gemini.ts
│   │   ├── groq.ts
│   │   ├── nvidia.ts
│   │   ├── mistral.ts
│   │   ├── cerebras.ts
│   │   └── ollama.ts
│   ├── storage/
│   │   ├── huno-dir.ts
│   │   ├── config-store.ts
│   │   ├── memory-store.ts
│   │   ├── project-map-store.ts
│   │   ├── history-store.ts
│   │   └── sqlite-store.ts
│   ├── prompts/
│   │   ├── system.ts
│   │   ├── explain.ts
│   │   ├── ask.ts
│   │   ├── audit.ts
│   │   ├── doc.ts
│   │   └── fix.ts
│   ├── types/
│   │   ├── config.ts
│   │   ├── project.ts
│   │   ├── memory.ts
│   │   ├── provider.ts
│   │   ├── tools.ts
│   │   ├── audit.ts
│   │   └── result.ts
│   └── utils/
│       ├── paths.ts
│       ├── fs.ts
│       ├── ignore.ts
│       ├── json.ts
│       ├── text.ts
│       └── logger.ts
├── tests/
│   ├── fixtures/
│   ├── scanner.test.ts
│   ├── project-map.test.ts
│   ├── memory.test.ts
│   ├── config.test.ts
│   ├── risk.test.ts
│   └── provider-router.test.ts
├── examples/
│   └── sample-project/
├── README.md
├── AGENTS.md
├── ARCHITECTURE.md
├── TASKS.md
├── PRODUCT_SPEC.md
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── .hunoignore
└── LICENSE
```

---

## 5. Layered Architecture

Huno should be implemented in layers.

Do not mix responsibilities.

```text
CLI Layer
  ↓
Command Layer
  ↓
Core Runtime
  ↓
Domain Services
  ↓
Tool Layer / Provider Layer / Storage Layer
  ↓
External Systems
```

---

## 6. CLI Layer

### Purpose

The CLI layer parses command-line input and routes to the correct command.

It should not contain business logic.

### Main File

```text
src/index.ts
```

### Responsibilities

- Register commands
- Parse arguments
- Load global CLI options
- Call command handlers
- Handle top-level errors
- Set process exit codes

### Recommended Library

```text
Commander.js
```

### Example Command Registration

```ts
program
  .name("huno")
  .description("Project-aware AI developer tool")
  .version(version);

program.command("init").action(initCommand);
program.command("explain").action(explainCommand);
program.command("ask <question>").action(askCommand);
program.command("remember <note>").action(rememberCommand);
program.command("recall <query>").action(recallCommand);
program.command("audit").action(auditCommand);
```

### CLI Layer Must Not

- Directly scan the project
- Directly call model providers
- Directly write complex files
- Directly render large UI blocks
- Directly run shell commands

It should delegate.

---

## 7. Command Layer

### Purpose

The command layer defines user-facing behavior.

Each command should orchestrate core services.

### Location

```text
src/commands/
```

### Command Handler Pattern

Each command should:

1. Resolve project root.
2. Load or initialize config if needed.
3. Call core services.
4. Render output.
5. Log history.
6. Return a clear result.

Example:

```ts
export async function explainCommand(options: ExplainOptions): Promise<void> {
  const runtime = await createRuntime();
  const projectMap = await runtime.scanner.scan();
  await runtime.projectMapStore.save(projectMap);
  runtime.renderer.renderProjectSummary(projectMap);
}
```

### Commands Should Stay Thin

Bad:

```text
commands/explain.ts contains scanning logic, JSON writing, UI formatting, and AI calls.
```

Good:

```text
commands/explain.ts calls scanner, project-map store, and renderer.
```

---

## 8. Core Runtime

### Purpose

The runtime wires together the main services.

### Suggested File

```text
src/core/runtime.ts
```

### Responsibilities

- Load config
- Resolve paths
- Initialize stores
- Initialize scanner
- Initialize renderer
- Initialize provider router
- Initialize tool registry
- Expose services to command handlers

### Example Shape

```ts
export type HunoRuntime = {
  root: string;
  config: HunoConfig;
  scanner: ProjectScanner;
  memory: MemoryManager;
  context: ContextBuilder;
  providers: ProviderRouter;
  tools: ToolRegistry;
  permissions: PermissionManager;
  risk: RiskClassifier;
  history: HistoryLogger;
  renderer: Renderer;
};
```

### Why Runtime Exists

Without a runtime, every command will manually create services. That leads to duplication and inconsistent behavior.

The runtime gives each command the same foundation.

---

## 9. Storage Architecture

### 9.1 Local Project Storage

Huno uses a local project directory:

```text
.huno/
```

Recommended structure:

```text
.huno/
├── config.json
├── memory.md
├── project-map.json
├── history.jsonl
├── logs/
├── cache/
└── sessions/
```

### 9.2 File Responsibilities

#### `.huno/config.json`

Project-level Huno configuration.

Stores:

- Project name
- Default provider
- Default model
- Permission settings
- UI settings
- Memory settings
- Environment variable names for API keys

Does not store raw secrets by default.

#### `.huno/memory.md`

Human-readable project memory.

Stores:

- Decisions
- Notes
- Preferences
- Known issues
- Architecture choices

#### `.huno/project-map.json`

Machine-readable summary of the project.

Stores:

- Stack
- Important files
- Important directories
- Package scripts
- Framework detection
- Database detection
- Infrastructure detection

#### `.huno/history.jsonl`

Append-only command and action history.

Each line is one JSON object.

#### `.huno/logs/`

Detailed logs for debugging.

#### `.huno/cache/`

Temporary cache for scans, context chunks, or provider results.

#### `.huno/sessions/`

Future session transcripts and multi-agent task state.

---

## 10. Config Architecture

### Config Loading Order

Use this priority:

```text
1. CLI flags
2. Environment variables
3. .huno/config.json
4. Global user config
5. Defaults
```

### Config Type

```ts
export type HunoConfig = {
  version: string;
  projectName: string;
  defaultProvider?: string;
  defaultModel?: string;
  apiKeys: Record<string, string>;
  permissions: PermissionConfig;
  memory: MemoryConfig;
  ui: UiConfig;
};
```

### Permission Config

```ts
export type PermissionConfig = {
  allowRead: boolean;
  allowWrite: "ask" | "allow" | "deny";
  allowCommand: "ask" | "allow" | "deny";
  allowDestructive: boolean;
};
```

### UI Config

```ts
export type UiConfig = {
  theme: "default" | "minimal";
  showToolCalls: boolean;
  showContextFiles: boolean;
  verbose: boolean;
};
```

### Memory Config

```ts
export type MemoryConfig = {
  enabled: boolean;
  storage: "markdown" | "sqlite";
};
```

### Config Rules

- If `.huno/config.json` is missing, commands should suggest `huno init`.
- `huno explain` may run without config if possible, but should recommend init.
- `huno ask` requires provider configuration unless using a mock/local fallback.
- Never print raw API keys.

---

## 11. Project Scanner Architecture

The scanner is one of the most important parts of Huno.

### Purpose

The scanner converts a raw repository into a structured project map.

### Suggested File

```text
src/core/scanner.ts
```

### Scanner Input

```ts
type ScanOptions = {
  root: string;
  deep?: boolean;
  includeGit?: boolean;
  respectIgnore?: boolean;
};
```

### Scanner Output

```ts
type ProjectMap = {
  version: string;
  projectName: string;
  root: string;
  generatedAt: string;
  stack: ProjectStack;
  packageManagers: string[];
  importantFiles: ImportantFile[];
  importantDirectories: ImportantDirectory[];
  scripts: Record<string, string>;
  dependencies: DependencySummary[];
  infrastructure: InfrastructureSummary;
  git?: GitSummary;
  warnings: ProjectWarning[];
};
```

### Scanner Responsibilities

The scanner should detect:

- Languages
- Frameworks
- Package managers
- Source directories
- Important config files
- API folders
- Database usage
- Docker files
- Test setup
- Build scripts
- Git status
- Documentation files

### Scanner Must Respect Ignore Rules

Ignore by default:

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

Also respect:

```text
.gitignore
.hunoignore
```

### Scanner Should Be Mostly Rule-Based

Do not use AI for initial detection.

Rule-based scanning is more reliable, cheaper, faster, and works offline.

AI can summarize the scan later.

---

## 12. Project Map Architecture

### Purpose

The project map is Huno's structured understanding of the repository.

It should be small enough to load quickly and useful enough to guide context building.

### Suggested File

```text
.huno/project-map.json
```

### Example

```json
{
  "version": "0.1.0",
  "projectName": "khmer-sign-language-platform",
  "root": "/home/user/projects/ksl",
  "generatedAt": "2026-06-24T00:00:00.000Z",
  "stack": {
    "languages": ["TypeScript", "Python"],
    "frameworks": ["Next.js", "FastAPI"],
    "databases": ["PostgreSQL"],
    "ui": ["MUI"],
    "infrastructure": ["Docker Compose"]
  },
  "packageManagers": ["pnpm"],
  "importantFiles": [
    {
      "path": "package.json",
      "kind": "package-manifest",
      "reason": "Defines frontend scripts and dependencies"
    },
    {
      "path": "docker-compose.yml",
      "kind": "infrastructure",
      "reason": "Defines local development services"
    }
  ],
  "importantDirectories": [
    {
      "path": "frontend/",
      "kind": "frontend",
      "reason": "Frontend application"
    },
    {
      "path": "backend/",
      "kind": "backend",
      "reason": "Backend application"
    }
  ],
  "scripts": {
    "dev": "next dev",
    "build": "next build"
  },
  "warnings": []
}
```

### Rules

- Do not store full source files in the project map.
- Store summaries and paths.
- Keep generated timestamps.
- Include warnings if scan was incomplete.
- Make it safe to regenerate.

---

## 13. Memory Architecture

### Purpose

Memory allows Huno to become more useful over time.

The memory system stores project-specific knowledge that cannot always be inferred from code.

### Memory Types

```text
Global memory      → user-wide preferences, future feature
Project memory     → local .huno/memory.md
Session memory     → temporary current task context
Agent memory       → future multi-agent task state
```

### MVP Memory

Use Markdown:

```text
.huno/memory.md
```

Reason:

- Human-readable
- Easy to edit
- Easy for agents to inspect
- Works without database setup

### Memory Format

```md
# Huno Project Memory

## Decisions

- 2026-06-24: The project uses TypeScript for the CLI.
- 2026-06-24: Huno uses local-first project memory.

## Preferences

- Use Ink + termcn for terminal UI.
- Prefer provider abstraction over provider lock-in.

## Notes

- Huno should start with init and explain commands.
```

### Memory Manager Responsibilities

- Create memory file
- Append memory
- Search memory
- Return relevant snippets
- Preserve formatting
- Avoid duplicates if possible
- Add timestamps

### Future SQLite Memory

SQLite can later store:

- Structured memories
- Tags
- Embeddings
- Sessions
- Tool calls
- Agent messages
- Audit reports

But do not require SQLite for the MVP.

---

## 14. Context Builder Architecture

The context builder prepares relevant information before asking a model.

### Purpose

The context builder answers:

> What should the model see for this task?

### Inputs

```ts
type ContextRequest = {
  root: string;
  question: string;
  projectMap?: ProjectMap;
  memory?: MemorySnippet[];
  candidateFiles?: string[];
  maxTokens?: number;
};
```

### Output

```ts
type BuiltContext = {
  projectSummary: string;
  memorySnippets: MemorySnippet[];
  fileContexts: FileContext[];
  warnings: string[];
};
```

### File Context

```ts
type FileContext = {
  path: string;
  reason: string;
  content: string;
  startLine?: number;
  endLine?: number;
};
```

### Context Pipeline

```text
User question
  ↓
Search memory
  ↓
Search project files
  ↓
Rank relevant files
  ↓
Read selected excerpts
  ↓
Redact secrets
  ↓
Build prompt context
  ↓
Send to provider
```

### Important Rules

- Do not send the entire repository.
- Prefer relevant excerpts.
- Show context files to the user.
- Redact secrets.
- Respect `.gitignore` and `.hunoignore`.
- Avoid binary files.
- Avoid huge generated files.

---

## 15. Provider Architecture

### Purpose

The provider layer lets Huno call different model providers using a common interface.

### Location

```text
src/providers/
```

### Base Interface

```ts
export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type GenerateOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
};

export type StreamChunk = {
  content: string;
};

export interface ModelProvider {
  name: string;
  generate(messages: ChatMessage[], options?: GenerateOptions): Promise<string>;
  stream?(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): AsyncIterable<StreamChunk>;
}
```

### Provider Router

The provider router selects the correct provider based on config and task type.

```ts
export type ProviderRouter = {
  getDefaultProvider(): ModelProvider;
  getProviderForTask(task: ProviderTask): ModelProvider;
};
```

### Provider Task Types

```ts
type ProviderTask =
  | "general"
  | "coding"
  | "reasoning"
  | "fast"
  | "local"
  | "audit"
  | "documentation";
```

### Provider Rules

- Commands must not directly depend on provider-specific APIs.
- Provider errors must be normalized.
- Missing API keys must produce actionable messages.
- Streaming should be optional.
- Local providers should be supported later.

---

## 16. Tool Architecture

### Purpose

Tools are controlled capabilities Huno can use.

Tools allow the agent to interact with the local project in a safe and structured way.

### Tool Categories

```text
Read-only tools
Write tools
Command tools
Git tools
Documentation tools
Future agent tools
```

### Tool Interface

```ts
export type ToolRisk = "low" | "medium" | "high" | "destructive";

export type ToolCall<TInput = unknown> = {
  name: string;
  input: TInput;
  risk: ToolRisk;
  reason?: string;
};

export type ToolResult<TOutput = unknown> = {
  name: string;
  ok: boolean;
  output?: TOutput;
  error?: string;
  metadata?: Record<string, unknown>;
};

export interface Tool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  risk: ToolRisk;
  requiresApproval: boolean;
  execute(input: TInput): Promise<ToolResult<TOutput>>;
}
```

### Read-Only Tools

May be allowed by default:

```text
read_file
list_files
search_code
git_status
git_diff
read_config
```

### Write Tools

Require approval:

```text
write_file
patch_file
create_file
delete_file
format_file
```

### Command Tools

Require approval:

```text
run_command
install_package
run_tests
run_docker
run_migration
```

### Tool Registry

```ts
export type ToolRegistry = {
  register(tool: Tool): void;
  get(name: string): Tool | undefined;
  list(): Tool[];
};
```

### Tool Visibility

When a tool runs, Huno should show:

```text
Tool: search_code
Input: "auth"
Result: 12 matches in 5 files
```

Tool calls should not be invisible.

---

## 17. Permission and Risk Architecture

### Purpose

The permission system protects the user's project.

It controls whether a tool or command can run.

### Risk Levels

```text
low
medium
high
destructive
```

### Risk Examples

#### Low

```text
Read file
List directory
Search code
Read git status
Read package metadata
```

Default: allow.

#### Medium

```text
Run tests
Run linter
Run build
Create documentation file
```

Default: ask.

#### High

```text
Modify source files
Install dependencies
Edit config
Run migrations
Run Docker commands that change state
```

Default: ask.

#### Destructive

```text
Delete files
Delete database volumes
Drop database
Force push
Reset git history
Delete lock files
```

Default: deny unless explicit user confirmation.

### Permission Manager

```ts
export type PermissionDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

export type PermissionRequest = {
  action: string;
  risk: ToolRisk;
  command?: string;
  files?: string[];
  reason: string;
};

export interface PermissionManager {
  request(request: PermissionRequest): Promise<PermissionDecision>;
}
```

### Approval Prompt Must Show

- Action
- Files or command
- Reason
- Risk level
- Expected result
- Default answer

Example:

```text
Huno wants to modify:

src/app/dashboard/loading.tsx

Reason:
Create a loading skeleton for the dashboard route.

Risk:
Medium. This will create or overwrite one source file.

Approve? [y/N]
```

---

## 18. Terminal UI Architecture

### Recommended Stack

```text
Ink + termcn
```

Use termcn for ready-made components where possible.

Use native Ink for custom Huno-specific UI components.

### UI Layer Responsibilities

- Render command results
- Render progress
- Render project summary
- Render audit report
- Render context file list
- Render approval prompts
- Render errors
- Render warnings
- Render diffs

### UI Layer Must Not

- Scan files
- Call providers
- Run commands
- Write storage
- Perform business logic

### Renderer Interface

```ts
export interface Renderer {
  projectSummary(projectMap: ProjectMap): void;
  contextFiles(files: FileContext[]): void;
  auditReport(report: AuditReport): void;
  warning(message: string): void;
  error(error: HunoError): void;
  success(message: string): void;
}
```

### Output Style

Huno should sound:

```text
Clear
Direct
Calm
Professional
Practical
```

Avoid excessive emojis or overly playful messaging.

### Standard Output Pattern

```text
Header
Progress / context
Result
Warnings
Suggested next action
```

---

## 19. Command Runtime Flows

### 19.1 `huno init`

```text
User runs: huno init
  ↓
Resolve project root
  ↓
Check whether .huno exists
  ↓
Create .huno directory if missing
  ↓
Create config.json if missing
  ↓
Create memory.md if missing
  ↓
Create history.jsonl if missing
  ↓
Create logs/ and cache/
  ↓
Print created files
  ↓
Suggest: huno explain
```

Rules:

- Do not overwrite existing files without confirmation.
- If files already exist, report status.
- Should not require API key.

### 19.2 `huno explain`

```text
User runs: huno explain
  ↓
Resolve project root
  ↓
Load config if available
  ↓
Scan project
  ↓
Build project map
  ↓
Save .huno/project-map.json if .huno exists
  ↓
Render project summary
  ↓
Suggest next questions
```

Rules:

- Should work without AI provider.
- Should be mostly rule-based.
- Should show detected stack and important files.
- Should be fast.

### 19.3 `huno remember`

```text
User runs: huno remember "note"
  ↓
Resolve project root
  ↓
Ensure .huno exists or suggest init
  ↓
Load memory.md
  ↓
Append timestamped note
  ↓
Save memory.md
  ↓
Log history
  ↓
Confirm saved note
```

Rules:

- Preserve existing memory.
- Do not rewrite the whole file destructively.
- Add timestamp.
- Should not require AI provider.

### 19.4 `huno recall`

```text
User runs: huno recall "query"
  ↓
Resolve project root
  ↓
Load memory.md
  ↓
Search memory text
  ↓
Rank matches
  ↓
Render relevant snippets
```

Rules:

- Handle no matches gracefully.
- Should not require AI provider for basic recall.
- Later can use semantic search.

### 19.5 `huno ask`

```text
User runs: huno ask "question"
  ↓
Resolve project root
  ↓
Load config
  ↓
Load project map
  ↓
If project map missing, scan or suggest huno explain
  ↓
Search memory
  ↓
Search relevant files
  ↓
Build context
  ↓
Redact secrets
  ↓
Call selected provider
  ↓
Render answer
  ↓
Show context files used
  ↓
Log history
```

Rules:

- Requires provider unless offline/mock mode is used.
- Must not invent files.
- Must show context files.
- Must be honest if not enough context is available.

### 19.6 `huno audit`

```text
User runs: huno audit
  ↓
Resolve project root
  ↓
Scan project
  ↓
Run rule-based checks
  ↓
Optional AI summarization if provider configured
  ↓
Render audit report
  ↓
Save audit history later
```

Rules:

- Basic audit must work without provider.
- Every issue should include evidence.
- Do not invent issues.
- Prioritize findings.

### 19.7 `huno doc`

Future command.

```text
User runs: huno doc readme
  ↓
Scan project
  ↓
Load project map and memory
  ↓
Generate documentation draft
  ↓
Show target file
  ↓
Ask before writing
  ↓
Write only after approval
```

Rules:

- Do not overwrite without approval.
- Generated docs must reflect actual project evidence.

### 19.8 `huno run`

Future command.

```text
User runs: huno run "start backend"
  ↓
Interpret requested task
  ↓
Suggest command
  ↓
Classify risk
  ↓
Ask approval
  ↓
Run command
  ↓
Stream output
  ↓
Summarize result
```

Rules:

- Never run command silently.
- High-risk commands default to No.
- Log command and result.

### 19.9 `huno fix`

Future command.

```text
User runs: huno fix "task"
  ↓
Understand task
  ↓
Search files
  ↓
Build plan
  ↓
Show files to edit
  ↓
Ask approval
  ↓
Generate patch
  ↓
Show diff
  ↓
Apply if approved
  ↓
Suggest validation
```

Rules:

- No silent edits.
- Show diff.
- Avoid unrelated changes.
- Respect user work.

---

## 20. Error Architecture

### Error Type

Use structured errors.

```ts
export type HunoErrorCode =
  | "CONFIG_NOT_FOUND"
  | "PROJECT_NOT_INITIALIZED"
  | "PROVIDER_NOT_CONFIGURED"
  | "PROVIDER_ERROR"
  | "FILE_READ_ERROR"
  | "FILE_WRITE_ERROR"
  | "PERMISSION_DENIED"
  | "VALIDATION_ERROR"
  | "UNKNOWN_ERROR";

export class HunoError extends Error {
  code: HunoErrorCode;
  suggestion?: string;
  details?: unknown;
}
```

### Error Output

Errors should be actionable.

Bad:

```text
Error: failed
```

Good:

```text
Could not find .huno/config.json.

Reason:
This project has not been initialized.

Suggested fix:
Run `huno init`.
```

### Top-Level Error Handling

The CLI should catch unexpected errors and render them cleanly.

Do not dump stack traces by default.

Provide verbose stack traces only with:

```bash
huno --verbose
```

---

## 21. Logging and History Architecture

### History File

```text
.huno/history.jsonl
```

### Event Shape

```ts
type HistoryEvent = {
  timestamp: string;
  command: string;
  args: string[];
  status: "success" | "failed" | "cancelled";
  durationMs?: number;
  provider?: string;
  model?: string;
  filesRead?: string[];
  filesChanged?: string[];
  toolsUsed?: string[];
  error?: string;
};
```

### Rules

- Log command-level history.
- Do not log full secrets.
- Do not log full file contents by default.
- Keep JSONL append-only.
- Handle corrupted history gracefully.

---

## 22. Security and Privacy Architecture

Huno reads user code, so privacy matters.

### Secret Redaction

Before rendering or sending context to providers, redact secrets.

Detect common patterns:

```text
API keys
tokens
passwords
database URLs
private keys
JWT secrets
.env values
```

Example:

```text
DATABASE_URL=postgres://****@localhost:5432/app
```

### Context Minimization

Do not send more code than needed.

Context builder should prefer:

- Project map
- Relevant file excerpts
- Relevant memory snippets
- Selected command output

Avoid sending:

- Entire repository
- `.env`
- Private keys
- Lock files unless necessary
- Binary files
- Large generated files

### Ignore Rules

Respect:

```text
.gitignore
.hunoignore
```

### User Control

The user should know when external providers are used.

Future feature:

```bash
huno ask --local
```

or config:

```json
{
  "privacy": {
    "preferLocal": false,
    "showExternalProviderNotice": true
  }
}
```

---

## 23. Audit Architecture

The audit system should start rule-based.

### Audit Report Type

```ts
type AuditSeverity = "high" | "medium" | "low" | "info";

type AuditIssue = {
  id: string;
  title: string;
  severity: AuditSeverity;
  category: "security" | "docs" | "testing" | "architecture" | "dependencies" | "dx";
  evidence: string[];
  recommendation: string;
  confidence: "high" | "medium" | "low";
};

type AuditReport = {
  generatedAt: string;
  projectName: string;
  issues: AuditIssue[];
  strengths: string[];
  summary: string;
};
```

### Initial Rule-Based Checks

Check:

- Missing README
- Missing LICENSE
- Missing `.env.example`
- Missing tests
- Missing test script
- Missing build script
- Multiple package managers
- Large source files
- TODO/FIXME comments
- Docker files without docs
- TypeScript strict mode disabled
- Uncommitted changes
- Ignored folders accidentally included

### AI-Assisted Audit

AI can summarize and prioritize issues later.

But every issue must be evidence-backed.

---

## 24. Testing Architecture

### Test Strategy

Test core logic, not only CLI output.

Minimum test areas:

```text
config loading
huno directory creation
project scanning
ignore rules
project map generation
memory append/search
risk classification
provider router
tool registry
audit checks
```

### Recommended Test Runner

```text
Vitest
```

### Fixture Projects

Use fixture repositories:

```text
tests/fixtures/
├── node-basic/
├── next-basic/
├── python-fastapi/
├── fullstack-next-fastapi/
└── empty-project/
```

### Mock Providers

Do not call real APIs in unit tests.

Use mock providers:

```ts
class MockProvider implements ModelProvider {
  name = "mock";

  async generate() {
    return "mock response";
  }
}
```

### CLI Integration Tests

Later, test commands by spawning the CLI in fixture directories.

---

## 25. Packaging Architecture

Huno should be distributed through npm.

### Package Binary

```json
{
  "bin": {
    "huno": "./dist/index.js"
  }
}
```

### Entry Point

The built `dist/index.js` must be executable.

Source file should include:

```ts
#!/usr/bin/env node
```

### Build

```text
src/ → dist/
```

### Scripts

Recommended:

```json
{
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "lint": "eslint ."
  }
}
```

### Module Format

Prefer ESM unless a dependency forces CJS.

Use:

```json
{
  "type": "module"
}
```

---

## 26. Future Multi-Agent Architecture

Multi-agent mode should not be part of the first milestone.

But the architecture should leave room for it.

### Agent Runtime

Future location:

```text
src/agents/
```

Suggested structure:

```text
src/agents/
├── manager.ts
├── researcher.ts
├── developer.ts
├── reviewer.ts
├── tester.ts
├── message.ts
├── task.ts
└── coordinator.ts
```

### Agent Message Type

```ts
type AgentRole =
  | "manager"
  | "researcher"
  | "developer"
  | "reviewer"
  | "tester";

type AgentMessage = {
  id: string;
  taskId: string;
  from: AgentRole;
  to: AgentRole | "all";
  type: "plan" | "context" | "proposal" | "review" | "result" | "error";
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
};
```

### Multi-Agent Rules

- Every task needs a stop condition.
- Limit the number of turns.
- Log agent messages.
- Keep shared context explicit.
- Do not allow uncontrolled loops.
- Final output must be consolidated by Manager Agent.

### Initial Agent Roles

#### Manager Agent

Plans task and coordinates.

#### Research Agent

Finds context and relevant files.

#### Developer Agent

Proposes code changes.

#### Reviewer Agent

Reviews risks and quality.

#### Tester Agent

Runs approved validation.

---

## 27. Future Cloud Architecture

Cloud should come much later.

Possible future features:

```text
Huno Cloud
├── remote memory sync
├── team project knowledge
├── shared decisions
├── cloud task history
├── hosted agent runs
└── web dashboard
```

Cloud should not be required for:

```text
huno init
huno explain
huno remember
huno recall
huno audit
```

Local-first remains the default.

---

## 28. Module Dependency Rules

Keep dependencies clean.

### Allowed Dependency Direction

```text
commands → core → storage/tools/providers/ui/types/utils
```

More specifically:

```text
src/index.ts
  imports commands

commands/*
  imports core/runtime and ui renderer

core/*
  imports storage, tools, providers, utils, types

tools/*
  imports utils and types

providers/*
  imports types and provider utilities

ui/*
  imports types only when possible

storage/*
  imports utils and types
```

### Avoid Circular Dependencies

Do not allow:

```text
core imports commands
tools import commands
providers import commands
ui imports commands
```

### Business Logic Location

Business logic belongs in:

```text
src/core/
```

not in:

```text
src/index.ts
src/ui/
```

---

## 29. Data Flow Examples

### 29.1 Explain Data Flow

```text
CLI args
  ↓
explainCommand
  ↓
runtime.scanner.scan()
  ↓
ProjectMap
  ↓
projectMapStore.save()
  ↓
renderer.projectSummary()
  ↓
history.log()
```

### 29.2 Ask Data Flow

```text
CLI args
  ↓
askCommand
  ↓
load project map
  ↓
memory.search()
  ↓
search_code tool
  ↓
contextBuilder.build()
  ↓
providerRouter.getProviderForTask("general")
  ↓
provider.generate()
  ↓
renderer.answer()
  ↓
history.log()
```

### 29.3 Audit Data Flow

```text
CLI args
  ↓
auditCommand
  ↓
scanner.scan()
  ↓
auditEngine.runRules()
  ↓
AuditReport
  ↓
optional provider summary
  ↓
renderer.auditReport()
  ↓
history.log()
```

---

## 30. First Implementation Target

The first implementation should build only:

```bash
huno init
huno explain
```

### Why

These two commands create the base architecture without requiring model APIs.

They validate:

- CLI works
- local storage works
- scanner works
- project map works
- renderer works
- package can build

### Acceptance Criteria

#### `huno init`

Must:

- Create `.huno/`
- Create `.huno/config.json`
- Create `.huno/memory.md`
- Create `.huno/history.jsonl`
- Create `.huno/logs/`
- Create `.huno/cache/`
- Not overwrite existing files silently
- Print next step: `huno explain`

#### `huno explain`

Must:

- Scan current project
- Detect basic stack
- Detect package manager
- Detect important files
- Save project map if `.huno/` exists
- Render readable summary
- Work without API key

---

## 31. Architecture Decisions

Initial decisions:

### ADR-001: TypeScript

Huno should use TypeScript because it is an npm CLI and benefits from the Node/React ecosystem.

### ADR-002: Local-First `.huno/`

Huno should store project state locally to avoid requiring accounts, cloud sync, or hosted services.

### ADR-003: Rule-Based Scanner First

Project detection should be rule-based before AI-assisted.

This makes `huno explain` fast, cheap, deterministic, and offline-capable.

### ADR-004: Provider Abstraction

Huno should support multiple providers through a common interface.

The model is replaceable. The Huno harness is the product.

### ADR-005: Ink + termcn

Use Ink and termcn for terminal UI so the CLI feels modern while staying React/TypeScript-friendly.

### ADR-006: Safety Layer Before Automation

Before Huno can modify files or run commands, it must have risk classification and approval prompts.

---

## 32. What Not to Build First

Do not build these before the MVP foundation:

```text
Full multi-agent system
Cloud dashboard
Remote memory sync
Autonomous code editing
Plugin marketplace
Model fine-tuning
Vector database
Browser automation
Complex workflow scheduler
```

Build the foundation first.

---

## 33. Final Architecture Principle

Huno is not a single AI prompt.

Huno is a system.

```text
Model = engine
Huno = harness
```

The harness includes:

- Project knowledge
- Memory
- Tools
- Permissions
- Context
- Terminal UX
- Provider routing
- Logs
- Future agents

The system should be designed so each part can improve independently.

The first goal is simple:

> Make `huno explain` understand a real project clearly.

Once that works, the rest of Huno can grow on top of it.
