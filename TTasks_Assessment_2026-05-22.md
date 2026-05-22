---
name: "TTasks Feature & Architecture Assessment — 2026-05-22"
description: Full feature/requirements assessment and architectural review of the TTasks plugin as of 2026-05-22
type: reference
---

# TTasks — Feature & Architecture Assessment
*Generated: 2026-05-22 | Build: 553 tests passing, 0 TS errors*

---

## 1. Current Status Snapshot

### Completed Phases
| Phase | Description | Tests Added |
|-------|-------------|-------------|
| 1–2 | Core store, list view, kanban, mobile layouts | baseline |
| 2.5 | ID collision safety, relationship guards, configurable options | — |
| 3A | Dependency graph (visual, interactive), cycle detection, date propagation | — |
| 3B | ReminderService (due-today, overdue, lead-time, stale-in-progress) | — |
| 3C | Quick actions: start/complete/block/defer (command palette + hold menu) | — |
| 4 | is_complete/is_inbox, status_changed, delete, duplication | — |
| 5 | Convert-to-project, hierarchy utilities (flattenWithDepth, buildVisibleItems) | — |
| 6 | area/labels data model, query engine, Smart Lists, QueryEditorModal | — |
| 7 | ArchiveService, auto-archive, TaskArchiveView, archive_history logbook | — |
| A1–A7 | Refactor: TaskStore → Writer/Migrations/Relationships; Settings split; TaskDetail decomposed | +70 |
| B1–B6 | Bug fixes: est-days, dep sort, verbiage, create-dependent, graph grouping, complete cycle | +12 |
| C2–C6 | Archive implementation: folder+status hybrid, 45-day auto-archive, archive view | +23 |
| **Total** | | **553 passing** |

### Active Backlog (Streams D–G)
| ID | Title | Status | Dependencies |
|----|-------|--------|--------------|
| D1 | Kanban dep count badge + card field visibility | Planned | None |
| D2 | Kanban column collapse | Planned | None (parallel to D1) |
| E1 | Multi-select batch operations | Planned | None |
| E2 | In-board keyboard shortcuts | Planned | None (parallel to E1) |
| F1 | Graph lane sidebar headers + accessibility | Planned | None |
| G1 | Reminder snooze + per-task override | Planned | None |

---

## 2. Feature / Requirements Assessment

### 2.1 Strengths — What's Working Well

**Query Engine (src/query/)** is the standout feature: 12 operators, 16 filter fields, 6 group-by fields, relative date resolution, date bucketing, limitPerGroup, pure functions with 38 tests. This is the foundation everything else builds on — it's solid and extensible.

**Archive System** is well-designed. Hybrid folder+status approach means tasks remain readable without the plugin. The `archive_history` logbook on each task is excellent for audit. 45-day configurable auto-archive is a sensible default.

**Relationship model** (depends_on → blocks reverse index, auto-synced) is a genuine differentiator from TickTick. Cycle detection + topological date propagation (Phase 3A) is sophisticated and valuable.

**ReminderService** covers the key rules (due-today, overdue, lead-time, stale-in-progress) with quiet hours and per-device deduplication. G1 snooze will complete this story.

### 2.2 Feature Gaps — Identified but Not Planned

#### G2: Recurrence UI completeness
`recurrence.ts` and `recurrenceNotes.ts` exist but the PRDs and CLAUDE.md don't describe a full recurrence-setup UI in the create/edit modal. Users likely can't configure complex recurrence from the UI yet. Recommend auditing what's currently exposed vs. what `recurrence.ts` supports internally.

#### H1: Due time UI + scheduling
`due_time` is a query engine filter field but there's no create/edit UI exposure or agenda time-slotting. Either remove it from the schema or build the UI. Leaving it as a hidden field creates user confusion if they try to use it.

#### H2: Checklist / inline subtasks
`checklistMaterializer.ts` exists in the store but doesn't appear in any PRD or CLAUDE.md UI description. Checklist items in task body markdown → converted to trackable sub-items is a high-value feature that's partially built. Needs a PRD before it drifts.

#### H3: TickTick data import command
CLAUDE.md notes ~19 tasks still in TickTick. This should become a one-time command (`import-from-ticktick-export`) that reads TickTick's JSON export and creates TTasks notes. Without this, the migration will be done manually or never.

#### H4: Drag-and-drop in Kanban
Kanban cards being drag targets is implied by D2's note about "collapsed columns should still be draggable targets." If drag-and-drop for status reassignment isn't implemented, it should be explicitly scoped. If it is implemented, D2's gotcha note about drag-over-collapsed-column auto-expand should be tracked as a follow-up.

#### H5: `source` field exposure
The `source` frontmatter field exists in the schema but has no create/edit UI exposure documented. Define its purpose (URL? Obsidian link? import origin?) and either expose it or remove it.

#### H6: Data export
No export path documented. Users might want CSV/JSON export of their task data for external tools. Low priority but worth a future PRD.

### 2.3 Stream D–G Requirement Completeness

**D1 (Kanban dep count badge)** — PRD is complete and well-specified. One gap: `buildDepCountBadge` returns raw counts including already-complete dependencies. The PRD acknowledges this ("future work can filter to open only") but doesn't track it as a follow-up. Add a note or create D3 for "filter dep badge to open tasks only."

**D2 (Kanban column collapse)** — PRD is complete. Gotcha about mobile drag-over is correctly deferred but should be filed. The `writing-mode: vertical-rl` CSS trick for collapsed column labels is correct.

**E1 (Multi-select)** — PRD is thorough. One gap: `batchEligibility.canArchive` checks `is_complete` but ArchiveService may have its own eligibility check. Verify these are in sync during implementation. Also: the PRD says "list view only initially" for kanban — this should become a tracked follow-up (E3).

**E2 (Keyboard shortcuts)** — PRD is thorough. The vim-mode conflict note (`j`/`k`) is important — recommend adding a settings toggle to disable vim-style nav (not deferred, it should be in E2 scope since it's a known conflict). Also: `Escape` must coordinate with E1's batch selection clear — when both E1 and E2 are active, `Escape` should clear batch selection first, then close detail panel.

**F1 (Graph lane headers)** — PRD is complete. Note that `graphLaneLayout.ts` already exists in `src/store/graph/`. The PRD's `buildLaneHeaders` function may need to either extend the existing file or replace it. Verify before creating a duplicate.

**G1 (Reminder snooze)** — PRD references `src/reminders.ts` but the actual file path is `src/store/ReminderService.ts`. Fix before implementing. The 4-hour hardcoded snooze is acceptable for now but should be configurable in settings (add to G1 scope or create G2).

---

## 3. Architectural Review

### 3.1 Layer Model (as-built)

```
┌─────────────────────────────────────────────────┐
│  Obsidian Plugin (main.ts)                      │  ← registers, wires, lifecycle
├─────────────────────────────────────────────────┤
│  Views (TaskBoardView.ts)                       │  ← Obsidian leaf wrapper
│  Modals (CreateTaskModal, QueryEditorModal)     │  ← Obsidian modal wrappers
├─────────────────────────────────────────────────┤
│  UI Components (Svelte)                         │  ← pure renderers
│  TaskBoard → TaskList / TaskKanban / TaskAgenda │
│            → TaskGraph / TaskArchiveView        │
│            → TaskDetail (+ sub-components)      │
├─────────────────────────────────────────────────┤
│  Integration (contextMenu, quickActions,        │  ← side-effect orchestrators
│               boardKeymap, editorAssist,        │
│               hoverLink, protocol)              │
├─────────────────────────────────────────────────┤
│  Query Engine (query/engine.ts)                 │  ← pure filter/sort/group
│  Schema (schema/)                               │  ← field definitions/renderers
├─────────────────────────────────────────────────┤
│  Services (ArchiveService, ReminderService)     │  ← domain orchestrators
├─────────────────────────────────────────────────┤
│  Store (TaskStore + TaskWriter +                │  ← vault I/O + state
│         TaskMigrations + TaskRelationships)     │
│  Utilities (dateUtils, pathUtils, wikiLink)     │  ← pure helpers
└─────────────────────────────────────────────────┘
          ↕ app.vault / app.fileManager (Obsidian API)
```

### 3.2 SOLID Assessment

#### Single Responsibility (SRP) ✅ mostly good

| Module | Responsibility | Verdict |
|--------|---------------|---------|
| TaskStore | State + vault watchers + load() | ✅ Clean after A1–A3 |
| TaskWriter | CRUD operations on vault files | ✅ Focused |
| TaskMigrations | Migration commands only | ✅ Focused |
| TaskRelationships | blocks reverse-index sync | ✅ Focused |
| ArchiveService | archive/restore/auto-archive | ✅ Focused |
| ReminderService | reminder rules + notice dispatch | ✅ Focused |
| **TaskBoard.svelte** | Filter state + view routing + active task + batch actions + selection | ⚠️ Growing |
| **main.ts** | Plugin lifecycle + command registration + service wiring | ⚠️ Expected size but worth watching |

**Recommendation for TaskBoard.svelte:** As E1 (batch selection) and E2 (keyboard focus) land, TaskBoard will grow again. Consider extracting a `BoardStateService` (writable stores for: `activeTaskPath`, `selectedPaths`, `focusedTaskPath`, `currentView`) as a dedicated TS module. Components subscribe to it. This makes the selection/focus state testable without Svelte.

#### Open/Closed (OCP) ✅ good

The query engine is the strongest example: new operators and fields can be added by extending the union types and the `evalCondition` switch without changing existing cases. ViewRegistry follows the same pattern for renderers.

**Gap:** `KanbanCardField` type is defined as `'area' | 'dueDate' | 'labels' | 'depCount'`. Adding a new card field type requires modifying the union. Consider `string` with a registry of known fields and their render functions — but this may be over-engineering for 4 fields. Keep as-is; revisit if it hits 8+.

#### Liskov Substitution (LSP) — N/A
No inheritance hierarchy in use. Correct choice.

#### Interface Segregation (ISP) ✅ excellent

PRDs consistently define minimal interfaces for pure helpers (e.g., `buildDepCountBadge` takes `{depends_on, blocks, is_complete}` not the full `Task`). This is the right pattern — keep it.

**Remaining risk:** Some Svelte components import `plugin: TTasksPlugin` directly, giving them access to everything. These should receive only the specific services/settings they need as props or context.

#### Dependency Inversion (DIP) ⚠️ partial

Pure modules (query engine, utilities, store helpers) have no Obsidian dependencies — correct. But components that import `plugin` directly are coupled to the concrete plugin class. This isn't critical for an Obsidian plugin (there's only one runtime) but it does make components harder to test in isolation.

**Recommendation:** For new components (BatchActionBar, keyboard handler), keep Obsidian deps out by having the parent pass callbacks. This is already the pattern in TaskDetailActions — continue it.

### 3.3 DRY Assessment

**Strong areas:**
- `isFieldEnabled` reused for all 4 Kanban card field toggles (D1 PRD)
- `toggleColumnCollapse` mirrors the list view's `collapsedPaths` pattern (D2 PRD note)
- Quick actions (start/complete/block/defer) in a single `resolveQuickAction` pure fn, called by command palette AND context menu AND (future) keyboard shortcut
- Archive/delete/update all route through store methods — no duplicate vault logic

**Watch areas:**
- E1's batch operations call `plugin.taskStore.update()` in a loop. If batch sizes grow, this will do N sequential vault writes. Consider a `TaskWriter.updateMany()` method that batches under a single queue lock.
- D1's `buildDepCountBadge` counts raw depends_on/blocks. If future views also need "open dep count," this helper should be in a shared utility, not component-specific.

### 3.4 TDD Assessment

**Excellent coverage:**
- 76 test files, 553 passing tests (up from 440 → +113 across refactoring sessions)
- Every new module follows test-first: pure helpers written red → green before integration
- PRDs specify minimum test counts per helper (e.g., "≥8 tests for kanbanCardFields.ts")

**Gaps:**
1. **No Svelte component tests** — only the TypeScript helpers beneath them are tested. Component behavior (does the checkbox render? does clicking it call onSelect?) is tested manually or not at all. Consider adding `@testing-library/svelte` for the highest-risk components (TaskRow, TaskDetail, BatchActionBar).

2. **No vault integration tests** — all store tests mock the vault. A lightweight integration test that creates a real TFile with frontmatter and verifies round-trip would catch serialization bugs that pure mocks miss. Vitest's `vi.spyOn` approach doesn't cover the real YAML serialization path.

3. **Architecture boundary test** (`integration/architectureBoundaries.test.ts`) — this file exists, which is great. Verify it actually asserts that query/engine.ts has no Obsidian imports and other layer boundaries hold.

### 3.5 Performance Considerations

**Current model:** TaskStore loads all tasks on startup, holds them in memory, and re-renders the active view on every vault change event. This is correct for small-to-medium vaults (<500 tasks).

**Risks as task count grows:**
- `applyQuery()` runs on every store update, filtering all tasks. For 200+ tasks with complex filters, this could become perceptible. Profile before optimizing but keep it in mind.
- Archive view loads archived tasks separately — good isolation.
- Graph layout algorithms (crossing optimizer, edge routing) are O(n²) or worse for large graphs. Already behind a separate view — acceptable.

**Recommendation:** Add a `console.time` / `console.timeEnd` around the critical path in `useTaskQuery.ts` in dev mode to make regressions visible early.

### 3.6 CSS Architecture

Current: single `styles.css` file in plugin root, scoped under `.ttask` cssclass.

**Strengths:** Obsidian token usage (var(--interactive-accent), var(--text-muted), etc.) ensures automatic light/dark theme adaptation.

**Risks:** As the plugin grows (Archive view, Graph, Batch bar, Kanban collapse), the single CSS file will become hard to navigate. Consider splitting into per-component CSS files (esbuild can bundle them). Not urgent but worth doing before >1000 lines.

**Mobile:** Collapsed kanban columns with `writing-mode: vertical-rl` need mobile testing — this CSS property has historically had rendering quirks in WKWebView. Flag for QA when D2 ships.

---

## 4. Implementation Plan — Streams D–G

### 4.1 Recommended Order

All four streams are independent (no cross-dependencies). Recommended order balances user-facing impact with implementation risk:

```
Week 1:  D1 (Kanban badges)       — low risk, high visibility
         G1 (Reminder snooze)     — medium risk, completes reminder story
Week 2:  D2 (Column collapse)     — medium risk, UI polish
         E1 (Multi-select)        — medium risk, workflow improvement
Week 3:  E2 (Keyboard shortcuts)  — medium risk, power-user feature
         F1 (Graph accessibility) — low risk, correctness + a11y
```

Rationale: D1 and G1 are the highest user-value items. G1 completes the reminder story, which is otherwise awkward (can't dismiss/defer a notice). D2/E1 together round out the Kanban UX. E2/F1 are power-user and polish items.

### 4.2 Pre-Implementation Checklist (apply before each stream)

For each PRD before starting:
- [ ] Read the PRD acceptance criteria fully
- [ ] Check if any referenced file paths are stale (F1: verify graphLaneLayout.ts, G1: verify ReminderService path)
- [ ] Run `npm test` — confirm 553 baseline
- [ ] Run `npm run build` — confirm clean

TDD sequence for each (mandated):
1. Create pure helper module (`.ts`)
2. Write failing tests (`.test.ts`) — tests must be RED first
3. Implement until tests GREEN
4. Wire into Svelte/settings
5. Run full test suite — all must pass
6. Run build — must be clean

### 4.3 D1 Implementation Plan

**Pre-check:** `src/components/kanbanCardFields.ts` already exists (created as part of prior work per the explore report). Verify its current content before creating — don't overwrite.

**TDD sequence:**
1. `kanbanCardFields.ts` — `buildDepCountBadge`, `isFieldEnabled`
2. `kanbanCardFields.test.ts` — ≥8 tests (null when no deps, blockedBy only, unblocks only, both, isFieldEnabled true/false, undefined fields array fallback)
3. `settings/types.ts` — add `kanbanCardFields: KanbanCardField[]`
4. `settings/defaults.ts` — add default + normalization (asStringArray fallback)
5. Add settings UI section in a new `kanbanSettingsSection.ts` (consistent with archiveSettingsSection pattern)
6. `TaskKanban.svelte` — prop, gating, dep count badge

**Test count target:** 553 + 8 = 561+

### 4.4 D2 Implementation Plan

**Pre-check:** `src/components/kanbanCollapse.ts` already exists. Verify current content.

**TDD sequence:**
1. `kanbanCollapse.ts` — `toggleColumnCollapse`, `isColumnCollapsed`, `serializeCollapsed`, `deserializeCollapsed`
2. `kanbanCollapse.test.ts` — ≥10 tests (toggle add, toggle remove, toggle back, empty set, serialize, deserialize, roundtrip, isCollapsed true/false, undefined raw deserialize)
3. `settings/types.ts` + `settings/defaults.ts` — `kanbanCollapsedColumns: string[]`
4. `TaskKanban.svelte` — reactive collapsed state, toggle handler, collapsed CSS class
5. `styles.css` — `.tt-col-collapsed` styles

**Gotcha:** Use status ID (the string value) not column label as persistence key. If statuses are renamed, stale entries are inert — correct and acceptable.

**Test count target:** 561 + 10 = 571+

### 4.5 E1 Implementation Plan

**Pre-check:** `src/store/taskSelection.ts` and `src/components/BatchActionBar.svelte` already exist per the file survey. Verify contents before implementing.

**TDD sequence:**
1. `taskSelection.ts` — `addToSelection`, `removeFromSelection`, `toggleSelection`, `selectAll`, `clearSelection`, `batchEligibility`
2. `taskSelection.test.ts` — ≥12 tests (immutability for each fn, batchEligibility: empty → all false, canArchive only when all complete, canComplete when any incomplete, canDelete always true)
3. `BatchActionBar.svelte` — pure renderer, no business logic inside
4. `TaskRow.svelte` — `selectable`, `selected`, `onSelect` props
5. `TaskBoard.svelte` — `selectedPaths` writable store, batch action handlers, wire to TaskList
6. Keyboard: `Escape` clears selection (coordinate with E2's Escape behavior — both effects should fire)

**Confirm dialog:** Re-use existing Modal pattern from single-task delete. Do NOT create a new dialog pattern.

**Performance note:** Batch operations loop through tasks sequentially. If batch > 20 tasks, add a "Processing N tasks…" Notice that updates or dismisses when done.

**Test count target:** 571 + 12 = 583+

### 4.6 E2 Implementation Plan

**Pre-check:** `src/integration/boardKeymap.ts` already exists. Verify current content.

**TDD sequence:**
1. `boardKeymap.ts` — `resolveShortcut`, `isInputFocused`, `DEFAULT_KEYMAP`
2. `boardKeymap.test.ts` — ≥10 tests (each action maps correctly, null for unmapped, null with altKey, isInputFocused for input/textarea/select/contenteditable/div)
3. Add `focusedTaskPath: Writable<string | null>` to TaskBoard.svelte
4. `TaskRow.svelte` — `keyboardFocused` prop + CSS outline
5. `TaskBoardView.ts` — `registerDomEvent` handler, `handleShortcut` dispatch
6. Wire j/k to advance through current view's flat task list

**Vim mode conflict:** Add a setting `boardKeymap.disableVimStyleNav: boolean` (default false). When true, skip j/k/o bindings. Add to `keyboardShortcutsSettingsSection.ts` (new file, consistent with other settings sections).

**E2 + E1 Escape coordination:** In `handleShortcut('escape')`:
```typescript
if ($selectedPaths.size > 0) {
  selectedPaths.set(clearSelection());  // E1: clear batch first
} else if (activeTaskPath) {
  activeTaskPath = null;               // close detail panel
} else {
  focusedTaskPath.set(null);           // clear keyboard focus
}
```

**Test count target:** 583 + 10 = 593+

### 4.7 F1 Implementation Plan

**Pre-check:** `src/store/graph/graphLaneLayout.ts` exists. The F1 PRD defines a `buildLaneHeaders` function — check if this already exists in the file or if it needs to be added. Do NOT create a duplicate file.

**TDD sequence:**
1. Add `buildLaneHeaders` to existing `graphLaneLayout.ts` (or verify it's already there)
2. `graphLaneLayout.test.ts` — ≥6 tests (single-row group, multi-row, zero groups, trackPadding, correct px math, empty label)
3. `TaskGraph.svelte` — add sidebar `<div class="tt-hybrid-lane-sidebar">`, remove old `tt-hybrid-group-label` overlaid divs
4. Add `tabindex="0"`, `aria-label`, `aria-pressed`, keyboard handler to task bars
5. `styles.css` — lane sidebar styles, focus indicator

**Mobile concern:** Add media query or container-query to collapse sidebar to 64px (or hide entirely) on narrow viewports. Don't leave this as "future work" — the CSS wrinkle should ship with F1.

**Test count target:** 593 + 6 = 599+

### 4.8 G1 Implementation Plan

**Pre-check:** `src/store/reminderSnooze.ts` already exists per the file survey. Verify contents. The PRD references `src/reminders.ts` — the actual path is `src/store/ReminderService.ts`. Update the mental model accordingly.

**TDD sequence:**
1. `reminderSnooze.ts` — `snoozeTask`, `unsnoozeTask`, `isSnoozed`, `purgeSnoozed`
2. `reminderSnooze.test.ts` — ≥12 tests (snooze adds correctly, until timestamp math, isSnoozed active/expired/missing, purge keeps active/removes expired, unsnooze removes target/keeps others, immutability)
3. `types.ts` — add `reminder_override?: 'urgent' | 'mute' | null` to Task
4. `TaskStore.fileToTask()` — parse reminder_override safely
5. `TaskWriter.update()` — add reminder_override to persisted fields list
6. `ReminderService.ts` — add mute check, snooze check, quiet-hours bypass for urgent, "Snooze 4h" button on notice
7. `TaskDetailActions.svelte` — reminder override dropdown

**Snooze duration:** Make configurable in Settings (1h / 2h / 4h / until-tomorrow radio group) in `remindersSettingsSection.ts`. The PRD defers this to "future work" but it's a 30-minute settings addition that prevents a follow-up PRD.

**Test count target:** 599 + 12 = 611+

---

## 5. Stream I — Obsidian Ecosystem Integration

This stream makes TTasks a first-class citizen of the broader Obsidian ecosystem. Rather than three separate integrations, there is **one unified scan engine** that reads checkboxes from configured locations, surfaces them in TTasks automatically, and keeps source files in sync as tasks progress.

### 5.1 Design Principles

**One engine, multiple surfaces.** A single scan engine reads checkboxes from all configured directories. Auto-capture, manual promote, and bulk import are different actions against the same engine — not separate systems.

**Non-destructive capture.** Captured checkboxes stay in their source files. TTasks reads them and shows them in the inbox. Nothing is written to the source file until the user promotes or completes.

**Live link on promotion.** Promoting a task does not check the original checkbox — the task isn't done yet. It replaces the checkbox text with a wiki-link, leaving it unchecked. When the task is later completed in TTasks, the source checkbox is checked. The source file always reflects actual task state.

```markdown
Captured:   - [ ] Review proposal
Promoted:   - [ ] [[Planner/Tasks/abc123|Review proposal]]
Completed:  - [x] [[Planner/Tasks/abc123|Review proposal]]
```

**Scanner skips TTasks links.** Any checkbox containing a TTasks folder wiki-link is already in the system. The scanner ignores it, preventing re-capture after rollover plugins copy promoted items.

**Emoji fields extracted when present.** If a checkbox uses Obsidian Tasks emoji format (`📅 🔼 🔁` etc.), the scan engine parses those fields into TTasks-native fields rather than treating the whole line as the task name. No runtime dependency on the Tasks plugin — pure parsing.

**Rollover plugins: warn, don't architect around.** Rollover plugins affect roughly 20% of daily-note users. TTasks detects known rollover plugin IDs on settings open and shows a targeted warning. The live-link model (promoted tasks become wiki-links that rollover copies harmlessly) handles the most common case without special-casing.

---

### 5.2 Shared Types

```typescript
// src/integration/types.ts

export interface ExternalTaskLocation {
  path: string;   // vault-relative file path
  line: number;   // 0-indexed line in that file
}

export interface ExternalTask {
  readonly external: true;
  readonly location: ExternalTaskLocation;
  // Synthetic unique key: `${path}#L${line}`
  path: string;
  name: string;
  status: string;
  is_complete: boolean;
  priority: Task['priority'];
  due_date: string | null;
  start_date: string | null;
  created: string | null;
  completed: string | null;
  labels: string[];
  area: string | null;
  depends_on: string[];
  blocks: string[];
}

export interface CaptureSourceConfig {
  path: string;                       // directory path, vault-relative
  includeSubdirectories: boolean;
  mode: 'auto-capture' | 'manual' | 'auto-promote';
  sectionFilter: string;              // '' = whole file; 'Tasks' = under ## Tasks only
  inheritDateFromFilename: boolean;   // parse ISO date from filename into start_date/due_date
  defaults: {
    area: string | null;
    labels: string[];
    status: string | null;            // null = plugin inbox status
    priority: Task['priority'] | null;
    assignedTo: string | null;
  };
}
```

`ExternalTask` shares enough fields with `Task` that the existing query engine operates on both without changes.

---

### 5.3 I1 — Pure Parsing Layer

All parsing logic lives in pure functions with no Obsidian dependencies. Written test-first. Everything downstream depends on these.

#### I1-A: Checkbox parser (`src/integration/checkboxParser.ts`)

Parses any markdown checkbox line into a structured object.

```typescript
export interface ParsedCheckbox {
  raw: string;
  statusChar: string;     // the character inside [ ] — ' ', 'x', 'X', '-', '>', etc.
  checked: boolean;       // true for 'x' or 'X'
  cancelled: boolean;     // true for '-'
  text: string;           // everything after the checkbox marker, trimmed
  indentLevel: number;    // number of leading spaces / 2
  hasTTasksLink: boolean; // true if text contains [[Planner/Tasks/...]] — already in system
}

export function parseCheckboxLine(line: string): ParsedCheckbox | null
// Returns null if not a checkbox list item (`- [ ]`, `* [ ]`, `1. [ ]` etc.)

export function isTTasksLink(text: string, tasksFolder: string): boolean
// Returns true if the text contains a wiki-link whose path starts with tasksFolder
```

**Tests (≥12):**

- `- [ ] text` → checked false, text correct
- `- [x] text` → checked true
- `- [X] text` → checked true (uppercase)
- `- [-] text` → cancelled true
- `- [>] text` → statusChar '>', checked false, cancelled false
- Non-list line → null
- `  - [ ] text` → indentLevel 1
- `- [ ]` → empty string text, not null
- `- [ ] [[Planner/Tasks/abc|name]]` → hasTTasksLink true
- `- [ ] regular link [[Note]]` → hasTTasksLink false
- Tab-indented checkbox → indentLevel calculated correctly
- Numbered list `1. [ ] text` → parsed correctly

#### I1-B: Obsidian Tasks emoji parser (`src/integration/emojiFieldParser.ts`)

Parses Obsidian Tasks emoji signifiers from a checkbox text string. No Obsidian dependency.

**Emoji → TTasks field map:**

| Symbol | TTasks field | Notes |
|--------|-------------|-------|
| `🔺` or `⏫` | priority = High | Highest/High both map to High |
| `🔼` | priority = Medium | |
| `🔽` or `⏬` | priority = Low | Low/Lowest both map to Low |
| `📅 YYYY-MM-DD` | due_date | Also accepts `📆` `🗓` |
| `🛫 YYYY-MM-DD` | start_date | Wins over scheduled if both present |
| `⏳ YYYY-MM-DD` | start_date | Scheduled; also accepts `⌛` |
| `➕ YYYY-MM-DD` | created | |
| `✅ YYYY-MM-DD` | completed | |
| `❌ YYYY-MM-DD` | — | Cancelled date; sets cancelled = true |
| `🔁 <text>` | recurrence | Text preserved as-is |

Parse algorithm: strip signifiers right-to-left from end of string using `$`-anchored regexes. Each emoji pattern appends `️?` to handle Variation Selector 16. Remaining text after stripping all signifiers is the clean description.

```typescript
export interface ParsedEmojiFields {
  description: string;
  priority: 'High' | 'Medium' | 'Low' | 'None';
  dueDate: string | null;
  startDate: string | null;
  createdDate: string | null;
  completedDate: string | null;
  cancelled: boolean;
  recurrence: string | null;
}

export function parseEmojiFields(text: string): ParsedEmojiFields
// Always returns a result — fields are null when not present
// description = text after all signifiers stripped
```

**Tests (≥16):**

- Parses `📅 2026-05-22` into dueDate correctly
- Parses `⏳ 2026-05-22` into startDate
- `🛫` wins over `⏳` when both present (start beats scheduled)
- Each priority emoji maps to correct TTasks value
- No priority emoji → `'None'`
- Alternate aliases accepted (`📆`, `🗓`, `⌛`)
- VS16 suffix (`️`) after emoji — still parses
- NBSP before emoji — scrubbed, does not crash
- `❌` sets cancelled true, not due_date
- Recurrence text preserved verbatim
- Description is clean after all signifiers stripped
- No emoji fields → description = original text, all fields null
- Multiple fields on one line — all parsed
- Fields in non-canonical order — all still parsed (right-to-left strips any order)
- Empty string input → description '', all null
- `✅` date sets completedDate

#### I1-C: Date-from-filename parser (`src/integration/filenameDateParser.ts`)

Extracts ISO dates from a filename to infer task dates.

```typescript
export interface ParsedFilenameDates {
  startDate: string | null;   // first ISO date found
  dueDate: string | null;     // second ISO date found (range end), or null
}

export function parseDatesFromFilename(filename: string): ParsedFilenameDates
// filename = basename without extension, e.g. '2026-05-22 Meeting with Bob'
// Regex: /\d{4}-\d{2}-\d{2}/g — finds all ISO dates left to right
// First date → startDate; second date (if present) → dueDate; rest ignored
```

**Tests (≥10):**

- `2026-05-22 Meeting with Bob` → startDate '2026-05-22', dueDate null
- `Meeting with Bob 2026-05-22` → startDate '2026-05-22', dueDate null
- `2026-05-22 to 2026-05-24 Sprint` → startDate '2026-05-22', dueDate '2026-05-24'
- `2026-05-22` (daily note) → startDate '2026-05-22', dueDate null
- `Meeting with Bob` (no date) → both null
- Three dates in filename → first two used, third ignored
- Invalid date-like string `2026-13-99` → not matched (validate month/day ranges)
- Date mid-word `note2026-05-22note` → still extracted
- Empty string → both null
- Weekly note `2026-W21` → both null (not ISO date format)

---

### 5.4 I2 — Capture Source Configuration

Settings that drive every downstream integration behaviour. Defined once, used by the scan engine, promote action, and bulk import.

#### I2-A: Settings schema additions

```typescript
// In settings/types.ts

export interface CaptureSourceDefaults {
  area: string | null;
  labels: string[];
  status: string | null;           // null = plugin inboxStatus
  priority: Task['priority'] | null; // null = 'None'
  assignedTo: string | null;
}

export interface CaptureSourceConfig {
  path: string;
  includeSubdirectories: boolean;
  mode: 'auto-capture' | 'manual' | 'auto-promote';
  sectionFilter: string;           // '' = whole file
  inheritDateFromFilename: boolean;
  defaults: CaptureSourceDefaults;
}

// Added to TTasksSettings:
captureSources: CaptureSourceConfig[];
captureSourceDefaultMode: 'auto-capture' | 'manual' | 'auto-promote';
captureSourceDefaultDefaults: CaptureSourceDefaults;
```

On plugin load, TTasks auto-populates `captureSources` with detected daily and periodic note folders (using `obsidian-daily-notes-interface`) if they are not already present. User-added directories are preserved.

#### I2-B: Normalization and defaults

```typescript
// In settings/defaults.ts

export const DEFAULT_CAPTURE_SOURCE_DEFAULTS: CaptureSourceDefaults = {
  area: null,
  labels: [],
  status: null,
  priority: null,
  assignedTo: null,
};

export const DEFAULT_CAPTURE_SOURCE: Omit<CaptureSourceConfig, 'path'> = {
  includeSubdirectories: true,
  mode: 'auto-capture',
  sectionFilter: '',
  inheritDateFromFilename: true,
  defaults: DEFAULT_CAPTURE_SOURCE_DEFAULTS,
};
```

Normalization handles missing fields on old saved configs (existing entries without `inheritDateFromFilename` default to `true`).

#### I2-C: Settings UI (`src/settings/captureSourcesSettingsSection.ts`)

A dedicated section in the settings tab:

- **Global default mode** — dropdown applied to any newly added directory
- **Auto-detected sources** — daily notes folder, periodic notes folders (read-only path, all other fields editable)
- **Additional directories** — user-adds paths; each entry is an expandable row with all `CaptureSourceConfig` fields
- **Rollover warning banner** — appears at the top of this section if a known rollover plugin is detected (`app.plugins.plugins['obsidian-rollover-daily-todos']` or similar IDs). Text: "⚠️ Rollover Daily Todos detected. Promoted tasks become wiki-links that rollover copies harmlessly. Unpromoted captured tasks may appear duplicated across days."

**Tests (≥8, in `captureSourcesSettings.test.ts`):**

- Normalization: missing `inheritDateFromFilename` → defaults true
- Normalization: missing `defaults.labels` → defaults `[]`
- Auto-detect: daily notes folder injected when not already present
- Auto-detect: existing entry for same path not duplicated
- Default mode applied to new directory entries
- Rollover plugin detection returns correct boolean for known IDs
- Empty `captureSources` → auto-detect populates at least daily notes entry

---

### 5.5 I3 — Scan Engine + Auto-Capture

The engine that watches configured directories and maintains a live `ExternalTask[]` store.

#### I3-A: File scanner (`src/integration/fileScanner.ts`)

Pure function. Given file content, path, and config, returns all capturable tasks from that file.

```typescript
export function scanFileForCapturableTasks(
  content: string,
  filePath: string,
  config: CaptureSourceConfig,
  tasksFolder: string,
): ExternalTask[]
// Steps:
// 1. Split into lines
// 2. If sectionFilter set, only process lines under matching heading
// 3. For each line: parseCheckboxLine()
// 4. Skip: null result, checked, cancelled, hasTTasksLink
// 5. Parse emoji fields from text via parseEmojiFields()
// 6. Parse dates from filename if inheritDateFromFilename
// 7. Apply config.defaults (area, labels, status, priority, assignedTo)
// 8. Build ExternalTask
```

**Tests (≥14):**

- Returns ExternalTask for each unchecked non-TTasks checkbox
- Skips checked items
- Skips cancelled items (`[-]`)
- Skips lines with TTasks wiki-links (already promoted)
- Section filter: only returns tasks under matching heading
- Section filter: returns all when sectionFilter is `''`
- Emoji fields extracted into ExternalTask fields when present
- Plain text (no emoji) → all date/priority fields null
- `inheritDateFromFilename: true` → dates from filename applied
- `inheritDateFromFilename: false` → filename dates ignored
- Defaults applied: area, labels, status from config
- Explicit emoji priority overrides config default priority
- `includeSubdirectories: false` → only files directly in path (tested via path filtering helper)
- Empty file → empty array

#### I3-B: ScanEngine (`src/integration/ScanEngine.ts`)

Orchestrates vault watching and maintains the `ExternalTask[]` store.

```typescript
export class ScanEngine {
  private store: Writable<ExternalTask[]> = writable([]);
  get tasks(): Readable<ExternalTask[]> { return this.store; }

  onload(plugin: Plugin, app: App): void {
    // Initial full scan
    this.runFullScan(app, plugin.settings);

    // Watch for file changes in configured directories
    plugin.registerEvent(app.vault.on('modify', (file) => {
      if (this.isInScope(file.path, plugin.settings.captureSources)) {
        this.rescanFile(app, file, plugin.settings);
      }
    }));

    // Watch for new daily notes → surface previous day's tasks
    plugin.registerEvent(app.vault.on('create', (file) => {
      if (this.isDailyNote(file.path, app)) {
        this.surfacePreviousDayTasks(app, file, plugin.settings);
      }
    }));
  }

  private async surfacePreviousDayTasks(...): Promise<void> {
    // Finds yesterday's daily note, re-scans it
    // Marks any found ExternalTasks with fromPreviousDay: true
    // These float to the top of the inbox view
  }
}
```

`rescanFile` replaces only the `ExternalTask[]` entries for that file path, preserving entries from other files. Debounced 300ms on rapid file changes.

The merged task list fed to the query engine:

```typescript
// In TaskBoard.svelte:
$: allTasks = [...$taskStore.tasks, ...$scanEngine.tasks];
```

#### I3-C: Inbox view surface

Captured tasks appear in the existing **Inbox** smart list (already defined as `is_inbox = true` in the view registry). `ExternalTask` sets `is_inbox: true` so they appear there automatically. A small pill badge (`captured`) distinguishes them from native inbox tasks visually.

Previous-day tasks (`fromPreviousDay: true`) appear with a subtle "from yesterday" indicator at the top of the inbox list.

Clicking a captured task in the list opens the source file at the correct line (not a detail panel — there is no TTasks note yet). A **Promote** button appears in the row actions.

---

### 5.6 I4 — Promote + Completion Sync

#### I4-A: Promote action (`src/integration/promoteTask.ts`)

Pure helper that builds the `TaskCreateInput` from an `ExternalTask` and the source config defaults.

```typescript
export function buildPromoteInput(
  external: ExternalTask,
  inboxStatus: string,
): TaskCreateInput
// Merges ExternalTask fields with inboxStatus as fallback status
// Sets source = buildWikiLink(external.location.path, noteTitle)
// noteTitle = filename basename without extension
```

The promote flow in `TaskBoard.svelte`:

1. Call `buildPromoteInput(external, settings.inboxStatus)`
2. `taskWriter.create(input)` → new TTasks note at `{6hex}-{slug}.md`
3. Write `source: [[path|noteTitle]]` into the new note's frontmatter
4. Replace the source line in the original file:
   `- [ ] original text` → `- [ ] [[Planner/Tasks/abc123|Task Name]]`
5. `scanEngine.rescanFile(sourceFile)` — removes the promoted item from captured list
6. Set `activeTaskPath` to the new note → opens in detail panel

**Tests (≥10):**

- `buildPromoteInput` maps all ExternalTask fields correctly
- `buildPromoteInput` uses `inboxStatus` when ExternalTask status is null
- `buildPromoteInput` sets source to wiki-link of originating note
- Emoji fields on external task survive into created note
- Filename date inference survives into created note
- After promotion, source line contains TTasks wiki-link (unchecked)
- After promotion, ExternalTask no longer appears in scan results
- After promotion, new task appears in detail panel
- Source file is written atomically (read → modify → write, no concurrent writes)
- Promoting a task from a daily note: `start_date` from filename date

#### I4-B: Completion sync (`src/integration/completionSync.ts`)

When a TTasks task with a `source` field is marked complete, write `[x]` back to the source file.

```typescript
export function buildCompletedSourceLine(originalLine: string): string
// Replaces `- [ ]` with `- [x]` in a line that contains a TTasks wiki-link
// Handles all whitespace variants

export async function syncCompletionToSource(
  task: Task,
  app: App,
): Promise<void>
// 1. Parse task.source for a vault-relative file path
// 2. Read the file
// 3. Find the line containing [[task.path fragment]]
// 4. Replace [ ] with [x] via buildCompletedSourceLine
// 5. Write file back
// No-op if source is null, file not found, or line not found
```

Hooked into `TaskWriter.update()`: when status changes to `completionStatus`, call `syncCompletionToSource` if `task.source` is set.

**Tests (≥8):**

- `buildCompletedSourceLine` replaces `[ ]` with `[x]` correctly
- `buildCompletedSourceLine` handles leading spaces/tabs
- `buildCompletedSourceLine` leaves already-checked lines unchanged
- `syncCompletionToSource` no-ops when source is null
- `syncCompletionToSource` no-ops when source file not found
- `syncCompletionToSource` no-ops when wiki-link line not found in file
- Completing a task writes `[x]` at the correct line in the source file
- Uncompleting a task (status change away from completionStatus) writes `[ ]` back

---

### 5.7 I5 — Bulk Import (Settings → Advanced)

For users migrating from Obsidian Tasks or with a large backlog of unprocessed checkboxes. Promotes all currently captured tasks at once.

Located in the **Advanced** section of the Settings tab — not the command palette.

#### I5-A: Import scanner (`src/integration/importScanner.ts`)

Thin wrapper: runs `scanFileForCapturableTasks` across all files in all configured capture sources, collecting the full `ExternalTask[]` list. Identical logic to the live scan engine but run on-demand rather than reactively.

**Tests (≥6):**

- Collects tasks from all configured sources
- Respects `includeSubdirectories` per source
- Skips files outside configured directories
- Skips TTasks tasks folder (don't re-import native tasks)
- Skips already-promoted checkboxes (TTasks links)
- Empty sources → empty array

#### I5-B: Confirm modal + batch promote

```typescript
// Settings → Advanced section UI:
// [Import all captured tasks]
// Shows ImportConfirmModal before proceeding

// ImportConfirmModal displays:
// "Found N tasks across M files."
// Preview: first 5 task names with source file
// "Each will become a TTasks note. The original checkboxes will be replaced
//  with wiki-links. This cannot be undone."
// [Import N tasks]  [Cancel]
```

Batch loop: for each `ExternalTask`, runs the same promote flow as I4-A. Errors on individual tasks are caught and logged — they do not abort the batch. Final notice: "Imported N tasks (M errors — see console)."

**Tests (≥4):**

- Confirm modal displays correct count
- Errors on individual tasks do not stop the batch
- Final notice reflects actual created count
- Cancel → no tasks created, no files modified

---

### 5.8 I-Stream Implementation Order + Test Targets

Dependencies:

- I1-A and I1-B and I1-C are all independent — can be written in parallel
- I2 (settings) can be written independently — no parser dependency
- I3 depends on I1-A, I1-B, I1-C, I2
- I4 depends on I3 (needs ExternalTask type and scan engine)
- I5 depends on I1, I2, I3, I4 (reuses everything)

Recommended sequence:

```text
I1-A  checkboxParser.ts         (pure)  +12 tests → ~623
I1-B  emojiFieldParser.ts       (pure)  +16 tests → ~639
I1-C  filenameDateParser.ts     (pure)  +10 tests → ~649
I2    captureSourcesSettings    (pure)  +8 tests  → ~657
I3-A  fileScanner.ts            (pure)  +14 tests → ~671
I3-B  ScanEngine + inbox wiring         +0 pure   → ~671
I4-A  promoteTask.ts            (pure)  +10 tests → ~681
I4-B  completionSync.ts         (pure)  +8 tests  → ~689
I5    importScanner + modal              +10 tests → ~699
```

Pre-implementation checklist:

- [ ] Add `obsidian-daily-notes-interface` to `package.json` devDependencies
- [ ] Add `CaptureSourceConfig`, `CaptureSourceDefaults` to `settings/types.ts`
- [ ] Add defaults + normalization to `settings/defaults.ts`
- [ ] Create `src/integration/` directory
- [ ] Add `captureSourcesSettingsSection.ts` to `src/settings/`
- [ ] Add Advanced section to `SettingsTab.ts`

---


## 6. Post-Streams D–G + I: What's Next

Once Streams D–G and I land (~699+ tests, all passing), TTasks is feature-complete for personal daily use and ecosystem-compatible. The next milestone is **architectural hardening**, then **community readiness**.

---

### J-Stream — Code Quality (PRDs ready)

Found via senior code review of the actual codebase. Confirmed issues with file:line citations. Individual PRDs in `Scripts/TASK_J*.md`.

| ID | Issue | Severity | PRD |
|----|-------|----------|-----|
| J1 | Vault boundary error handling — no rollback on partial writes | High | TASK_J1.md |
| J2 | Magic constants extraction — hardcoded ms, depths, string literals | Medium | TASK_J2.md |
| J3 | ReminderService decomposition — 99-line `check()`, 4 mixed concerns | Medium | TASK_J3.md |
| J4 | Parallel relationship writes + O(1) task Map index | Medium | TASK_J4.md |
| J5 | DRY cleanup — context menu duplication, link array mutation | Low | TASK_J5.md |
| J6 | Type safety — `any` casts in main.ts, undocumented workspace APIs | Low | TASK_J6.md |

**Recommended order**: J1 (highest risk) → J2 (unblocks J3) → J3 (unblocks G1) → J4 → J5 → J6

---

### H-Stream — Architectural Debt (PRDs ready)

These are discrete, hand-off-ready tasks. Individual PRDs exist in `Scripts/TASK_H*.md`.

| ID | Task | When | PRD |
|----|------|------|-----|
| H1 | Svelte component tests | After E1+E2 stable | TASK_H1.md |
| H2 | BoardStateService extraction | After E1+E2 land | TASK_H2.md |
| H3 | CSS file splitting | Any time | TASK_H3.md |
| H4 | Architecture boundary enforcement | Any time | TASK_H4.md |

**H2 must follow E1 and E2** — both add state to TaskBoard.svelte; extract after both are stable.
**H1, H3, H4** are fully independent and can run in parallel.

---

### Feature Gaps (no PRD yet)

These are genuine missing features, not architectural issues. Lower priority than H-stream.

| ID | Feature | Notes |
|----|---------|-------|
| F1 | Due time UI + agenda time-slotting | `due_time` field exists in schema and query engine; no create/edit UI |
| F2 | Checklist/subtask UI | `checklistMaterializer.ts` is built; no UI surface |

---

### Practices to Adopt (add to `ttasks/CLAUDE.md`)

Not discrete tasks — conventions that apply immediately to all new work:

- **Performance profiling**: wrap `applyQuery()` call in `useTaskQuery.ts` with `console.time('applyQuery')` / `console.timeEnd` in dev mode. Makes regressions visible before they accumulate.
- **Mobile testing**: before closing any D–G or I-stream feature, test the golden path on iOS or a narrow-viewport browser. Note mobile-specific gotchas in the PRD.
- **Plugin coupling**: new components must not import `TTasksPlugin` or `TaskStore` directly. Pass specific callbacks or service references as props. Components that follow this are testable (see H1).
- **New pure modules**: add to the boundary list in `architectureBoundaries.test.ts` at the same time as creating the file (see H4).

---

### Community Release Checklist

- [ ] README with screenshots
- [ ] BRAT compatibility (beta release)
- [ ] CONTRIBUTING.md
- [ ] Settings import/export
- [ ] Accessibility audit (keyboard nav via E2 + F1; ARIA via F1)
- [ ] Obsidian plugin submission checklist review

---

## 7. Key Conventions

Apply to all streams — D, E, F, G, H, I.

1. **TDD always** — failing tests before implementation. No exceptions for "small" functions.
2. **Pure helpers in dedicated files** — no business logic in Svelte components.
3. **No Obsidian imports in pure modules** — enforced by H4 boundary tests.
4. **`processFrontMatter` for all mutations** — never write raw YAML to existing files.
5. **Minimal interfaces on pure functions** — pass `{ depends_on, blocks }`, not the full `Task`.
6. **Settings normalization always** — every new field needs a fallback in `settings/defaults.ts`.
7. **`npm run build` clean after every session** — zero TS errors is non-negotiable.
8. **New pure module → add to boundary list** — update `architectureBoundaries.test.ts` immediately.
