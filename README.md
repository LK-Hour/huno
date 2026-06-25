# Huno
<p align="center">
  <img src="assets/huno_profile_256px.png" width="200" alt="Huno Profile">
</p>
> **Who knows your codebase? Huno knows.**

Huno is a project-aware AI developer tool designed to understand, remember, inspect, document, and eventually operate across your software projects from the terminal.

It is not just another chatbot. Huno is designed as a **developer harness**: a system around language models that gives them project context, memory, tools, terminal access, permission controls, file understanding, and structured workflows.

The long-term vision is simple:

> **Huno becomes the AI teammate that knows your codebase, remembers your decisions, and helps you build faster.**

---

## Table of Contents

- [What is Huno?](#what-is-huno)
- [Why the Name Huno?](#why-the-name-huno)
- [Core Idea](#core-idea)
- [Problem Statement](#problem-statement)
- [Who Huno is For](#who-huno-is-for)
- [What Huno Can Become](#what-huno-can-become)
- [Core Features](#core-features)
- [CLI Commands](#cli-commands)
- [Example Workflows](#example-workflows)
- [Terminal Experience](#terminal-experience)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Model Provider Strategy](#model-provider-strategy)
- [Memory System](#memory-system)
- [Agent System](#agent-system)
- [Tool System](#tool-system)
- [Permission and Safety Model](#permission-and-safety-model)
- [Configuration](#configuration)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [Roadmap](#roadmap)
- [Design Principles](#design-principles)
- [Comparison With Existing Tools](#comparison-with-existing-tools)
- [Future Vision](#future-vision)
- [License](#license)

---

## What is Huno?

Huno is an AI-powered developer operating system for the terminal.

It helps developers:

- Understand unfamiliar codebases
- Ask questions about a project
- Remember architecture decisions
- Audit code quality
- Generate documentation
- Run safe terminal workflows
- Coordinate multiple AI agents
- Build project knowledge over time

Huno starts as a CLI tool but can grow into a larger ecosystem:

```text
Huno
├── Huno CLI
├── Huno Memory
├── Huno Agents
├── Huno Cloud
├── Huno Studio
└── Huno OS
```

The first version should focus on one clear promise:

> **Huno understands your project better than a normal AI chat does.**

---

## Why the Name Huno?

Huno sounds like:

> **"Who knows?"**

That creates a simple product story:

> **Who knows your codebase? Huno knows.**

The name works well because the product is built around knowledge:

- Knowing your project structure
- Knowing your past decisions
- Knowing where features live
- Knowing how your backend and frontend connect
- Knowing what changed recently
- Knowing what needs to be fixed

Example:

```bash
huno ask "where is authentication handled?"
```

Huno should be able to answer based on your actual repository, project memory, and development history.

---

## Core Idea

Most AI tools know programming in general.

Huno should know **your project specifically**.

```text
ChatGPT knows programming.
Claude knows programming.
Gemini knows programming.

Huno knows your codebase.
```

This is the main difference.

Huno is not trying to become the best general-purpose AI model. Instead, it wraps existing models with a strong developer harness:

```text
LLM Provider
    │
    ▼
Huno Harness
    ├── Project scanner
    ├── File reader
    ├── Code search
    ├── Memory system
    ├── Tool execution
    ├── Terminal UI
    ├── Permission layer
    ├── Agent workflows
    └── Model router
```

The model is the engine.

Huno is the system around the engine.

---

## Problem Statement

Developers lose time every day because important project knowledge is scattered.

Common developer pain points:

### 1. Codebase Confusion

```text
Where is authentication?
Where are API routes?
Where is the database config?
Where is this component used?
How does this feature work?
```

### 2. Forgotten Decisions

```text
Why did we choose this structure?
Why did we use this library?
What did we decide in the last meeting?
What was the fix for this bug?
```

### 3. Documentation Rot

```text
README is outdated.
API docs are missing.
Architecture docs are incomplete.
Setup instructions are wrong.
```

### 4. Repeated AI Context Setup

Every time developers use an AI assistant, they often need to explain:

```text
This is a Next.js project.
This backend uses FastAPI.
The database is PostgreSQL.
We use Docker Compose.
This is how the folder structure works.
```

Huno should remove that repetition.

### 5. Unsafe AI Automation

AI coding tools can be powerful, but developers need control.

Huno should never silently perform risky actions. It should show:

- What files it wants to read
- What files it wants to edit
- What commands it wants to run
- What risks are involved
- What changed after execution

---

## Who Huno is For

Huno is designed for:

### Students

Especially students working on large projects, internships, capstones, or research projects.

Use cases:

```bash
huno explain
huno ask "how does this feature work?"
huno doc report
huno remember "advisor said to improve frontend error handling"
```

### Solo Developers

Developers who work on multiple projects and forget context.

Use cases:

```bash
huno recall "deployment"
huno audit
huno ask "what should I work on next?"
```

### Small Teams

Teams that need shared project memory and consistent documentation.

Use cases:

```bash
huno doc
huno decisions
huno team "review this feature"
```

### AI Tool Builders

Developers who want to build agent workflows, terminal assistants, and project-aware automation.

Use cases:

```bash
huno agent create reviewer
huno team run "audit backend API"
```

---

## What Huno Can Become

Huno can start simple:

```bash
huno explain
huno ask
huno audit
```

Then grow into:

```text
A project-aware AI command center
A terminal-first developer assistant
A memory system for software projects
A multi-agent developer workspace
A safe AI automation harness
```

The long-term goal is not only code generation.

The stronger goal is:

> **Project intelligence.**

---

## Core Features

## 1. Project Understanding

Command:

```bash
huno explain
```

Huno scans the repository and creates a project summary.

It should detect:

- Frameworks
- Languages
- Package managers
- Frontend structure
- Backend structure
- API routes
- Database models
- Environment variables
- Docker setup
- Testing setup
- Build scripts
- Important files

Example output:

```text
Huno Project Summary

Project: khmer-sign-language-platform

Stack:
- Frontend: Next.js, TypeScript, MUI
- Backend: FastAPI, Python, SQLAlchemy
- Database: PostgreSQL
- Infrastructure: Docker Compose

Important Areas:
- Frontend app routes: frontend/src/app
- Backend API: backend/src/api
- Database models: backend/src/models
- Config: backend/src/core/config.py
```

---

## 2. Project Q&A

Command:

```bash
huno ask "where is guest user sync implemented?"
```

Huno uses project files, memory, and code search to answer.

It should show which files it used:

```text
Using context:
- frontend/src/lib/guest-storage.ts
- frontend/src/hooks/useGuestSync.ts
- backend/src/api/users.py
- .huno/memory.md
```

This helps build trust.

---

## 3. Project Memory

Commands:

```bash
huno remember "We use JWT auth for backend sessions."
huno recall auth
huno memory list
```

Huno stores project knowledge in a local `.huno` directory.

Memory examples:

```text
- We use MUI Stack for layout instead of Box where possible.
- Guest users are stored in browser local storage.
- Backend uses FastAPI with SQLAlchemy models.
- Advisor requested better frontend error handling.
```

This is one of Huno's most important features.

The goal:

> The project should remember what the developer would otherwise forget.

---

## 4. Project Audit

Command:

```bash
huno audit
```

Huno checks the codebase for issues.

Audit categories:

```text
Architecture
Code quality
Security
Documentation
Testing
Performance
Dependency health
Environment setup
Developer experience
```

Example output:

```text
Huno Audit Report

High Priority:
- Missing .env.example for backend configuration.
- No validation found for some API request schemas.
- README does not explain Docker setup.

Medium Priority:
- Login page component is too large.
- Some frontend components mix UI and data fetching.
- Error handling is inconsistent across API calls.

Low Priority:
- Naming style differs between lesson components.
- Some comments are outdated.
```

---

## 5. Documentation Generation

Commands:

```bash
huno doc
huno doc readme
huno doc api
huno doc architecture
```

Huno can generate or update:

- README.md
- API documentation
- Architecture overview
- Setup guide
- Developer guide
- Changelog
- Report summaries
- Meeting notes

Example:

```bash
huno doc architecture
```

Output:

```text
Generated:
- docs/architecture.md
```

---

## 6. Safe Terminal Execution

Command:

```bash
huno run "start the project"
```

Huno can translate natural language into commands.

Example:

```text
Huno wants to run:

docker compose up --build

Reason:
This appears to be the project's full local startup command.

Approve? [Y/n]
```

Risky command example:

```text
Huno wants to run:

docker compose down -v

Risk:
This may delete local database volumes.

Approve? [y/N]
```

Huno should always ask before:

- Deleting files
- Overwriting files
- Running shell commands
- Installing dependencies
- Changing git history
- Modifying environment files
- Touching production config

---

## 7. Code Editing

Command:

```bash
huno fix "create loading skeleton for dashboard"
```

Workflow:

```text
1. Understand the task
2. Search relevant files
3. Propose a plan
4. Ask for approval
5. Edit files
6. Show diff
7. Run validation
8. Summarize result
```

Example:

```text
Plan:
1. Find dashboard route.
2. Check existing MUI layout.
3. Create loading.tsx.
4. Use Stack and Skeleton components.
5. Run TypeScript check.

Files to edit:
- src/app/dashboard/loading.tsx

Continue? [Y/n]
```

---

## 8. Multi-Agent Workflows

Command:

```bash
huno team "review the backend API"
```

Agents:

```text
Manager Agent
- Breaks down the task

Research Agent
- Finds relevant documentation and patterns

Developer Agent
- Suggests or applies code changes

Reviewer Agent
- Reviews quality and risks

Tester Agent
- Runs checks and reports failures
```

Example flow:

```text
Manager:
We need to audit backend API quality.

Researcher:
I found FastAPI route files and schema definitions.

Reviewer:
Some routes return inconsistent error formats.

Tester:
No API tests were found for auth endpoints.
```

Multi-agent mode should come later, after the single-agent CLI is stable.

---

## CLI Commands

The first version should stay small.

### Core MVP Commands

```bash
huno init
huno explain
huno ask
huno remember
huno recall
huno audit
```

### Extended Commands

```bash
huno doc
huno run
huno fix
huno test
huno diff
huno undo
huno history
huno config
```

### Future Commands

```bash
huno team
huno agent
huno cloud
huno sync
huno dashboard
```

---

## Command Reference

### `huno init`

Initialize Huno in the current project.

```bash
huno init
```

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

---

### `huno explain`

Explain the current project.

```bash
huno explain
```

Options:

```bash
huno explain --short
huno explain --deep
huno explain --json
```

---

### `huno ask`

Ask a project-aware question.

```bash
huno ask "where is authentication handled?"
```

Options:

```bash
huno ask "where is auth?" --files
huno ask "explain the API flow" --deep
huno ask "what changed recently?" --git
```

---

### `huno remember`

Store a project memory.

```bash
huno remember "Backend uses FastAPI and SQLAlchemy."
```

Options:

```bash
huno remember "Use MUI Stack for layout" --tag frontend
huno remember "Advisor requested better docs" --tag internship
```

---

### `huno recall`

Search memory.

```bash
huno recall auth
huno recall "advisor feedback"
```

---

### `huno audit`

Audit the project.

```bash
huno audit
```

Options:

```bash
huno audit --frontend
huno audit --backend
huno audit --security
huno audit --docs
huno audit --json
```

---

### `huno doc`

Generate documentation.

```bash
huno doc
huno doc readme
huno doc api
huno doc architecture
```

---

### `huno run`

Run terminal tasks safely.

```bash
huno run "start the backend"
huno run "check docker logs"
huno run "install dependencies"
```

---

### `huno fix`

Make code changes with approval.

```bash
huno fix "split login page into components"
huno fix "create loading.tsx for dashboard"
```

---

### `huno team`

Run a multi-agent workflow.

```bash
huno team "review frontend architecture"
```

Future feature.

---

## Example Workflows

## Workflow 1: Understanding a New Project

```bash
cd my-project
huno init
huno explain
```

Expected output:

```text
Huno scanned 214 files.

Detected:
- Next.js frontend
- FastAPI backend
- PostgreSQL database
- Docker Compose development environment

Suggested next questions:
1. huno ask "how does authentication work?"
2. huno ask "where are API routes?"
3. huno audit
```

---

## Workflow 2: Asking About a Feature

```bash
huno ask "how does guest user sync work?"
```

Expected output:

```text
Guest user sync appears to work through browser local storage on the frontend.

Relevant files:
- frontend/src/lib/guest-storage.ts
- frontend/src/hooks/useGuestUser.ts
- frontend/src/api/sync.ts

Summary:
1. Guest progress is stored locally.
2. When the user logs in, local progress is synchronized.
3. The backend receives lesson progress through the user progress API.
```

---

## Workflow 3: Saving a Decision

```bash
huno remember "Guest users should use browser local storage until login."
```

Later:

```bash
huno recall guest
```

Output:

```text
Memory found:
- Guest users should use browser local storage until login.
```

---

## Workflow 4: Auditing a Project

```bash
huno audit
```

Expected output:

```text
High priority:
- Missing test coverage for backend API.
- Environment variables are not fully documented.

Medium priority:
- Large frontend components should be split.
- Error handling format is inconsistent.

Low priority:
- README needs more screenshots.
```

---

## Workflow 5: Safe Code Editing

```bash
huno fix "create loading skeleton for the lesson page"
```

Expected flow:

```text
Huno found:
- src/app/lessons/page.tsx
- src/app/lessons/loading.tsx does not exist
- MUI Skeleton is already used in src/components/cards/LessonCardSkeleton.tsx

Plan:
1. Create src/app/lessons/loading.tsx
2. Match the existing lesson card layout
3. Use MUI Stack and Skeleton
4. Run TypeScript check

Apply changes? [Y/n]
```

---

## Terminal Experience

Huno should feel like a polished terminal product.

Design goals:

```text
Clear
Calm
Minimal
Useful
Safe
Project-aware
```

Recommended terminal UI elements:

```text
Cards
Tables
Progress steps
Tool-call blocks
Approval prompts
Diff previews
Warnings
Status indicators
```

Example:

```text
╭─ Huno ─────────────────────────────────────╮
│ Project Intelligence                       │
├────────────────────────────────────────────┤
│ Project: khmer-sign-language-platform      │
│ Stack: Next.js, FastAPI, PostgreSQL        │
│ Status: Ready                              │
╰────────────────────────────────────────────╯

✓ Scanned 142 files
✓ Found frontend routes
✓ Found backend models
✓ Built project map

Suggested next command:
huno ask "how does authentication work?"
```

---

## Architecture

High-level architecture:

```text
┌──────────────────────────────────────────────┐
│                  Huno CLI                    │
└──────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────┐
│              Command Router                  │
│  init | explain | ask | audit | doc | fix    │
└──────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────┐
│              Huno Core Runtime               │
├──────────────────────────────────────────────┤
│ Project Scanner                              │
│ Memory Manager                               │
│ Context Builder                              │
│ LLM Provider Router                          │
│ Tool Executor                                │
│ Permission Manager                           │
│ Response Renderer                            │
└──────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────┐
│                  Tools                       │
├──────────────────────────────────────────────┤
│ read_file                                    │
│ write_file                                   │
│ list_files                                   │
│ search_code                                  │
│ run_command                                  │
│ git_diff                                     │
│ create_doc                                   │
└──────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────┐
│                  Storage                     │
├──────────────────────────────────────────────┤
│ .huno/config.json                            │
│ .huno/memory.md                              │
│ .huno/project-map.json                       │
│ .huno/history.jsonl                          │
│ SQLite database                              │
└──────────────────────────────────────────────┘
```

---

## Project Structure

Recommended repository structure:

```text
huno/
├── src/
│   ├── index.ts
│   ├── commands/
│   │   ├── init.ts
│   │   ├── explain.ts
│   │   ├── ask.ts
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
│   │   └── renderer.tsx
│   ├── tools/
│   │   ├── read-file.ts
│   │   ├── write-file.ts
│   │   ├── list-files.ts
│   │   ├── search-code.ts
│   │   ├── run-command.ts
│   │   └── git-diff.ts
│   ├── ui/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── ToolCall.tsx
│   │   │   ├── ApprovalPrompt.tsx
│   │   │   ├── ProgressSteps.tsx
│   │   │   └── AuditTable.tsx
│   │   └── theme.ts
│   ├── providers/
│   │   ├── openrouter.ts
│   │   ├── gemini.ts
│   │   ├── groq.ts
│   │   ├── nvidia.ts
│   │   ├── ollama.ts
│   │   └── mistral.ts
│   ├── storage/
│   │   ├── sqlite.ts
│   │   ├── memory-file.ts
│   │   └── history.ts
│   └── utils/
│       ├── logger.ts
│       ├── paths.ts
│       └── prompts.ts
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

---

## Technology Stack

Recommended stack for Huno:

```text
Language: TypeScript
Runtime: Node.js
CLI Framework: Commander.js
Terminal UI: Ink + termcn
Styling: Chalk / terminal theme layer
Prompts: Inquirer or custom Ink prompts
LLM SDK: OpenAI-compatible SDK or Vercel AI SDK
Storage: SQLite + local Markdown files
Search: ripgrep
Package Manager: pnpm
Distribution: npm
```

Optional later:

```text
Workflow Engine: LangGraph
Local Models: Ollama
Vector Search: LanceDB, Chroma, or SQLite vector extension
Dashboard: OpenTUI
Remote Sync: Huno Cloud
```

---

## Model Provider Strategy

Huno should not depend on only one model provider.

It should support multiple providers:

```text
OpenRouter
Google Gemini
NVIDIA NIM
Groq
Mistral
Cerebras
Ollama
Local OpenAI-compatible servers
```

The goal is model flexibility.

Example config:

```json
{
  "provider": "openrouter",
  "model": "qwen/qwen3-coder",
  "apiKeyEnv": "OPENROUTER_API_KEY"
}
```

Future routing example:

```json
{
  "routing": {
    "coding": {
      "provider": "openrouter",
      "model": "qwen/qwen3-coder"
    },
    "reasoning": {
      "provider": "openrouter",
      "model": "deepseek/deepseek-r1"
    },
    "fast": {
      "provider": "gemini",
      "model": "gemini-flash"
    },
    "local": {
      "provider": "ollama",
      "model": "qwen2.5-coder:7b"
    }
  }
}
```

---

## Memory System

Huno memory should have three levels.

### 1. Global Memory

User-wide preferences.

Examples:

```text
- User prefers TypeScript.
- User prefers MUI Stack for layouts.
- User prefers short, direct explanations.
```

### 2. Project Memory

Project-specific decisions.

Examples:

```text
- This project uses FastAPI backend.
- Guest users are stored in browser local storage.
- The AI model is integrated into lesson practice.
```

### 3. Session Memory

Temporary context for the current task.

Examples:

```text
- Current task: create loading skeleton.
- Relevant files: dashboard/page.tsx, loading.tsx.
- Last error: missing MUI import.
```

Recommended local files:

```text
.huno/
├── memory.md
├── decisions.md
├── project-map.json
├── history.jsonl
└── sessions/
```

---

## Agent System

Huno should start with one agent.

Later, it can support multiple agents.

### Single-Agent Mode

```text
User
 │
 ▼
Huno Agent
 │
 ├── reads files
 ├── searches code
 ├── remembers notes
 ├── generates answers
 └── proposes actions
```

### Multi-Agent Mode

```text
User
 │
 ▼
Manager Agent
 │
 ├── Research Agent
 ├── Developer Agent
 ├── Reviewer Agent
 └── Tester Agent
```

Agent roles:

### Manager Agent

Responsible for:

- Understanding the user request
- Breaking work into steps
- Choosing agents
- Summarizing results

### Research Agent

Responsible for:

- Reading docs
- Inspecting project patterns
- Finding relevant files
- Explaining background

### Developer Agent

Responsible for:

- Creating code
- Editing files
- Refactoring
- Generating implementation plans

### Reviewer Agent

Responsible for:

- Checking code quality
- Finding risks
- Reviewing diffs
- Checking consistency

### Tester Agent

Responsible for:

- Running tests
- Reading errors
- Suggesting fixes
- Reporting validation status

---

## Tool System

Huno tools are controlled capabilities the agent can use.

Recommended tools:

### `read_file`

Reads a file.

```json
{
  "path": "src/app/page.tsx"
}
```

### `write_file`

Writes or updates a file.

Requires approval.

```json
{
  "path": "src/app/loading.tsx",
  "content": "..."
}
```

### `list_files`

Lists files in a directory.

```json
{
  "path": "src"
}
```

### `search_code`

Searches project files.

```json
{
  "query": "auth"
}
```

### `run_command`

Runs a terminal command.

Requires approval.

```json
{
  "command": "npm run lint"
}
```

### `git_diff`

Shows current changes.

```json
{
  "path": "."
}
```

---

## Permission and Safety Model

Huno should be safe by default.

### Safe Without Approval

Actions that can be allowed automatically:

```text
Read files
List directories
Search code
Read git status
Read package metadata
Read project config
```

### Requires Approval

Actions that should ask first:

```text
Write files
Modify files
Run shell commands
Install dependencies
Create migrations
Format files
Run Docker commands
```

### High-Risk Actions

Actions that should require explicit confirmation:

```text
Delete files
Delete database volumes
Change git history
Push to remote
Modify production config
Run destructive shell commands
Change environment variables
```

Example approval prompt:

```text
Huno wants to run:

docker compose down -v

Risk:
This may delete local database volumes.

Approve? [y/N]
```

### Safety Principles

Huno should:

- Show commands before running them
- Show file changes before applying them
- Show diffs after editing
- Keep history logs
- Support undo where possible
- Never hide destructive operations
- Prefer read-only operations by default

---

## Configuration

Example `.huno/config.json`:

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

---

## Installation

> Huno is currently a concept / early project. Installation commands below are proposed for future npm distribution.

Global installation:

```bash
npm install -g huno
```

or scoped package:

```bash
npm install -g @huno/cli
```

Run directly:

```bash
npx huno explain
```

or:

```bash
npx @huno/cli explain
```

---

## Quick Start

```bash
cd your-project
huno init
huno explain
huno ask "what is this project about?"
huno audit
```

Example:

```bash
huno remember "This project uses Next.js frontend and FastAPI backend."
huno recall backend
```

---

## Development Setup

Clone the repository:

```bash
git clone https://github.com/yourname/huno.git
cd huno
```

Install dependencies:

```bash
pnpm install
```

Run in development:

```bash
pnpm dev
```

Build:

```bash
pnpm build
```

Run locally:

```bash
node dist/index.js explain
```

Link globally for testing:

```bash
pnpm link --global
huno explain
```

---

## Environment Variables

Example `.env`:

```bash
OPENROUTER_API_KEY=
GEMINI_API_KEY=
NVIDIA_API_KEY=
GROQ_API_KEY=
MISTRAL_API_KEY=
```

Huno should not store raw API keys in project files unless the user explicitly chooses that.

Recommended approach:

```text
Store key names in .huno/config.json.
Store actual keys in environment variables.
```

---

## Roadmap

## Phase 1: CLI Foundation

Goal:

> Build a working CLI with project scanning and simple AI responses.

Features:

- `huno init`
- `huno explain`
- `huno ask`
- Basic provider config
- Basic file scanning
- Basic terminal output

---

## Phase 2: Project Memory

Goal:

> Let Huno remember project-specific knowledge.

Features:

- `huno remember`
- `huno recall`
- `.huno/memory.md`
- `.huno/history.jsonl`
- Tag-based memories
- Search memory from CLI

---

## Phase 3: Project Audit

Goal:

> Let Huno inspect project quality.

Features:

- `huno audit`
- Detect missing README sections
- Detect missing `.env.example`
- Detect large files
- Detect common project issues
- Generate audit reports

---

## Phase 4: Documentation Generator

Goal:

> Reduce documentation rot.

Features:

- `huno doc`
- Generate README
- Generate architecture docs
- Generate API docs
- Generate setup guide
- Update docs with approval

---

## Phase 5: Safe Terminal Operations

Goal:

> Let Huno run commands safely.

Features:

- `huno run`
- Command approval
- Risk classification
- Command logs
- Output summarization
- Retry suggestions

---

## Phase 6: Code Editing

Goal:

> Let Huno modify files safely.

Features:

- `huno fix`
- File editing
- Diff preview
- Approval prompt
- Test execution
- Undo support

---

## Phase 7: Multi-Agent Mode

Goal:

> Let multiple specialized agents collaborate.

Features:

- `huno team`
- Manager agent
- Research agent
- Developer agent
- Reviewer agent
- Tester agent
- Shared memory
- Task logs

---

## Phase 8: Huno Cloud

Goal:

> Synchronize project intelligence across machines.

Features:

- Remote memory sync
- Team knowledge base
- Shared project decisions
- Web dashboard
- Agent activity history

---

## Design Principles

### 1. Project-Aware First

Huno should always prioritize the user's actual project context.

### 2. Safe by Default

Huno should never silently perform risky actions.

### 3. Show Your Work

Huno should show:

- What files were read
- What commands are proposed
- What changes are made
- What assumptions are used

### 4. Memory Matters

Huno should get more useful over time.

### 5. Terminal-Native

Huno should feel natural inside the terminal.

### 6. Fast to Start

The first useful command should be easy:

```bash
huno explain
```

### 7. Model Flexible

Users should be able to choose different model providers.

### 8. Local First

Project memory should work locally before cloud features exist.

---

## Comparison With Existing Tools

### Huno vs ChatGPT

ChatGPT is general-purpose.

Huno is project-aware.

```text
ChatGPT can explain programming.
Huno can explain your project.
```

### Huno vs Claude Code

Claude Code is strong for coding tasks.

Huno should focus more on project memory, repo intelligence, and long-term project understanding.

### Huno vs Aider

Aider focuses on AI pair programming in git repositories.

Huno can include coding features, but its broader goal is project intelligence and memory.

### Huno vs Cursor

Cursor is an IDE-based AI coding environment.

Huno is terminal-first and can work across editors.

### Huno vs OpenHands

OpenHands is an autonomous software engineering agent.

Huno should be more controlled, local-first, and developer-guided.

---

## Future Vision

The long-term version of Huno could work like this:

```text
You open a project.

Huno already knows:
- What the project does
- How it is structured
- What changed recently
- What bugs exist
- What tasks are pending
- What decisions were made
- What commands are safe to run
- Which files matter most
```

Then you ask:

```bash
huno ask "what should I work on today?"
```

Huno answers:

```text
Based on recent project history and memory:

1. Finish frontend lesson practice UI.
2. Add tests for backend prediction API.
3. Update README setup instructions.
4. Fix inconsistent error handling in auth endpoints.
```

Eventually:

```bash
huno team "prepare this project for demo"
```

The agents collaborate:

```text
Manager:
Creates plan.

Researcher:
Checks project requirements.

Developer:
Fixes missing pieces.

Reviewer:
Checks quality.

Tester:
Runs validation.

Writer:
Generates final documentation.
```

That is the larger Huno vision.

---

## Product Taglines

Possible taglines:

```text
Huno knows your codebase.
```

```text
Ask Huno. It knows your project.
```

```text
Your project's second brain.
```

```text
Project intelligence for developers.
```

```text
The AI teammate that remembers your code.
```

```text
Stop searching. Ask Huno.
```

---

## MVP Definition

A strong MVP should answer this question:

> Can Huno understand one real project better than a normal AI chat?

Minimum MVP:

```bash
huno init
huno explain
huno ask
huno remember
huno recall
```

If those five commands work well, Huno is already valuable.

---

## Non-Goals

Huno should not initially try to:

- Train its own LLM
- Replace every IDE
- Become fully autonomous immediately
- Modify production systems
- Run dangerous commands without approval
- Support every programming language perfectly
- Build cloud sync before local memory works

---

## Development Philosophy

Build Huno in layers:

```text
Layer 1: Terminal CLI
Layer 2: Project scanner
Layer 3: Memory
Layer 4: Project Q&A
Layer 5: Audit
Layer 6: Documentation
Layer 7: Safe tools
Layer 8: Code editing
Layer 9: Multi-agent workflows
Layer 10: Cloud sync
```

Do not start with the hardest version.

Start with:

```bash
huno explain
```

Make that command excellent.

Then expand.

---

## License

This project can use the MIT License for maximum open-source flexibility.

```text
MIT License
```

---

## Final Vision Statement

Huno is a terminal-first AI developer tool that learns your project, remembers your decisions, and helps you build with confidence.

It is not only an AI assistant.

It is a project memory, a repo intelligence layer, a safe automation harness, and eventually a multi-agent development system.

> **Who knows your codebase? Huno knows.**
