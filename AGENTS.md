# AGENTS.md

> Canonical implementation instructions for all AI agents working on **Huno**.

This file is written for any coding agent, terminal agent, AI IDE assistant, or autonomous implementation system that works on this repository.

It is intentionally **tool-agnostic**. It should be usable by:

- Claude Code
- GitHub Copilot
- Cursor
- Codex-style agents
- Aider
- Cline
- OpenHands
- Devin-like agents
- Custom local agents
- Any LLM-powered terminal coding assistant

Do not assume the agent has access to a specific vendor, model, IDE, or platform. The instructions in this file define the expected product behavior, implementation standards, safety rules, architecture direction, and development workflow for Huno.

---

## 1. Project Identity

## Product Name

**Huno**

## Product Meaning

Huno sounds like:

> "Who knows?"

The product answer is:

> **Huno knows your codebase.**

Huno is a terminal-first AI developer tool that learns a software project, remembers project decisions, answers questions about the codebase, audits project quality, generates documentation, and eventually coordinates multiple specialized agents.

## Core Product Promise

> **Huno is the AI teammate that knows your codebase, remembers your decisions, and helps you build faster.**

## Primary Positioning

Huno is not just a chatbot.

Huno is a **developer harness** around language models.

A model alone can answer general programming questions. Huno gives the model:

- Project context
- File access
- Code search
- Project memory
- Terminal UI
- Tool execution
- Safety controls
- Permission checks
- Provider routing
- Eventually, multi-agent coordination

The most important distinction:

```text
ChatGPT knows programming.
Claude knows programming.
Gemini knows programming.

Huno knows the user's project.
```

---

## 2. Agent Mission

When working on this repository, the agent's mission is:

> Build Huno as a safe, local-first, terminal-native, project-aware AI developer assistant.

Every implementation decision should support one or more of these goals:

1. Make Huno understand the current project.
2. Make Huno remember useful project knowledge.
3. Make Huno answer questions based on actual repository context.
4. Make Huno safely inspect, document, and improve a codebase.
5. Make Huno's terminal experience clear, calm, and trustworthy.
6. Keep Huno provider-flexible and not locked to one AI vendor.
7. Build incrementally. Do not over-engineer early versions.

---

## 3. Non-Negotiable Principles

These principles are mandatory.

## 3.1 Project-Aware First

Huno must prioritize the user's actual project files and project memory over generic AI guesses.

Bad behavior:

```text
The agent gives a generic explanation without inspecting the repository.
```

Good behavior:

```text
The agent reads relevant files, builds context, cites filenames in the output, and explains based on actual project structure.
```

## 3.2 Safe by Default

Huno must not silently perform risky operations.

The following actions require explicit user approval:

- Writing files
- Modifying files
- Deleting files
- Running shell commands
- Installing dependencies
- Changing git history
- Pushing to remote
- Running Docker destructive commands
- Modifying environment files
- Editing production configuration

## 3.3 Local-First

The first working version of Huno should work locally.

Do not require cloud sync, accounts, hosted databases, or remote services for core functionality.

Core local storage should live under:

```text
.huno/
```

## 3.4 Provider-Flexible

Do not hardcode Huno to one model provider.

Huno should be able to support:

- OpenRouter
- Google Gemini
- NVIDIA NIM
- Groq
- Mistral
- Cerebras
- Ollama
- Local OpenAI-compatible servers
- Future providers

The provider layer must be abstracted.

## 3.5 Terminal-Native

Huno is primarily a CLI and terminal UI product.

It should feel natural from the terminal:

```bash
huno init
huno explain
huno ask "where is authentication?"
huno remember "we use JWT auth"
huno audit
```

Do not design the core around a web dashboard first.

A web dashboard can come later.

## 3.6 Show Your Work

Huno should show what it is doing.

When answering project questions, show:

- Files used as context
- Memories used as context
- Commands proposed
- Files modified
- Validation results

The user should never wonder:

```text
Did Huno actually read my project?
```

## 3.7 Build in Layers

Do not jump directly to a fully autonomous multi-agent system.

Build in this order:

```text
1. CLI foundation
2. Project scanner
3. Project explanation
4. Project Q&A
5. Memory
6. Audit
7. Documentation
8. Safe terminal tools
9. File editing
10. Multi-agent workflows
11. Cloud sync
```

---

## 4. Product Scope

## 4.1 MVP Scope

The MVP should include these commands:

```bash
huno init
huno explain
huno ask
huno remember
huno recall
huno audit
```

These are the most important early commands.

### `huno init`

Initializes Huno in the current project.

Creates:

```text
.huno/
├── config.json
├── memory.md
├── project-map.json
├── history.jsonl
├── logs/
└── cache/
```

### `huno explain`

Scans the repository and explains the project.

Should detect:

- Languages
- Frameworks
- Package managers
- App structure
- Backend structure
- Database usage
- Docker setup
- Test setup
- Important files
- Suggested next commands

### `huno ask`

Answers project-aware questions.

Example:

```bash
huno ask "where is authentication handled?"
```

The answer should use:

- Project files
- Code search
- Project map
- Memory
- Git metadata if relevant

### `huno remember`

Stores a project memory.

Example:

```bash
huno remember "The backend uses FastAPI and SQLAlchemy."
```

### `huno recall`

Searches project memory.

Example:

```bash
huno recall auth
```

### `huno audit`

Inspects the project for quality, architecture, documentation, security, testing, and developer experience issues.

---

## 4.2 Non-MVP Scope

Do not prioritize these in the first version:

- Cloud sync
- Web dashboard
- Fully autonomous code editing
- Marketplace plugins
- Team accounts
- Remote agent orchestration
- Fine-tuning custom LLMs
- Training models from scratch
- Browser automation
- Complex multi-agent scheduling

These can be future features.

---

## 5. Expected User Experience

## 5.1 First-Time Flow

A user should be able to run:

```bash
cd my-project
huno init
huno explain
```

Expected result:

```text
Huno scans the project, identifies the stack, builds a project map, and summarizes the repository clearly.
```

Then:

```bash
huno ask "how does this project work?"
```

Huno should answer using actual project context.

## 5.2 Daily Use Flow

A developer should use Huno like this:

```bash
huno ask "where is the dashboard page?"
huno ask "how does authentication work?"
huno remember "We decided to use local storage for guest users."
huno recall guest
huno audit
```

## 5.3 Safe Action Flow

When Huno wants to run or modify anything, the flow should be:

```text
1. Explain intended action.
2. Show files/commands involved.
3. Explain risk level.
4. Ask for approval.
5. Execute only after approval.
6. Show result.
7. Log action.
```

Example:

```text
Huno wants to run:

npm run lint

Reason:
Validate TypeScript and lint rules after editing frontend files.

Risk:
Low. This command should only read files and report issues.

Approve? [Y/n]
```

Risky example:

```text
Huno wants to run:

docker compose down -v

Risk:
High. This may delete local database volumes.

Approve? [y/N]
```

Default should be **No** for high-risk actions.

---

## 6. Recommended Technology Stack

Huno should be built with a TypeScript-first stack.

## 6.1 Core Stack

```text
Language: TypeScript
Runtime: Node.js
Package Manager: pnpm
CLI Framework: Commander.js
Terminal UI: Ink + termcn
Styling: terminal theme layer / chalk-compatible utilities
Prompting: Ink prompts or Inquirer-style prompts
Storage: local Markdown + JSON first, SQLite later
Search: ripgrep integration
LLM Provider Layer: OpenAI-compatible abstraction
Distribution: npm
```

## 6.2 Why TypeScript

Use TypeScript because:

- Huno is an npm-distributed CLI.
- Many target users are JavaScript/TypeScript developers.
- React-style terminal UI with Ink is natural.
- termcn can accelerate UI development.
- Provider SDKs are widely available.
- It aligns well with modern developer tooling.

## 6.3 Terminal UI Direction

Use:

```text
Ink + termcn
```

for the polished terminal UI.

Use native Ink components when termcn does not provide enough control.

Do not overbuild with a full-screen dashboard at first.

A normal command-based CLI with clean cards, sections, tables, and progress steps is enough for the MVP.

---

## 7. Repository Structure

Use this structure unless there is a strong reason to change it.

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
│   │   ├── agent.ts
│   │   ├── config.ts
│   │   ├── context.ts
│   │   ├── memory.ts
│   │   ├── provider.ts
│   │   ├── scanner.ts
│   │   ├── permissions.ts
│   │   ├── risk.ts
│   │   └── renderer.tsx
│   ├── tools/
│   │   ├── read-file.ts
│   │   ├── write-file.ts
│   │   ├── list-files.ts
│   │   ├── search-code.ts
│   │   ├── run-command.ts
│   │   ├── git-status.ts
│   │   └── git-diff.ts
│   ├── ui/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── ToolCallCard.tsx
│   │   │   ├── ApprovalPrompt.tsx
│   │   │   ├── ProgressSteps.tsx
│   │   │   ├── AuditTable.tsx
│   │   │   ├── WarningBox.tsx
│   │   │   └── ContextFiles.tsx
│   │   └── theme.ts
│   ├── providers/
│   │   ├── base.ts
│   │   ├── openrouter.ts
│   │   ├── gemini.ts
│   │   ├── groq.ts
│   │   ├── nvidia.ts
│   │   ├── mistral.ts
│   │   ├── cerebras.ts
│   │   └── ollama.ts
│   ├── storage/
│   │   ├── huno-dir.ts
│   │   ├── memory-file.ts
│   │   ├── project-map.ts
│   │   ├── history.ts
│   │   └── sqlite.ts
│   ├── prompts/
│   │   ├── system.ts
│   │   ├── explain.ts
│   │   ├── ask.ts
│   │   ├── audit.ts
│   │   └── doc.ts
│   └── utils/
│       ├── logger.ts
│       ├── paths.ts
│       ├── fs.ts
│       ├── gitignore.ts
│       └── errors.ts
├── tests/
│   ├── scanner.test.ts
│   ├── memory.test.ts
│   ├── risk.test.ts
│   └── config.test.ts
├── examples/
│   └── sample-project/
├── README.md
├── AGENTS.md
├── package.json
├── tsconfig.json
├── pnpm-lock.yaml
└── LICENSE
```

---

## 8. Coding Standards

## 8.1 General Rules

Use TypeScript strictly.

Prefer:

```ts
type Result<T> = {
  ok: true;
  data: T;
} | {
  ok: false;
  error: HunoError;
};
```

over throwing random untyped errors everywhere.

Write small modules.

Avoid large files that mix:

- CLI parsing
- business logic
- file system access
- UI rendering
- model calls

Each layer should have one responsibility.

## 8.2 Naming

Use clear names.

Good:

```ts
buildProjectMap()
loadHunoConfig()
searchCodebase()
classifyCommandRisk()
renderProjectSummary()
```

Bad:

```ts
doStuff()
handleThing()
processData()
magic()
```

## 8.3 Error Handling

Errors should be actionable.

Bad:

```text
Error: failed
```

Good:

```text
Could not read .huno/config.json.

Reason:
The file does not exist.

Suggested fix:
Run `huno init` in this project.
```

## 8.4 No Silent Failures

Never silently ignore:

- Missing config
- Failed file reads
- Failed command execution
- Provider API errors
- Invalid memory format
- Failed project scans

Always report enough information for the user to recover.

## 8.5 Keep Output Developer-Friendly

Avoid unnecessary hype.

Good:

```text
Found 3 possible issues in the backend API.
```

Bad:

```text
🚀 Amazing! Your magical codebase has been deeply analyzed by the ultimate AI system!
```

Huno should sound professional and calm.

---

## 9. CLI Design Rules

## 9.1 Command Names

Commands should be short and natural.

Preferred commands:

```bash
huno init
huno explain
huno ask
huno remember
huno recall
huno audit
huno doc
huno run
huno fix
huno team
```

Avoid overly technical flags unless necessary.

Bad:

```bash
huno --mode=contextual-inference --operation=repository-semantic-query
```

Good:

```bash
huno ask "where is the database config?"
```

## 9.2 Default Behavior

Commands should work with sensible defaults.

For example:

```bash
huno explain
```

should scan the current directory.

Use flags only for customization:

```bash
huno explain --deep
huno explain --json
huno audit --security
```

## 9.3 JSON Output

Where useful, support machine-readable output:

```bash
huno explain --json
huno audit --json
```

This helps future automation.

## 9.4 Exit Codes

Use meaningful exit codes.

```text
0 = success
1 = general failure
2 = invalid usage/config
3 = provider/API failure
4 = permission denied/cancelled
5 = validation failed
```

---

## 10. Terminal UI Rules

## 10.1 Visual Style

Huno terminal output should be:

```text
Minimal
Readable
Structured
Professional
Calm
```

Use:

- Sections
- Cards
- Tables
- Progress steps
- Warnings
- Approval prompts
- Context file lists

Do not overuse emojis.

Use symbols carefully:

```text
✓ completed
→ running
! warning
✕ failed
? approval needed
```

## 10.2 Standard Output Pattern

Most commands should follow this structure:

```text
Header
Context / what Huno found
Result
Warnings or risks
Next suggested action
```

Example:

```text
╭─ Huno ─────────────────────────────╮
│ Project Intelligence               │
╰────────────────────────────────────╯

✓ Scanned 142 files
✓ Found Next.js frontend
✓ Found FastAPI backend
✓ Found Docker Compose setup

Summary:
...

Suggested next command:
huno ask "how does authentication work?"
```

## 10.3 Context Transparency

When Huno uses files as context, show them.

Example:

```text
Using context:
- src/app/login/page.tsx
- src/components/LoginForm.tsx
- .huno/memory.md
```

## 10.4 Long Output

For long explanations:

- Use headings
- Use concise sections
- Avoid giant walls of text
- Provide summaries first
- Provide details after

---

## 11. Project Scanner Requirements

The project scanner is core to Huno.

It should identify:

## 11.1 General Project Metadata

- Project root
- Git repository status
- Package manager
- Languages
- Main frameworks
- Config files
- Environment files
- Docker files
- Build scripts
- Test scripts

## 11.2 JavaScript / TypeScript Projects

Detect:

- `package.json`
- `tsconfig.json`
- `next.config.*`
- `vite.config.*`
- `src/`
- `app/`
- `pages/`
- `components/`
- `lib/`
- `hooks/`
- `public/`

Extract:

- dependencies
- devDependencies
- scripts
- framework hints
- package manager

## 11.3 Python Projects

Detect:

- `pyproject.toml`
- `requirements.txt`
- `Pipfile`
- `poetry.lock`
- `main.py`
- `app/`
- `src/`
- `api/`
- `models/`
- `schemas/`

Framework hints:

- FastAPI
- Flask
- Django
- SQLAlchemy
- Pydantic

## 11.4 Backend API Hints

Detect:

- route files
- controller files
- API directories
- schema files
- model files
- database session/config files

## 11.5 Database Hints

Detect:

- Prisma
- SQLAlchemy
- Drizzle
- TypeORM
- Sequelize
- Alembic
- migrations
- database URLs in env examples

## 11.6 Infrastructure Hints

Detect:

- `Dockerfile`
- `docker-compose.yml`
- `.github/workflows`
- deployment files
- nginx configs
- env examples

## 11.7 Ignore Rules

Respect:

```text
.gitignore
.hunoignore
node_modules/
.git/
dist/
build/
.next/
venv/
.venv/
__pycache__/
coverage/
```

Never scan huge generated directories unless explicitly requested.

---

## 12. Project Map

Huno should create:

```text
.huno/project-map.json
```

This file should store summarized project metadata.

Example shape:

```json
{
  "version": "0.1.0",
  "projectName": "example-project",
  "root": "/path/to/project",
  "generatedAt": "2026-01-01T00:00:00.000Z",
  "stack": {
    "languages": ["TypeScript", "Python"],
    "frameworks": ["Next.js", "FastAPI"],
    "database": ["PostgreSQL"],
    "infrastructure": ["Docker Compose"]
  },
  "packageManagers": ["pnpm"],
  "importantFiles": [
    "package.json",
    "docker-compose.yml",
    "backend/src/main.py"
  ],
  "directories": {
    "frontend": "frontend/",
    "backend": "backend/",
    "docs": "docs/"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build"
  }
}
```

Keep this file useful but not too large.

Do not dump entire repository contents into it.

---

## 13. Memory System Requirements

## 13.1 Local Memory

Use:

```text
.huno/memory.md
```

for simple project memory.

Example format:

```md
# Huno Project Memory

## Decisions

- 2026-01-01: The project uses FastAPI for the backend.
- 2026-01-02: Guest users are stored in browser local storage.

## Preferences

- Use MUI Stack for layout.
- Prefer TypeScript strict types.

## Notes

- Advisor requested better documentation for the internship report.
```

## 13.2 History Log

Use:

```text
.huno/history.jsonl
```

for command history and agent actions.

Each line should be JSON.

Example:

```json
{"timestamp":"2026-01-01T00:00:00.000Z","command":"huno explain","status":"success"}
```

## 13.3 Memory Retrieval

`huno recall <query>` should search:

- memory headings
- memory body
- tags if implemented
- command history if relevant

## 13.4 Future SQLite Layer

SQLite can be added later for:

- structured memories
- semantic search metadata
- sessions
- tool calls
- audit history

Do not require SQLite in the very first prototype unless the implementation already has a good reason.

---

## 14. Provider System Requirements

## 14.1 Provider Interface

All model providers should implement a common interface.

Example:

```ts
export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type GenerateOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
};

export interface ModelProvider {
  name: string;
  generate(messages: ChatMessage[], options?: GenerateOptions): Promise<string>;
  stream?(messages: ChatMessage[], options?: GenerateOptions): AsyncIterable<string>;
}
```

## 14.2 Do Not Leak Provider Details

Commands should not care whether the provider is OpenRouter, Gemini, NVIDIA, Groq, or Ollama.

Bad:

```ts
if (provider === "openrouter") {
  // command-specific logic
}
```

Good:

```ts
const response = await provider.generate(messages, options);
```

## 14.3 Environment Variables

Use environment variables for API keys.

Example:

```bash
OPENROUTER_API_KEY=
GEMINI_API_KEY=
NVIDIA_API_KEY=
GROQ_API_KEY=
MISTRAL_API_KEY=
```

`.huno/config.json` should store the environment variable names, not raw secret values by default.

## 14.4 Local Provider Support

Ollama/local provider support should be possible.

Do not assume internet access is always available.

---

## 15. Tool System Requirements

Huno tools are controlled capabilities.

## 15.1 Read-Only Tools

These are generally safe:

```text
read_file
list_files
search_code
git_status
git_diff
read_config
```

These may run without explicit approval if they do not modify anything.

## 15.2 Write Tools

These require approval:

```text
write_file
patch_file
create_file
delete_file
format_file
```

## 15.3 Command Tools

These require approval:

```text
run_command
install_package
run_tests
run_docker
run_migration
```

Even "safe" commands should be shown before running.

## 15.4 Tool Result Format

Tool results should be structured.

Example:

```ts
type ToolResult<T> = {
  tool: string;
  ok: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
};
```

## 15.5 Tool Call Visibility

When Huno uses a tool, terminal output should show it clearly.

Example:

```text
Tool: search_code
Query: "auth"
Result: 12 matches in 5 files
```

---

## 16. Permission and Risk System

## 16.1 Risk Levels

Classify actions into:

```text
low
medium
high
destructive
```

## 16.2 Low Risk

Examples:

```text
Read file
List files
Search code
Read git status
Read package metadata
```

Default: allow.

## 16.3 Medium Risk

Examples:

```text
Run tests
Run linter
Run build
Create a new documentation file
```

Default: ask.

## 16.4 High Risk

Examples:

```text
Install packages
Modify source files
Edit config files
Run docker compose down
Run migrations
```

Default: ask with detailed warning.

## 16.5 Destructive

Examples:

```text
Delete files
Delete database volumes
Drop database
Reset git
Force push
Remove node_modules without request
Remove lockfiles
```

Default: deny unless explicit user confirmation.

## 16.6 Approval Prompt Requirements

Every approval prompt must show:

- Action
- Command or file path
- Reason
- Risk
- Expected result
- Default choice

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

## 17. Agent Behavior Rules

These rules apply to AI agents implementing Huno and to Huno agents once built.

## 17.1 Before Changing Code

The agent should:

1. Inspect relevant files.
2. Understand current patterns.
3. Make a concise plan.
4. Identify files to change.
5. Avoid unrelated edits.

## 17.2 While Changing Code

The agent should:

1. Keep changes minimal.
2. Preserve existing style.
3. Avoid breaking public APIs.
4. Avoid large rewrites without need.
5. Update tests/docs if behavior changes.

## 17.3 After Changing Code

The agent should:

1. Run relevant checks if available.
2. Show changed files.
3. Summarize changes.
4. Mention failures honestly.
5. Suggest next steps only if useful.

## 17.4 No Fake Validation

Never claim tests passed unless they actually ran.

Bad:

```text
Tests should pass.
```

Good:

```text
I did not run tests. Suggested validation: pnpm test.
```

## 17.5 No Unapproved Dependencies

Do not add dependencies casually.

Before adding a dependency, explain:

- Why it is needed
- Alternatives considered
- Package size/impact if relevant
- Whether native code is involved
- Whether it affects distribution

---

## 18. Prompt Design

Huno's internal prompts should be stored under:

```text
src/prompts/
```

Prompts should be specific, version-controlled, and easy to inspect.

## 18.1 System Prompt Goals

The system prompt should tell the model:

- You are Huno, a project-aware developer assistant.
- Prefer project context over generic answers.
- Show files used as context.
- Be honest about uncertainty.
- Ask for approval before risky actions.
- Do not invent project details.
- Keep answers structured and developer-friendly.

## 18.2 Ask Prompt

The ask prompt should include:

- User question
- Project map
- Relevant memories
- Relevant file excerpts
- Tool results
- Output format rules

## 18.3 Explain Prompt

The explain prompt should produce:

- Project overview
- Stack summary
- Important directories
- Key files
- How to run project if known
- Suggested next questions

## 18.4 Audit Prompt

The audit prompt should produce:

- High priority issues
- Medium priority issues
- Low priority issues
- Evidence
- Recommended fixes
- Confidence level

## 18.5 No Hallucinated Files

Huno must not reference files that were not found.

If unsure, say:

```text
I did not find a file that clearly handles authentication.
```

not:

```text
Authentication is probably in auth.ts.
```

---

## 19. Audit System Requirements

`huno audit` should start rule-based before becoming fully AI-based.

Rule-based checks are more reliable.

## 19.1 Initial Audit Checks

Check for:

- Missing README
- Missing `.env.example`
- Missing tests
- Missing package scripts
- Large source files
- TODO/FIXME comments
- Uncommitted changes
- Missing license
- Missing TypeScript strict mode
- Missing Docker docs if Docker files exist
- Inconsistent package manager files
- Common ignored directories committed accidentally

## 19.2 AI-Assisted Audit

After rule-based checks, Huno may ask the model to summarize and prioritize.

But the agent should not invent issues.

Every issue should include evidence:

```text
Evidence:
- package.json has no "test" script.
```

## 19.3 Audit Output Format

Use:

```text
High Priority
Medium Priority
Low Priority
Strengths
Suggested Next Actions
```

---

## 20. Documentation System Requirements

`huno doc` should generate useful documentation.

Supported future docs:

```text
README
Architecture overview
API overview
Setup guide
Environment guide
Changelog
Developer guide
```

## 20.1 Do Not Overwrite Without Approval

If generating docs, ask before overwriting existing files.

## 20.2 Documentation Should Reflect Actual Project

Do not generate fake setup commands.

If unknown, write:

```text
Setup command not detected.
```

not:

```bash
npm install && npm run dev
```

unless supported by project files.

## 20.3 README Generation

README should include:

- Project overview
- Tech stack
- Installation
- Environment variables
- Running locally
- Scripts
- Folder structure
- Development notes

---

## 21. Testing Requirements

Huno should have tests for core logic.

Minimum test areas:

```text
config loading
project scanning
memory read/write
risk classification
provider interface mocks
path ignore rules
command parsing
```

Do not rely only on manual testing.

## 21.1 Suggested Test Stack

Use a TypeScript-friendly test runner.

Examples:

```text
Vitest
Jest
Node test runner
```

Prefer Vitest if the project is already Vite/modern TypeScript oriented.

## 21.2 Mock Providers

Do not call real model APIs in normal tests.

Create mock providers.

Example:

```ts
class MockProvider implements ModelProvider {
  name = "mock";

  async generate() {
    return "mock response";
  }
}
```

## 21.3 Fixture Projects

Use small fixture projects under:

```text
tests/fixtures/
```

Example:

```text
tests/fixtures/next-fastapi/
tests/fixtures/node-basic/
tests/fixtures/python-fastapi/
```

---

## 22. Security and Privacy Rules

Huno will read user codebases. Treat this as sensitive.

## 22.1 Do Not Expose Secrets

Never print full secret values.

Detect and redact values that look like:

```text
API keys
tokens
passwords
database URLs
private keys
JWT secrets
```

Example:

```text
DATABASE_URL=postgres://****@localhost:5432/app
```

## 22.2 Do Not Send Entire Codebase Blindly

When calling a model provider, send only relevant context.

Avoid sending:

- Full `.env`
- Private keys
- Huge files
- Binary files
- Entire repositories

## 22.3 Respect Ignore Files

Respect:

```text
.gitignore
.hunoignore
```

Future: support `.hunoignore` explicitly.

## 22.4 User Consent

For external model providers, Huno should eventually make it clear that selected code context may be sent to the configured provider.

---

## 23. Configuration Requirements

Use:

```text
.huno/config.json
```

Example:

```json
{
  "version": "0.1.0",
  "projectName": "my-project",
  "defaultProvider": "openrouter",
  "defaultModel": "qwen/qwen3-coder",
  "apiKeys": {
    "openrouter": "OPENROUTER_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "nvidia": "NVIDIA_API_KEY",
    "groq": "GROQ_API_KEY"
  },
  "permissions": {
    "allowRead": true,
    "allowWrite": "ask",
    "allowCommand": "ask",
    "allowDestructive": false
  },
  "memory": {
    "enabled": true,
    "storage": "local"
  },
  "ui": {
    "theme": "default",
    "showToolCalls": true,
    "showContextFiles": true
  }
}
```

## 23.1 Config Loading Order

Recommended order:

```text
1. CLI flags
2. Environment variables
3. .huno/config.json
4. global user config
5. defaults
```

## 23.2 Config Errors

If config is missing, suggest:

```bash
huno init
```

If provider key is missing, explain clearly:

```text
Missing OPENROUTER_API_KEY.

Set it with:
export OPENROUTER_API_KEY="..."
```

---

## 24. Implementation Phases

Follow this roadmap.

## Phase 1: CLI Foundation

Implement:

```bash
huno --help
huno init
huno explain
```

Deliverables:

- package.json
- CLI entrypoint
- TypeScript build
- basic config creation
- project scanner
- simple terminal output

Acceptance criteria:

- `huno init` creates `.huno/`
- `huno explain` scans current directory
- command help works
- project builds successfully

## Phase 2: Project Scanner

Implement robust scanning.

Deliverables:

- stack detection
- package manager detection
- framework detection
- important file detection
- ignore rules
- project-map generation

Acceptance criteria:

- detects basic Node/TypeScript project
- detects Next.js project
- detects Python/FastAPI project
- skips ignored directories
- writes `.huno/project-map.json`

## Phase 3: Memory

Implement:

```bash
huno remember
huno recall
```

Deliverables:

- `.huno/memory.md`
- memory append
- memory search
- history logging

Acceptance criteria:

- memories persist
- recall finds relevant notes
- no duplicate initialization bugs

## Phase 4: Provider Layer

Implement:

- provider interface
- mock provider
- one real provider
- streaming later if possible

Acceptance criteria:

- commands can use mock provider
- real provider can be configured with env key
- errors are clean and actionable

## Phase 5: Ask Command

Implement:

```bash
huno ask "question"
```

Deliverables:

- context builder
- relevant file search
- memory inclusion
- provider call
- answer rendering

Acceptance criteria:

- answer uses project map
- answer lists context files
- answer avoids hallucinated paths
- works with mock provider in tests

## Phase 6: Audit Command

Implement:

```bash
huno audit
```

Deliverables:

- rule-based checks
- audit report renderer
- optional AI summary

Acceptance criteria:

- finds missing README
- finds missing env example
- finds missing tests/scripts
- outputs priorities

## Phase 7: Documentation

Implement:

```bash
huno doc
```

Deliverables:

- README generator
- architecture doc generator
- safe overwrite prompt

Acceptance criteria:

- never overwrites without approval
- generated docs reflect actual project map

## Phase 8: Safe Terminal Operations

Implement:

```bash
huno run "natural language task"
```

Deliverables:

- command suggestion
- risk classifier
- approval prompt
- command execution
- output summary

Acceptance criteria:

- risky commands require approval
- destructive commands default to No
- logs command execution

## Phase 9: Code Editing

Implement:

```bash
huno fix "task"
```

Deliverables:

- edit planning
- patch generation
- diff preview
- approval
- validation command suggestion

Acceptance criteria:

- no silent edits
- diff shown
- history logged

## Phase 10: Multi-Agent

Implement:

```bash
huno team "task"
```

Deliverables:

- manager agent
- researcher agent
- reviewer agent
- shared context
- task transcript

Acceptance criteria:

- agents have distinct roles
- outputs are consolidated
- no uncontrolled loops

---

## 25. Multi-Agent Design

Multi-agent mode should come later.

When implemented, use roles carefully.

## 25.1 Agent Roles

### Manager Agent

Responsibilities:

- Understand request
- Create task plan
- Decide which agents are needed
- Merge final output

### Research Agent

Responsibilities:

- Inspect files
- Search code
- Read docs
- Gather context

### Developer Agent

Responsibilities:

- Propose implementation
- Generate patches
- Follow project style

### Reviewer Agent

Responsibilities:

- Review changes
- Identify risks
- Check consistency

### Tester Agent

Responsibilities:

- Suggest validation
- Run approved tests
- Interpret failures

## 25.2 Avoid Agent Chaos

Do not let agents talk endlessly.

Every multi-agent run needs:

- Clear task
- Maximum steps
- Shared context
- Final output
- Stop condition

## 25.3 Agent Communication

Use structured messages.

Example:

```ts
type AgentMessage = {
  from: "manager" | "researcher" | "developer" | "reviewer" | "tester";
  to: string;
  type: "plan" | "context" | "proposal" | "review" | "result";
  content: string;
  metadata?: Record<string, unknown>;
};
```

---

## 26. Git Rules

Agents must respect git state.

## 26.1 Before Changes

Check:

```bash
git status
```

If there are uncommitted user changes, avoid overwriting them.

## 26.2 After Changes

Show:

```bash
git diff
```

or summarize changed files.

## 26.3 Do Not Commit Automatically

Do not run:

```bash
git commit
git push
git reset
git checkout
```

unless explicitly requested and approved.

## 26.4 Preserve User Work

Never overwrite unknown user edits.

---

## 27. Dependency Rules

## 27.1 Preferred Dependencies

For MVP:

```text
commander
typescript
tsx
ink
react
termcn
zod
```

Optional:

```text
execa
fast-glob
ignore
dotenv
```

Testing:

```text
vitest
```

## 27.2 Be Careful With Heavy Dependencies

Avoid adding large dependencies unless they clearly solve a core problem.

Before adding:

- Check if Node built-ins are enough
- Check maintenance quality
- Check install complexity
- Check ESM/CJS compatibility

## 27.3 Native Dependencies

Avoid native dependencies early if possible.

They complicate npm distribution.

---

## 28. Distribution Rules

Huno should be publishable as an npm package.

## 28.1 Package Name

Potential names:

```text
huno
@huno/cli
@kimhour/huno
```

If `huno` is unavailable on npm, use a scoped package.

## 28.2 CLI Binary

`package.json` should expose:

```json
{
  "bin": {
    "huno": "./dist/index.js"
  }
}
```

The CLI entrypoint must include:

```ts
#!/usr/bin/env node
```

## 28.3 Build Output

Use:

```text
src/ → dist/
```

Do not publish source-only unless intentionally configured.

---

## 29. Acceptance Criteria by Feature

## 29.1 `huno init`

Must:

- Create `.huno`
- Create config
- Create memory file
- Create history file
- Not overwrite existing files without confirmation
- Print next steps

## 29.2 `huno explain`

Must:

- Scan current project
- Detect stack
- Show important files/directories
- Save/update project map
- Suggest next commands
- Not require an API key for basic rule-based summary

## 29.3 `huno remember`

Must:

- Append memory safely
- Preserve existing memory
- Add timestamp
- Support optional tags eventually

## 29.4 `huno recall`

Must:

- Search memory
- Return relevant results
- Handle no matches gracefully

## 29.5 `huno ask`

Must:

- Require provider if AI response needed
- Build context from project map and files
- Show context files
- Avoid hallucinating missing files
- Handle provider failure gracefully

## 29.6 `huno audit`

Must:

- Run rule-based checks
- Prioritize issues
- Include evidence
- Avoid fake claims
- Work without model provider for basic checks

---

## 30. Common Mistakes to Avoid

Do not:

- Build multi-agent first.
- Build cloud sync first.
- Hardcode one provider.
- Send entire repositories to the model.
- Ignore `.gitignore`.
- Run shell commands silently.
- Modify files silently.
- Invent project details.
- Claim tests passed without running them.
- Add too many dependencies.
- Use flashy terminal UI that reduces readability.
- Make the CLI require complex setup.
- Store raw API keys in committed files.
- Overwrite user files without approval.
- Implement a huge abstraction before the MVP works.

---

## 31. Quality Bar

A feature is not complete just because it compiles.

A feature is complete when:

1. It works from the CLI.
2. It handles missing config.
3. It handles empty projects.
4. It handles common errors.
5. It has at least basic tests if core logic is involved.
6. It produces readable terminal output.
7. It respects safety rules.
8. It is documented enough for the next agent.

---

## 32. Recommended First Implementation Task

The first agent working on this repository should implement:

```bash
huno init
huno explain
```

Do not start with model APIs.

Reason:

- Huno must be useful even before provider setup.
- Project scanning is the foundation.
- It avoids early dependency on external APIs.
- It gives the product an immediate demo.

Expected first milestone:

```bash
pnpm install
pnpm dev -- init
pnpm dev -- explain
```

or:

```bash
huno init
huno explain
```

after linking.

---

## 33. Suggested Initial Files

Create these first:

```text
src/index.ts
src/commands/init.ts
src/commands/explain.ts
src/core/config.ts
src/core/scanner.ts
src/storage/huno-dir.ts
src/storage/project-map.ts
src/utils/paths.ts
src/utils/errors.ts
package.json
tsconfig.json
```

Minimum `package.json` shape:

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
    "test": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## 34. Huno Voice and Output Style

Huno should communicate like a focused developer tool.

Preferred style:

```text
Direct
Clear
Calm
Practical
Honest
```

Avoid:

```text
Overly cute language
Too much emoji
Marketing hype inside CLI output
Fake certainty
Long generic AI essays
```

Example good output:

```text
I found a Next.js app with a FastAPI backend.

The frontend appears to live in:
- frontend/

The backend appears to live in:
- backend/

The project uses Docker Compose:
- docker-compose.yml
```

Example bad output:

```text
Amazing! I have deeply and intelligently analyzed your wonderful project using advanced AI reasoning!
```

---

## 35. Huno's Core Mental Model

Every agent should understand this:

```text
Huno is not the model.
Huno is the harness.
```

The harness includes:

- CLI
- UI
- tools
- project map
- memory
- permissions
- context builder
- provider router
- logs
- workflows

The model is replaceable.

The Huno experience is the durable product.

---

## 36. Final Instruction to Agents

When implementing Huno:

1. Read `README.md`.
2. Read this `AGENTS.md`.
3. Start with the MVP.
4. Keep changes small.
5. Preserve safety.
6. Make the CLI useful before making it fancy.
7. Do not invent unsupported behavior.
8. Prefer local-first features.
9. Make every command clear and testable.
10. Remember the product promise:

> **Who knows your codebase? Huno knows.**

