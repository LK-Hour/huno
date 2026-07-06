# PRODUCT_SPEC.md

> Product specification for **Huno**.

This document defines what Huno should do from a user-facing product perspective.

Read this together with:

```text
README.md         → product vision
AGENTS.md         → implementation instructions for agents
ARCHITECTURE.md   → technical system design
TASKS.md          → implementation checklist and milestones
```

This file is intentionally detailed so implementation agents can rely on it when building Huno.

---

## 1. Product Summary

## 1.1 Product Name

**Huno**

## 1.2 Product Meaning

Huno sounds like:

> "Who knows?"

Product message:

> **Who knows your codebase? Huno knows.**

## 1.3 Product Category

Huno is a:

```text
Terminal-first AI developer assistant
Project intelligence tool
Local-first codebase memory system
AI harness for software development workflows
```

## 1.4 One-Sentence Description

Huno is a terminal-first AI developer tool that understands your project, remembers your decisions, answers questions about your codebase, audits project quality, and helps you build safely.

## 1.5 Core Promise

> **Huno knows your codebase.**

A normal AI assistant knows programming in general.

Huno should know:

- The user's project structure
- The user's tech stack
- Important files
- Project-specific decisions
- Known issues
- Documentation gaps
- How parts of the project connect

---

## 2. Product Goals

Huno should help developers:

1. Understand a codebase quickly.
2. Ask project-specific questions.
3. Save and recall project decisions.
4. Audit project health.
5. Generate documentation from actual project context.
6. Safely run development commands.
7. Safely edit files with review and approval.
8. Eventually coordinate multiple specialized AI agents.

---

## 3. Non-Goals

Huno should not initially try to:

- Train a custom LLM
- Replace every IDE
- Become fully autonomous immediately
- Require cloud accounts
- Require a hosted database
- Modify files silently
- Run terminal commands silently
- Push code automatically
- Become a web dashboard first
- Support every framework perfectly from day one
- Send entire repositories to model providers
- Store raw secrets in project files

---

## 4. Target Users

## 4.1 Student Developers

Students working on:

- Internship projects
- Capstone projects
- Final-year projects
- Research prototypes
- AI experiments
- Full-stack applications

Common needs:

```text
Understand my own project
Prepare reports
Remember advisor feedback
Explain architecture
Find files quickly
Improve code quality
```

## 4.2 Solo Developers

Developers with multiple projects who often forget context.

Common needs:

```text
What was this project about?
How do I run it?
Where is this feature implemented?
What should I fix next?
```

## 4.3 Small Teams

Teams that need lightweight project memory and documentation.

Common needs:

```text
Shared project decisions
Codebase onboarding
Architecture summaries
Documentation updates
Quality checks
```

## 4.4 AI Tool Builders

Developers experimenting with AI agents and coding automation.

Common needs:

```text
Provider routing
Tool execution
Agent workflows
Terminal UI
Local project memory
```

---

## 5. Product Principles

## 5.1 Project-Aware First

Huno should always prefer actual project evidence over generic assumptions.

If Huno has inspected files, it should say which files were used.

If Huno has not inspected enough, it should be honest.

## 5.2 Safe by Default

Huno should not perform risky operations without approval.

Risky operations include:

- Writing files
- Editing files
- Deleting files
- Running shell commands
- Installing dependencies
- Running migrations
- Changing git state
- Pushing to remote
- Editing environment files

## 5.3 Local-First

Huno should work locally inside a repository.

Default storage:

```text
.huno/
```

## 5.4 Provider-Flexible

Huno should support multiple AI providers instead of depending on one vendor.

## 5.5 Clear Terminal UX

Huno should communicate clearly in the terminal.

It should show:

- What it found
- What it used
- What it changed
- What it recommends next
- What risks exist

## 5.6 Build Incrementally

The MVP should be useful before advanced AI features exist.

The first useful version should not require model APIs.

---

## 6. MVP Definition

The MVP contains:

```bash
huno init
huno explain
huno remember
huno recall
huno audit
```

Optional MVP+ command:

```bash
huno ask
```

The first implementation milestone should focus on:

```bash
huno init
huno explain
```

because these commands do not require an AI provider and create the foundation for the rest of the product.

---

## 7. CLI Command Specification

---

# 7.1 `huno`

## Purpose

Launch Huno or show help when no command is provided.

## Usage

```bash
huno
```

## Expected Behavior

If no command is provided, Huno should show:

- Product name
- Short description
- Available commands
- Suggested first command

## Example Output

```text
Huno

Who knows your codebase? Huno knows.

Available commands:
  huno init        Initialize Huno in this project
  huno explain     Explain the current project
  huno ask         Ask a question about the project
  huno remember    Save a project memory
  huno recall      Search project memory
  huno audit       Audit project quality

Start with:
  huno init
```

## Acceptance Criteria

- Command runs without crashing.
- Shows available commands.
- Does not require a project to be initialized.
- Does not require an API key.

---

# 7.2 `huno init`

## Purpose

Initialize Huno inside the current project.

## Usage

```bash
huno init
```

## User Story

As a developer, I want to initialize Huno in my project so Huno can store project memory, project maps, history, logs, and configuration locally.

## Created Files and Directories

`huno init` should create:

```text
.huno/
├── config.json
├── memory.md
├── project-map.json
├── history.jsonl
├── logs/
└── cache/
```

## File Details

### `.huno/config.json`

Stores project-level Huno settings.

Default shape:

```json
{
  "version": "0.1.0",
  "projectName": "my-project",
  "defaultProvider": null,
  "defaultModel": null,
  "apiKeys": {
    "openrouter": "OPENROUTER_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "nvidia": "NVIDIA_API_KEY",
    "groq": "GROQ_API_KEY",
    "mistral": "MISTRAL_API_KEY",
    "cerebras": "CEREBRAS_API_KEY"
  },
  "permissions": {
    "allowRead": true,
    "allowWrite": "ask",
    "allowCommand": "ask",
    "allowDestructive": false
  },
  "memory": {
    "enabled": true,
    "storage": "markdown"
  },
  "ui": {
    "theme": "default",
    "showToolCalls": true,
    "showContextFiles": true,
    "verbose": false
  }
}
```

### `.huno/memory.md`

Default content:

```md
# Huno Project Memory

## Decisions

## Preferences

## Notes
```

### `.huno/project-map.json`

Can be initialized as an empty project map placeholder:

```json
{
  "version": "0.1.0",
  "projectName": "my-project",
  "generatedAt": null,
  "status": "not_generated"
}
```

### `.huno/history.jsonl`

Empty file.

### `.huno/logs/`

Directory for logs.

### `.huno/cache/`

Directory for temporary scan/cache data.

## Behavior Rules

- Must not overwrite existing Huno files silently.
- If `.huno/` already exists, show the status of existing files.
- If individual files are missing, create only missing files.
- Should not require an API key.
- Should work in any directory.
- Should infer project name from current directory if possible.

## Example Output

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

## Edge Cases

### `.huno/` Already Exists

Expected output:

```text
Huno is already initialized.

Found:
✓ .huno/config.json
✓ .huno/memory.md
✓ .huno/history.jsonl

Missing:
- .huno/cache/

Created missing files:
✓ .huno/cache/

Next step:
huno explain
```

### No Write Permission

Expected output:

```text
Could not initialize Huno.

Reason:
No write permission in the current directory.

Suggested fix:
Run Huno in a writable project directory.
```

## Acceptance Criteria

- Creates required files and directories.
- Does not overwrite existing files silently.
- Works without AI provider.
- Prints clear next step.
- Returns exit code `0` on success.
- Returns non-zero exit code on failure.

---

# 7.3 `huno explain`

## Purpose

Scan and explain the current project.

## Usage

```bash
huno explain
```

Optional:

```bash
huno explain --short
huno explain --deep
huno explain --json
```

## User Story

As a developer, I want Huno to explain my project so I can quickly understand its stack, structure, important files, and next actions.

## Inputs

- Current working directory
- `.huno/config.json` if available
- Existing `.huno/memory.md` if available
- Project files
- Git metadata if available

## Outputs

- Human-readable project summary
- Updated `.huno/project-map.json` if `.huno/` exists
- Optional JSON output

## Required Detection

Huno should detect:

```text
Project name
Git repository status
Languages
Frameworks
Package manager
Scripts
Important files
Important directories
Frontend/backend split
Database hints
Infrastructure hints
Test setup
Documentation files
Warnings
```

## Supported Detection Examples

### JavaScript / TypeScript

Detect:

```text
package.json
pnpm-lock.yaml
package-lock.json
yarn.lock
bun.lockb
tsconfig.json
vite.config.*
next.config.*
src/
app/
pages/
components/
lib/
hooks/
```

Framework hints:

```text
Next.js
React
Vite
Express
NestJS
Node.js
```

### Python

Detect:

```text
pyproject.toml
requirements.txt
Pipfile
poetry.lock
main.py
src/
app/
api/
models/
schemas/
```

Framework hints:

```text
FastAPI
Flask
Django
SQLAlchemy
Pydantic
```

### Infrastructure

Detect:

```text
Dockerfile
docker-compose.yml
.github/workflows/
.env.example
nginx.conf
```

### Database

Detect hints for:

```text
PostgreSQL
MySQL
SQLite
MongoDB
Prisma
Drizzle
SQLAlchemy
Alembic
TypeORM
Sequelize
```

## Output Structure

Recommended terminal output:

```text
╭─ Huno ─────────────────────────────╮
│ Project Intelligence               │
╰────────────────────────────────────╯

Project:
- Name: khmer-sign-language-platform
- Root: /path/to/project

Detected Stack:
- Frontend: Next.js, TypeScript, MUI
- Backend: FastAPI, Python
- Database: PostgreSQL
- Infrastructure: Docker Compose

Important Areas:
- frontend/     Frontend application
- backend/      Backend API
- docker-compose.yml     Local development services

Available Scripts:
- dev
- build
- lint

Warnings:
- .env.example was not found
- No test script detected

Suggested next commands:
- huno ask "how does authentication work?"
- huno audit
- huno remember "important project decision"
```

## Project Map Save Behavior

If `.huno/` exists, save or update:

```text
.huno/project-map.json
```

If `.huno/` does not exist, still show explanation but suggest:

```bash
huno init
```

## JSON Output

When using:

```bash
huno explain --json
```

Huno should output valid JSON only.

No decorative terminal UI.

## Edge Cases

### Empty Directory

Expected output:

```text
Huno scanned this directory but did not find a recognizable project structure.

Found:
- No package.json
- No pyproject.toml
- No source directory

Suggested next step:
Initialize a project or run Huno in a project directory.
```

### No `.huno/`

Expected output should still work:

```text
Huno can explain this project, but local memory is not initialized.

To enable project memory:
huno init
```

### Large Project

Expected behavior:

- Respect ignore rules.
- Skip generated directories.
- Do not scan huge binary files.
- Warn if scan was partial.

## Acceptance Criteria

- Works without API key.
- Detects common project structures.
- Saves project map if initialized.
- Does not scan ignored directories.
- Handles empty projects.
- Provides suggested next commands.
- Supports `--json`.

---

# 7.4 `huno remember`

## Purpose

Save a project memory.

## Usage

```bash
huno remember "The backend uses FastAPI and SQLAlchemy."
```

Optional future usage:

```bash
huno remember "Use MUI Stack for layout" --tag frontend
huno remember "Advisor requested better docs" --tag internship
```

## User Story

As a developer, I want to save project decisions and notes so Huno can recall them later.

## Input

- Memory text
- Optional tags
- Current date/time
- Current project root

## Output

- Updated `.huno/memory.md`
- Updated `.huno/history.jsonl`

## Behavior Rules

- Requires `.huno/` to exist.
- If `.huno/` does not exist, suggest `huno init`.
- Appends to memory without destroying existing content.
- Adds timestamp.
- Should not require AI provider.

## Memory Format

Example append:

```md
- 2026-06-24: The backend uses FastAPI and SQLAlchemy.
```

With tags later:

```md
- 2026-06-24 [frontend, mui]: Use MUI Stack for layout.
```

## Example Output

```text
Saved memory:

"The backend uses FastAPI and SQLAlchemy."

You can recall it with:
huno recall backend
```

## Edge Cases

### Empty Memory Text

Expected output:

```text
No memory text provided.

Usage:
huno remember "Your project note here"
```

### Not Initialized

Expected output:

```text
Huno memory is not initialized.

Run:
huno init
```

## Acceptance Criteria

- Appends note to `.huno/memory.md`.
- Preserves existing memory.
- Adds timestamp.
- Handles missing `.huno/`.
- Works without provider.

---

# 7.5 `huno recall`

## Purpose

Search project memory.

## Usage

```bash
huno recall auth
huno recall "advisor feedback"
```

## User Story

As a developer, I want to search previous project notes so I can recover decisions and context quickly.

## Input

- Search query
- `.huno/memory.md`

## Output

- Relevant memory snippets

## Behavior Rules

- Requires `.huno/memory.md`.
- Should work without provider.
- Search can start as simple case-insensitive text matching.
- Later can add semantic search.

## Example Output

```text
Memory results for: auth

1. 2026-06-24:
   The project uses JWT auth for backend sessions.

2. 2026-06-25:
   Auth state is stored in browser local storage for guest users.
```

## No Results Output

```text
No memory found for: payment

Tip:
Save one with:
huno remember "Your note about payment"
```

## Acceptance Criteria

- Searches memory file.
- Shows relevant results.
- Handles no results clearly.
- Does not require provider.

---

# 7.6 `huno ask`

## Purpose

Ask a project-aware question.

## Usage

```bash
huno ask "where is authentication handled?"
```

Optional:

```bash
huno ask "how does the backend work?" --deep
huno ask "where is auth?" --json
huno ask "explain guest user sync" --local
```

## User Story

As a developer, I want to ask questions about my project and get answers based on actual files and memory.

## Inputs

- User question
- Project map
- Memory snippets
- Relevant file excerpts
- Provider configuration
- Ignore rules

## Output

- Answer
- Context files used
- Warnings if context is incomplete

## Behavior Rules

- Should use project context before model generation.
- Must show files used as context unless disabled.
- Must not invent file paths.
- Must not send entire repository to provider.
- Must redact secrets.
- Requires provider unless local/mock mode exists.
- If project map is missing, run a lightweight scan or suggest `huno explain`.

## Context Selection

Huno should gather context from:

```text
.huno/project-map.json
.huno/memory.md
Relevant source files
Relevant documentation files
Package/config files
Git metadata if useful
```

## Example Output

```text
Using context:
- backend/src/api/auth.py
- backend/src/models/user.py
- frontend/src/lib/auth.ts
- .huno/memory.md

Answer:
Authentication appears to be handled in the backend auth API and connected to the frontend auth utility.

Backend:
- backend/src/api/auth.py defines login/register routes.
- backend/src/models/user.py defines the user model.

Frontend:
- frontend/src/lib/auth.ts stores and sends auth tokens.

I did not find enough evidence to confirm refresh-token behavior.
```

## Not Enough Context Output

```text
I could not find enough project context to answer confidently.

I searched for:
- auth
- authentication
- login
- token

No clear authentication implementation was found.
```

## Provider Missing Output

```text
No model provider is configured.

Set one with:
huno config provider openrouter

Or set an API key:
export OPENROUTER_API_KEY="..."
```

## Acceptance Criteria

- Uses project map and memory.
- Finds relevant files.
- Shows context files.
- Redacts secrets.
- Handles missing provider.
- Avoids hallucinated files.
- Logs command history.

---

# 7.7 `huno audit`

## Purpose

Audit project quality.

## Usage

```bash
huno audit
```

Optional:

```bash
huno audit --frontend
huno audit --backend
huno audit --security
huno audit --docs
huno audit --json
```

## User Story

As a developer, I want Huno to inspect my project and tell me what needs improvement.

## Inputs

- Project files
- Project map
- Package/config files
- Documentation files
- Git metadata
- Optional provider for summary

## Output

- Audit report
- Issues with severity
- Evidence
- Recommendations
- Strengths
- Suggested next actions

## Audit Categories

```text
Documentation
Testing
Security
Architecture
Dependencies
Developer experience
Project structure
Configuration
```

## Initial Rule-Based Checks

Huno should check for:

```text
Missing README
Missing LICENSE
Missing .env.example
Missing test script
Missing build script
Missing tests directory
Multiple package manager lockfiles
Large source files
TODO/FIXME comments
Docker files without setup docs
TypeScript strict mode disabled
Uncommitted git changes
Potential committed secrets
Missing ignore rules
```

## Example Output

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

Low Priority:
1. README could be improved
   Evidence:
   - README exists but does not mention Docker setup.
   Recommendation:
   - Add local development instructions.

Strengths:
- Docker Compose file detected.
- TypeScript config found.
```

## JSON Output

When using:

```bash
huno audit --json
```

Huno must output valid JSON only.

## Acceptance Criteria

- Works without provider.
- Produces evidence-backed issues.
- Does not invent issues.
- Supports severity levels.
- Supports JSON output.
- Handles empty projects.

---

# 7.8 `huno doc`

## Purpose

Generate or update project documentation.

## Status

Future command after MVP.

## Usage

```bash
huno doc
huno doc readme
huno doc architecture
huno doc api
huno doc setup
```

## User Story

As a developer, I want Huno to generate documentation from actual project context so my docs stay useful and accurate.

## Behavior Rules

- Must scan project first.
- Must use project map and memory.
- Must not invent setup commands.
- Must ask before overwriting files.
- Should preview target files and changes.

## Supported Docs

```text
README.md
docs/architecture.md
docs/api.md
docs/setup.md
docs/environment.md
docs/changelog.md
```

## Example Flow

```text
Huno will generate:

docs/architecture.md

Using context:
- .huno/project-map.json
- package.json
- docker-compose.yml
- backend/src/main.py

Risk:
Medium. This will create a new documentation file.

Approve? [Y/n]
```

## Acceptance Criteria

- Does not overwrite without approval.
- Generated content reflects actual project evidence.
- Shows files used as context.
- Handles missing provider if AI is required.

---

# 7.9 `huno run`

## Purpose

Run development commands safely using natural language.

## Status

Future command after safety layer exists.

## Usage

```bash
huno run "start the project"
huno run "check backend logs"
huno run "run tests"
```

## User Story

As a developer, I want to ask Huno to run common development commands while staying in control of what executes.

## Behavior Rules

- Must propose command before running.
- Must classify risk.
- Must ask approval.
- Must stream or show command output.
- Must summarize result.
- Must log command history.

## Example Output

```text
Huno wants to run:

pnpm dev

Reason:
package.json defines "dev" as the development command.

Risk:
Medium. This starts a local development process.

Approve? [Y/n]
```

## High-Risk Example

```text
Huno wants to run:

docker compose down -v

Risk:
High. This may delete local database volumes.

Approve? [y/N]
```

## Acceptance Criteria

- Never runs commands silently.
- Defaults to No for high-risk commands.
- Logs result.
- Handles command failure clearly.

---

# 7.10 `huno fix`

## Purpose

Safely edit code or documentation.

## Status

Future command after provider, tool, and permission layers exist.

## Usage

```bash
huno fix "create loading skeleton for dashboard"
huno fix "split login page into smaller components"
```

## User Story

As a developer, I want Huno to propose and apply code changes safely, with review and approval.

## Behavior Rules

- Must inspect relevant files first.
- Must propose a plan.
- Must show files to edit.
- Must ask approval before editing.
- Must show diff.
- Must suggest or run validation with approval.
- Must not make unrelated changes.

## Example Flow

```text
Task:
Create loading skeleton for dashboard.

Huno found:
- src/app/dashboard/page.tsx
- MUI Skeleton is already used in src/components/LessonCardSkeleton.tsx

Plan:
1. Create src/app/dashboard/loading.tsx.
2. Match dashboard layout.
3. Use MUI Stack and Skeleton.
4. Run TypeScript check.

Files to modify:
- src/app/dashboard/loading.tsx

Approve? [Y/n]
```

After edit:

```text
Changes applied.

Modified:
- src/app/dashboard/loading.tsx

Validation:
Not run.

Suggested:
pnpm typecheck
```

## Acceptance Criteria

- No silent edits.
- Shows plan before changes.
- Shows diff after changes.
- Avoids unrelated changes.
- Does not claim validation passed unless run.

---

# 7.11 `huno team`

## Purpose

Run multi-agent workflows.

## Status

Future command.

## Usage

```bash
huno team "review backend API"
huno team "prepare this project for demo"
```

## User Story

As a developer, I want multiple specialized agents to collaborate on a task while Huno manages the workflow.

## Agent Roles

```text
Manager Agent
Research Agent
Developer Agent
Reviewer Agent
Tester Agent
Writer Agent
```

## Behavior Rules

- Must have clear stop condition.
- Must limit agent turns.
- Must log agent messages.
- Must consolidate final answer.
- Must not run commands or edit files without approval.
- Must avoid infinite loops.

## Acceptance Criteria

- Agents have distinct roles.
- Final result is consolidated.
- Tool use is visible.
- No uncontrolled loops.

---

## 8. Global Options

Huno should support common global flags.

```bash
huno --help
huno --version
huno --verbose
huno --quiet
huno --json
```

## `--help`

Shows help.

## `--version`

Shows package version.

## `--verbose`

Shows detailed logs and stack traces.

## `--quiet`

Minimizes non-essential output.

## `--json`

Outputs machine-readable JSON where supported.

---

## 9. Terminal UX Requirements

## 9.1 Tone

Huno should sound:

```text
Clear
Calm
Professional
Direct
Useful
Honest
```

Avoid:

```text
Too much emoji
Over-hype
Fake confidence
Long generic essays
Unclear errors
```

## 9.2 Visual Language

Use symbols carefully:

```text
✓ success
→ running
! warning
✕ failed
? approval needed
```

## 9.3 Standard Output Sections

Most command outputs should include:

```text
Header
What Huno found
Result
Warnings
Suggested next action
```

## 9.4 Context Visibility

For AI answers, show:

```text
Using context:
- file path
- memory snippet
- project map
```

## 9.5 Approval Prompt Requirements

Approval prompts must include:

```text
Action
Files or command
Reason
Risk level
Expected result
Default choice
```

---

## 10. Risk and Permission Product Rules

## 10.1 Risk Levels

```text
low
medium
high
destructive
```

## 10.2 Low Risk

Examples:

```text
Read file
List files
Search code
Read config
Read git status
```

Default:

```text
Allowed
```

## 10.3 Medium Risk

Examples:

```text
Run tests
Run lint
Run build
Create docs
Start dev server
```

Default:

```text
Ask
```

## 10.4 High Risk

Examples:

```text
Modify source files
Install packages
Run migrations
Edit config
Run Docker state-changing commands
```

Default:

```text
Ask with warning
```

## 10.5 Destructive

Examples:

```text
Delete files
Delete database volumes
Drop database
Reset git history
Force push
Delete lockfiles
```

Default:

```text
Deny unless explicitly confirmed
```

---

## 11. Project Scanning Product Rules

Huno should scan enough to understand the project but not so much that it becomes slow or unsafe.

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

## Should Respect

```text
.gitignore
.hunoignore
```

## Should Avoid

```text
Binary files
Large generated files
.env files
Private keys
Lockfile contents unless only detecting existence
```

---

## 12. Privacy and Security Product Rules

## 12.1 Secret Handling

Huno must not print or send raw secrets.

Redact:

```text
API keys
tokens
passwords
database URLs
private keys
JWT secrets
.env values
```

## 12.2 External Providers

When Huno sends context to an external model provider, it should only send relevant selected context.

Future UX should clearly show provider usage.

## 12.3 No Full Repo Upload

Huno should never blindly send an entire repository to a provider.

---

## 13. Data Files Product Contract

## `.huno/config.json`

Stores settings.

Must be human-readable JSON.

## `.huno/memory.md`

Stores project notes.

Must be human-readable Markdown.

## `.huno/project-map.json`

Stores machine-readable project summary.

Must be safe to regenerate.

## `.huno/history.jsonl`

Stores append-only command history.

Must avoid raw secrets.

## `.huno/logs/`

Stores diagnostic logs.

Must not contain secrets by default.

## `.huno/cache/`

Stores temporary cache.

Safe to delete.

---

## 14. Error Message Requirements

Errors should explain:

```text
What failed
Why it failed if known
How to fix it
```

## Example

Bad:

```text
Error: ENOENT
```

Good:

```text
Could not find .huno/config.json.

Reason:
This project has not been initialized.

Suggested fix:
Run:
huno init
```

## Common Error Cases

```text
Project not initialized
No provider configured
Missing API key
Permission denied
File read failed
File write failed
Command failed
Invalid config
Corrupted project map
```

---

## 15. Exit Codes

Recommended exit codes:

```text
0 = success
1 = general failure
2 = invalid usage or config
3 = provider/API failure
4 = permission denied or cancelled
5 = validation failed
```

---

## 16. Logging Product Rules

Huno should log useful command history.

History should include:

```text
timestamp
command
status
duration
files read
files changed
tools used
provider used
error summary
```

Do not log:

```text
raw API keys
full .env content
private keys
large full file contents
```

---

## 17. Configuration Product Rules

## Config Priority

Use this order:

```text
1. CLI flags
2. Environment variables
3. .huno/config.json
4. global user config
5. defaults
```

## API Key Handling

`.huno/config.json` should store environment variable names, not raw key values.

Example:

```json
{
  "apiKeys": {
    "openrouter": "OPENROUTER_API_KEY"
  }
}
```

The user sets:

```bash
export OPENROUTER_API_KEY="..."
```

---

## 18. User Stories and Acceptance Criteria

## Story 1: Initialize Project

As a developer, I can run:

```bash
huno init
```

So that Huno creates local project storage.

Acceptance:

- `.huno/` exists.
- Required files exist.
- Existing files are not overwritten silently.
- Output suggests `huno explain`.

## Story 2: Understand Project

As a developer, I can run:

```bash
huno explain
```

So that I quickly understand the project.

Acceptance:

- Stack is detected.
- Important files are shown.
- Project map is saved.
- Warnings are shown.
- No provider required.

## Story 3: Save Decision

As a developer, I can run:

```bash
huno remember "We use JWT auth."
```

So that Huno remembers project decisions.

Acceptance:

- Memory is appended.
- Timestamp is added.
- Existing memory remains.
- No provider required.

## Story 4: Recall Decision

As a developer, I can run:

```bash
huno recall auth
```

So that I can find previous notes.

Acceptance:

- Relevant notes are shown.
- No result state is handled.
- No provider required.

## Story 5: Ask About Code

As a developer, I can run:

```bash
huno ask "where is auth handled?"
```

So that Huno answers using project files.

Acceptance:

- Relevant files are found.
- Context files are shown.
- Answer uses project evidence.
- Missing provider is handled clearly.

## Story 6: Audit Quality

As a developer, I can run:

```bash
huno audit
```

So that Huno finds project issues.

Acceptance:

- Rule-based checks run.
- Issues include evidence.
- Severity is clear.
- JSON output works.

---

## 19. MVP Acceptance Checklist

The MVP is ready when:

```text
[ ] huno --help works
[ ] huno --version works
[ ] huno init works
[ ] huno explain works without provider
[ ] huno remember works
[ ] huno recall works
[ ] huno audit works without provider
[ ] .huno/config.json is created
[ ] .huno/memory.md is created
[ ] .huno/project-map.json is created/updated
[ ] .huno/history.jsonl is created
[ ] ignored directories are skipped
[ ] errors are actionable
[ ] no raw secrets are printed
[ ] package builds
[ ] basic tests pass
```

---

## 20. First Build Scope

The first agent implementation should build only:

```bash
huno init
huno explain
```

## First Build Must Include

```text
package.json
tsconfig.json
src/index.ts
src/commands/init.ts
src/commands/explain.ts
src/core/scanner.ts
src/core/config.ts
src/storage/huno-dir.ts
src/storage/project-map.ts
src/utils/paths.ts
src/utils/errors.ts
```

## First Build Must Not Include

```text
Multi-agent system
Code editing
Shell command execution
Cloud sync
Vector database
Provider routing
Autonomous workflows
```

## First Build Acceptance

```bash
pnpm install
pnpm dev -- --help
pnpm dev -- init
pnpm dev -- explain
pnpm build
```

All should work.

---

## 21. Product Roadmap

## Phase 1: Foundation

```text
huno init
huno explain
project scanner
project map
basic terminal output
```

## Phase 2: Memory

```text
huno remember
huno recall
memory search
history log
```

## Phase 3: Audit

```text
huno audit
rule-based checks
audit report
JSON output
```

## Phase 4: Ask

```text
huno ask
provider config
context builder
memory + file context
answer rendering
```

## Phase 5: Documentation

```text
huno doc
README generation
architecture docs
setup guide
safe overwrite prompts
```

## Phase 6: Safe Terminal Operations

```text
huno run
command proposal
risk classifier
approval prompt
command logs
```

## Phase 7: Code Editing

```text
huno fix
plan generation
patch preview
diff review
validation suggestions
```

## Phase 8: Multi-Agent

```text
huno team
manager agent
research agent
developer agent
reviewer agent
tester agent
```

## Phase 9: Cloud and Sync

```text
remote memory sync
shared team knowledge
web dashboard
agent history
```

---

## 22. Product Quality Bar

A Huno feature is complete only when:

1. It works from the CLI.
2. It has clear output.
3. It handles missing config.
4. It handles empty projects if relevant.
5. It handles errors gracefully.
6. It respects safety rules.
7. It does not expose secrets.
8. It logs relevant history.
9. It has tests for core logic.
10. It is documented enough for the next developer or agent.

---

## 23. Final Product Direction

Huno should not start as a massive autonomous agent.

It should start as a reliable project intelligence CLI.

The first major product milestone is:

> **A developer can run `huno explain` inside any project and immediately understand the codebase better.**

Everything else builds from that foundation.

The final direction remains:

> **Who knows your codebase? Huno knows.**
