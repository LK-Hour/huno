# Huno Interactive REPL — Implementation Plan

> **Goal**: Upgrade Huno's REPL from a readline + console.log architecture to a Claude-style Ink-based interactive UI with streaming output, tool activity timeline, permission prompts, and slash commands.

---

## 1. Current State Summary

### What exists today

| Layer | Status |
|-------|--------|
| **Ink components** | 11 components already built (Header, ToolCallCard, ReplPrompt, ApprovalPrompt, ProjectCard, ProgressSteps, AuditTable, WarningBox, ErrorBox, ContextFiles) — all use `Box` + `Text` from Ink |
| **Theme system** | Complete `src/ui/theme.ts` with brand, semantic, neutral, risk, progress color tokens |
| **Renderer** | `renderUI()` helper wraps `inkRender()` with mount/unmount lifecycle — but only used as one-shot static renders |
| **Conversation engine** | `runConversation()` in `src/core/conversation.ts` supports `onStream` callback and `onToolCall` callback |
| **REPL loop** | `src/repl.ts` uses Node.js `readline` + `console.log`/`process.stdout.write` for all output — **zero Ink usage in interactive mode** |
| **Streaming** | Works via `process.stdout.write()` directly — bypasses Ink entirely |
| **Slash commands** | 17 commands defined, all handled via plain string matching in `onLine` callback |

### The core problem

**Ink's `render()` clears the terminal on each call.** The current `renderUI()` helper unmounts/remounts on every invocation. If we use this pattern for streaming, each token would clear the screen and re-render — causing flickering and losing the streaming text.

The REPL currently avoids this by using raw `process.stdout.write()` for streaming and never calling `render()` during active conversation turns.

### Dependencies already installed

| Package | Version | Purpose |
|---------|---------|---------|
| `ink` | ^7.1.0 | Core terminal UI framework |
| `react` | ^19.2.7 | Required by Ink |
| `chalk` | ^5.3.0 | Color output (used in current REPL) |
| `commander` | ^11.1.0 | CLI framework |

**NOT installed**: `ink-text-input`, `ink-spinner`, `ink-gradient`, `ink-link`, `figures`

---

## 2. Architecture Decision: Ink + Streaming Coexistence

### The fundamental conflict

Ink uses a **reactive rendering model**: you call `render(<App/>)` and Ink manages the full terminal output. Each render pass can clear and redraw everything. Streaming text via `process.stdout.write()` gets overwritten by the next `render()` call.

### Solution: **Hybrid rendering with phase-based architecture**

The REPL operates in distinct **phases**. In each phase, only ONE rendering strategy is active:

```
┌─────────────────────────────────────────────────────────┐
│  Phase: IDLE (waiting for input)                        │
│  Strategy: Full Ink render                              │
│  Components: Header + history + input box + status bar  │
├─────────────────────────────────────────────────────────┤
│  Phase: STREAMING (receiving tokens)                   │
│  Strategy: Raw stdout ONLY (Ink is NOT rendered)        │
│  Output: Direct process.stdout.write()                  │
├─────────────────────────────────────────────────────────┤
│  Phase: TOOL_EXECUTION (running tools)                  │
│  Strategy: Raw stdout for tool status lines             │
│  Components: → Reading file.py / ✓ Done                 │
├─────────────────────────────────────────────────────────┤
│  Phase: APPROVAL (waiting for y/n)                      │
│  Strategy: Ink render (modal overlay)                   │
│  Components: ApprovalPrompt with arrow-key selection    │
├─────────────────────────────────────────────────────────┤
│  Phase: IDLE again                                      │
│  Strategy: Full Ink render with updated history         │
└─────────────────────────────────────────────────────────┘
```

### Key architectural rules

1. **During streaming**: Ink is NOT mounted. We exit Ink entirely and write directly to `process.stdout`. This avoids the clear-and-redraw problem.

2. **After streaming completes**: We re-enter Ink and render the full conversation history as static content.

3. **For approval prompts**: We use a **separate** Ink render instance that overlays the current state. When approved, we unmount it and resume streaming.

4. **The input box**: Uses `ink-text-input` only during the IDLE phase. During streaming, the input is hidden.

### Alternative considered: Full reactive streaming with `useInput`

We considered using Ink's `useInput` hook with a manual render loop that appends to a growing `<Text>` buffer. **Rejected** because:
- Ink 7.x still re-renders the full tree on each update, causing visible flicker at high token rates
- The `useInput` hook requires raw mode which conflicts with streaming stdout writes
- Claude Code itself uses the hybrid approach (raw stdout during streaming, Ink for frames)

### Implementation approach: "Write-then-exit" pattern

```
function runRepl() {
  // 1. Enter Ink for initial frame (header + input)
  // 2. On user submit: unmount Ink
  // 3. Stream response via process.stdout.write()
  // 4. On stream done: re-enter Ink with updated history
  // 5. On tool approval: mount separate Ink overlay
  // 6. On approval done: unmount overlay, resume streaming
}
```

---

## 3. Component-by-Component Implementation Plan

### 3.1 Header — Brand Box with Project Name

**File**: `src/ui/components/Header.tsx` (modify existing)

**Current state**: Already exists with ASCII art and theme colors. Uses `Box` + `Text`.

**Changes needed**:
- Add `projectName` prop
- Add `version` prop  
- Wrap in a border box using `borderStyle: "round"`
- Add provider/model info on the right side

```tsx
interface HeaderProps {
  projectName: string;
  version: string;
  provider?: string;
  model?: string;
  tagline?: string;
  creator?: string;
}
```

**Migration**: Low risk — just enhance existing component.

---

### 3.2 Streaming Assistant Output

**File**: `src/ui/components/StreamingMessage.tsx` (NEW)

**Purpose**: Renders the assistant's streaming response. During active streaming, this is NOT an Ink component — it writes to stdout directly. After streaming completes, it becomes a static Ink `<Text>`.

**Approach**: 
- During streaming: `process.stdout.write(text)` in `runChat()` (already works)
- After streaming: Store accumulated text in state, render as `<Text color={neutral.body}>`
- Render conversation history as static Ink components in the main frame

**New state management**:
```tsx
type ConversationEntry =
  | { type: "user"; content: string }
  | { type: "assistant"; content: string; streaming: boolean }
  | { type: "tool"; toolName: string; args: string; status: "running" | "done" | "error" }
```

---

### 3.3 Tool Activity Timeline

**File**: `src/ui/components/ToolActivity.tsx` (NEW)

**Purpose**: Renders the `→ Reading file.py` / `✓ Done` timeline during tool execution.

**Design**:
```
  ⚡ read_file(src/index.ts)
  ⚡ search_files("auth")
  ✓ read_file — 142 lines
  ◌ run_command(npm test) ← currently running
```

**During streaming** (raw stdout):
```ts
process.stdout.write(chalk.dim(`  → ${toolName}(${argsPreview})\n`));
// After completion:
process.stdout.write(chalk.green(`  ✓ ${toolName}\n`));
```

**After streaming** (static Ink render):
```tsx
<ToolActivity entries={toolEntries} />
```

**Existing `ToolCallCard`** is for the non-interactive `huno explain` command. The new `ToolActivity` is the inline REPL version.

---

### 3.4 Permission Prompt (Arrow-Key Selection)

**File**: `src/ui/components/PermissionPrompt.tsx` (NEW)

**Purpose**: Interactive y/n approval with arrow-key selection, rendered as an Ink overlay.

**Design**:
```
  ┌─────────────────────────────────────┐
  │  ⚠ Permission Required              │
  │                                     │
  │  Run: npm test                      │
  │  Risk: Low                          │
  │                                     │
  │  [✓ Allow]  [✗ Deny]               │
  └─────────────────────────────────────┘
```

**Implementation**:
- Uses `useInput` hook from Ink for arrow key / enter handling
- Rendered as a **separate** `render()` instance (not the main tree)
- Returns `Promise<boolean>` that resolves on selection
- Styled similar to existing `ApprovalPrompt` but with selection highlight

```tsx
function PermissionPrompt({ action, command, risk }: PermissionPromptProps): React.ReactElement {
  const [selected, setSelected] = useState<boolean>(true);
  const { useInput } = require("ink");
  
  // useInput for left/right arrow + enter
  // Render with highlight on selected option
}
```

**Critical**: This must be rendered in a SEPARATE Ink instance so it doesn't clear the streaming output.

---

### 3.5 Input Box

**File**: `src/ui/components/InputBox.tsx` (NEW)

**Purpose**: The user's text input using `ink-text-input`.

**Dependency needed**: `ink-text-input` (install: `pnpm add ink-text-input`)

**Design**:
```
  > Where is authentication handled? _
```

**Implementation**:
```tsx
import { TextInput } from "ink-text-input";

function InputBox({ onSubmit, placeholder }: InputBoxProps) {
  const [value, setValue] = useState("");
  
  return (
    <Box>
      <Text color={brand.secondary}>  › </Text>
      <TextInput value={value} onChange={setValue} onSubmit={onSubmit} placeholder={placeholder} />
    </Box>
  );
}
```

**Behavior**:
- Only visible during IDLE phase
- Hidden during streaming
- Supports multiline with Shift+Enter (or just single-line for MVP)
- Shows placeholder text when empty

---

### 3.6 Slash Commands

**File**: `src/ui/components/SlashCommandPalette.tsx` (NEW, optional for v1)

**Purpose**: Detect and handle `/` commands. Currently handled as string matching in `repl.ts`.

**Approach for v1**: Keep slash command handling in `repl.ts` logic, but render results as Ink components instead of `console.log`.

**Approach for v2**: Add a command palette popup when user types `/` — shows filtered list of commands with descriptions.

**No new dependencies needed** for v1.

---

### 3.7 Suggested Next Actions

**File**: `src/ui/components/SuggestedActions.tsx` (NEW)

**Purpose**: After a response completes, show 2-3 suggested follow-up questions.

**Design**:
```
  Suggested:
    → Where is authentication handled?
    → Show me the database schema
    → Run the test suite
```

**Implementation**:
```tsx
function SuggestedActions({ suggestions, onSelect }: SuggestedActionProps) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={neutral.dim}>  Suggested:</Text>
      {suggestions.map((s, i) => (
        <Box key={i} paddingLeft={2}>
          <Text color={brand.secondary}>  → </Text>
          <Text color={neutral.body}>{s}</Text>
        </Box>
      ))}
    </Box>
  );
}
```

**Data source**: Hardcoded contextual suggestions based on conversation topic, or generated by the model (future).

---

### 3.8 Status Bar

**File**: `src/ui/components/StatusBar.tsx` (NEW)

**Purpose**: Bottom bar showing current state, provider, model, context files.

**Design**:
```
  ● Claude 3.5 Sonnet · OpenRouter · 3 context files · 12 messages
```

**Implementation**:
```tsx
function StatusBar({ provider, model, contextCount, messageCount, state }: StatusBarProps) {
  const stateColor = state === "streaming" ? brand.accent : 
                     state === "waiting" ? brand.secondary : neutral.dim;
  const stateIcon = state === "streaming" ? "◌" : 
                    state === "waiting" ? "●" : "○";
  
  return (
    <Box marginTop={1} borderStyle="single" borderColor={neutral.border} paddingX={1}>
      <Text color={stateColor}>{stateIcon} </Text>
      <Text color={neutral.dim}>{provider} · {model} · </Text>
      <Text color={neutral.muted}>{contextCount} context · {messageCount} messages</Text>
    </Box>
  );
}
```

---

## 4. New Main REPL Component

**File**: `src/ui/components/ReplApp.tsx` (NEW)

**Purpose**: The root Ink component that orchestrates the entire REPL UI.

```tsx
interface ReplAppProps {
  projectName: string;
  version: string;
  provider?: string;
  model?: string;
  entries: ConversationEntry[];
  inputVisible: boolean;
  status: "idle" | "streaming" | "waiting" | "approval";
  onSubmit: (input: string) => void;
  approvalHandler: ((approved: boolean) => void) | null;
  approvalData: ApprovalData | null;
  suggestions: string[];
}

function ReplApp(props: ReplAppProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Header projectName={props.projectName} version={props.version} 
               provider={props.provider} model={props.model} />
      
      {/* Conversation history */}
      <Box flexDirection="column">
        {props.entries.map((entry, i) => (
          <ConversationEntryComponent entry={entry} key={i} />
        ))}
      </Box>
      
      {/* Suggested actions (when idle and after response) */}
      {props.status === "idle" && props.suggestions.length > 0 && (
        <SuggestedActions suggestions={props.suggestions} onSelect={props.onSubmit} />
      )}
      
      {/* Input box (only when idle) */}
      {props.inputVisible && (
        <InputBox onSubmit={props.onSubmit} />
      )}
      
      {/* Status bar */}
      <StatusBar state={props.status} provider={props.provider} model={props.model} />
      
      {/* Approval overlay (rendered as sibling, not child) */}
    </Box>
  );
}
```

---

## 5. Modified REPL Loop Architecture

**File**: `src/repl.ts` (major rewrite of `startReplLoop`)

### New flow:

```tsx
async function startReplLoop(projectName, contextFiles) {
  const entries: ConversationEntry[] = [];
  let status: ReplStatus = "idle";
  let approvalResolver: ((v: boolean) => void) | null = null;
  
  // Main render function
  const renderFrame = () => {
    renderUI(
      <ReplApp
        projectName={projectName}
        version={VERSION}
        entries={entries}
        status={status}
        inputVisible={status === "idle"}
        onSubmit={handleSubmit}
        approvalHandler={approvalResolver}
        approvalData={null}
        suggestions={getSuggestions(entries)}
      />
    );
  };
  
  // Handle user submission
  const handleSubmit = async (input: string) => {
    // Add user entry
    entries.push({ type: "user", content: input });
    
    // Exit Ink for streaming
    cleanupUI();
    
    // Stream response
    status = "streaming";
    const onStream = (text: string) => {
      process.stdout.write(text);
      // Accumulate into entries
      const last = entries[entries.length - 1];
      if (last?.type === "assistant") {
        last.content += text;
      } else {
        entries.push({ type: "assistant", content: text, streaming: true });
      }
    };
    
    // Approval during streaming
    const onApprove = async (toolName, args) => {
      // Mount separate Ink approval overlay
      return new Promise<boolean>((resolve) => {
        approvalResolver = resolve;
        renderUI(
          <PermissionPrompt
            action={toolName}
            command={JSON.stringify(args)}
            risk={getRisk(toolName)}
            onSelect={(approved) => {
              approvalResolver = null;
              cleanupUI();
              resolve(approved);
            }}
          />
        );
      });
    };
    
    // Run conversation
    const result = await runAskWithConversation(input, history, provider, model, onStream, onApprove);
    
    // Mark streaming complete
    const last = entries[entries.length - 1];
    if (last?.type === "assistant") last.streaming = false;
    
    // Re-enter Ink
    status = "idle";
    renderFrame();
  };
  
  // Initial render
  renderFrame();
}
```

---

## 6. Dependency Additions

| Package | Version | Purpose | Install Command |
|---------|---------|---------|-----------------|
| `ink-text-input` | ^5.0.0 | Text input component for Ink | `pnpm add ink-text-input` |
| `figures` | ^5.0.0 | Unicode symbols (✓, ✗, →, ⚡) | `pnpm add figures` |
| `wrap-ansi` | ^7.0.0 | Word wrapping for long text | `pnpm add wrap-ansi` (likely already transitive) |

**Optional for v2**:
| `ink-link` | ^2.0.0 | Clickable links in terminal |
| `ink-spinner` | ^5.0.0 | Spinner for loading states |
| `ink-gradient` | ^2.0.0 | Gradient text for header |

---

## 7. File Change Summary

### New files (7)

| File | Purpose |
|------|---------|
| `src/ui/components/StreamingMessage.tsx` | Static rendering of completed assistant messages |
| `src/ui/components/ToolActivity.tsx` | Inline tool execution timeline |
| `src/ui/components/PermissionPrompt.tsx` | Interactive arrow-key approval overlay |
| `src/ui/components/InputBox.tsx` | Text input with ink-text-input |
| `src/ui/components/SuggestedActions.tsx` | Post-response suggested prompts |
| `src/ui/components/StatusBar.tsx` | Bottom status bar |
| `src/ui/components/ReplApp.tsx` | Root REPL application component |

### Modified files (4)

| File | Changes |
|------|---------|
| `src/repl.ts` | Major rewrite: replace readline with phase-based Ink rendering |
| `src/ui/components/Header.tsx` | Add projectName, version, provider, model props |
| `src/ui/components/index.ts` | Add exports for new components |
| `src/ui/theme.ts` | Add any new tokens needed (likely minimal) |

### Unchanged files

| File | Reason |
|------|--------|
| `src/core/conversation.ts` | Already has onStream/onApprove callbacks — no changes needed |
| `src/ui/renderer.tsx` | Keep as-is; the phase-based approach uses the same render()/cleanupUI() |
| All other UI components | Used by non-REPL commands; leave untouched |

---

## 8. Migration Order

### Phase 1: Foundation (low risk, no behavior change)

1. **Install dependencies**: `pnpm add ink-text-input figures`
2. **Create `InputBox` component** — standalone, testable
3. **Create `StatusBar` component** — uses existing theme
4. **Create `SuggestedActions` component** — static, no interaction
5. **Update barrel file** (`components/index.ts`)

### Phase 2: Enhance existing components

6. **Enhance `Header`** — add projectName, version, provider props
7. **Create `ToolActivity`** — inline version of tool status display
8. **Create `StreamingMessage`** — static text renderer for history

### Phase 3: Interactive overlay (the critical piece)

9. **Create `PermissionPrompt`** — the most complex new component
   - Uses `useInput` for keyboard navigation
   - Renders as separate Ink instance
   - Returns `Promise<boolean>`
10. **Test overlay rendering** — mount/unmount without affecting stdout

### Phase 4: Main orchestration

11. **Create `ReplApp`** — root component composing all pieces
12. **Rewrite `repl.ts`** — replace readline loop with phase-based rendering
    - Keep all existing slash command logic
    - Keep all existing conversation flow
    - Only change the rendering layer
13. **Test end-to-end** — verify streaming, approval, re-entry all work

### Phase 5: Polish

14. **Add suggested actions logic** — contextual suggestions based on last response
15. **Add keyboard shortcuts** — Ctrl+C handling, Ctrl+L for clear
16. **Add conversation history scrolling** — if terminal is small, truncate older entries
17. **Performance tuning** — debounce renders, limit history entries in view

---

## 9. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Ink flickering during streaming | Use phase-based approach — Ink is unmounted during streaming |
| Input not working during streaming | Input is hidden during streaming; only shown in IDLE phase |
| Approval overlay clears streaming output | Approval renders in a SEPARATE `render()` call; streaming output is below |
| Backward compatibility | Non-REPL commands (`huno explain`, `huno audit`) are untouched |
| Terminal state corruption | Always call `cleanupUI()` before process.exit; handle SIGINT |
| Long conversation history | Truncate entries older than N turns in the rendered view |

---

## 10. Success Criteria

- [ ] User sees branded header on REPL start
- [ ] Streaming text appears token-by-token without flicker
- [ ] Tool calls show inline `→` / `✓` timeline
- [ ] Permission prompts allow arrow-key selection
- [ ] After response, 2-3 suggested actions appear
- [ ] Status bar shows current provider/model/state
- [ ] All 17 slash commands still work
- [ ] Ctrl+C exits cleanly
- [ ] No visible screen clearing or flickering
- [ ] Terminal restores to original state on exit
