---
name: "H2: BoardStateService extraction"
description: Extract growing TaskBoard.svelte state into a dedicated testable TS module before the component becomes unmaintainable
type: architecture
stream: H
depends_on: [E1, E2]
---

# H2: BoardStateService Extraction

## Goal

`TaskBoard.svelte` currently owns all board-level state: active task, current view, search query, and after E1+E2 land, batch selection and keyboard focus too. Each stream adds more state to the same component. Extract these into a dedicated `BoardStateService` TypeScript module — a set of Svelte writable stores — so the state is testable, reusable across components, and not buried in a Svelte script block.

**Implement after E1 and E2 are complete.** Both add state to TaskBoard; extracting before they land means extracting again immediately after.

## Current State

State living inside `TaskBoard.svelte` (post E1 + E2):

| Store | Type | Purpose |
|-------|------|---------|
| `activeTaskPath` | `string \| null` | Detail panel open task |
| `currentView` | `string` | Active smart list ID |
| `searchQuery` | `string` | Board search bar value |
| `selectedPaths` | `Set<string>` | E1 batch selection |
| `focusedTaskPath` | `string \| null` | E2 keyboard navigation focus |

All of this is inaccessible to tests without rendering the full Svelte component.

## What to Create

### H2-A: `src/store/BoardStateService.ts`

```typescript
import { writable, derived, get, type Readable, type Writable } from 'svelte/store';

export interface BoardState {
  activeTaskPath: Writable<string | null>;
  currentView: Writable<string>;
  searchQuery: Writable<string>;
  selectedPaths: Writable<Set<string>>;
  focusedTaskPath: Writable<string | null>;
}

export function createBoardStateService(defaultViewId: string): BoardState {
  const activeTaskPath = writable<string | null>(null);
  const currentView = writable<string>(defaultViewId);
  const searchQuery = writable<string>('');
  const selectedPaths = writable<Set<string>>(new Set());
  const focusedTaskPath = writable<string | null>(null);

  return { activeTaskPath, currentView, searchQuery, selectedPaths, focusedTaskPath };
}

// Derived helpers (pure, no side effects):

export function isTaskActive(
  activeTaskPath: Readable<string | null>,
  taskPath: string,
): Readable<boolean>
// Returns a derived store that is true when activeTaskPath === taskPath

export function isViewActive(
  currentView: Readable<string>,
  viewId: string,
): Readable<boolean>
// Returns a derived store that is true when currentView === viewId

export function clearSelectionOnViewChange(
  currentView: Readable<string>,
  selectedPaths: Writable<Set<string>>,
): () => void
// Subscribe: when currentView changes, clear selectedPaths
// Returns unsubscribe function for cleanup
```

### H2-B: Migration in `TaskBoard.svelte`

Replace local `let` declarations with service stores:

```typescript
// Before (inside <script>):
let activeTaskPath: string | null = null;
let currentView = 'all';
let searchQuery = '';
let selectedPaths: Set<string> = new Set();
let focusedTaskPath: string | null = null;

// After:
const boardState = createBoardStateService(defaultViewId);
const { activeTaskPath, currentView, searchQuery, selectedPaths, focusedTaskPath } = boardState;
// References throughout: $activeTaskPath, $currentView, etc. — unchanged
```

`TaskBoardView.ts` creates the service and passes it to `TaskBoard.svelte` as a prop, or the service is created inside `TaskBoard.svelte` on mount. Either approach keeps the Svelte reactivity (`$store`) syntax working unchanged.

### H2-C: Wire keyboard shortcuts (E2) through service

`TaskBoardView.ts` currently calls `handleShortcut` which modifies `focusedTaskPath` and `activeTaskPath` inside the component. After extraction, `handleShortcut` reads/writes from `boardState` directly — no component reference needed.

### H2-D: `src/store/BoardStateService.test.ts`

Pure helper tests — no Svelte rendering required.

**Tests (≥10):**

- `createBoardStateService` returns all five stores with correct initial values
- `isTaskActive` derived store: true when paths match, false otherwise
- `isTaskActive` updates reactively when activeTaskPath changes
- `isViewActive` derived store: true when view IDs match
- `isViewActive` updates reactively when currentView changes
- `clearSelectionOnViewChange`: selection cleared when view changes
- `clearSelectionOnViewChange`: selection unchanged when same view set again
- Setting `selectedPaths` to non-empty set → reflected in derived consumers
- Setting `activeTaskPath` to null closes detail panel (state only — no Svelte)
- Unsubscribe from `clearSelectionOnViewChange` stops side effects

## Acceptance Criteria

- [ ] `BoardStateService.ts` contains all five stores and pure helpers
- [ ] `TaskBoard.svelte` imports from `BoardStateService` — no local state duplication
- [ ] All existing board behaviour works identically after migration
- [ ] `TaskBoardView.ts` keyboard handler reads/writes board state without component reference
- [ ] All tests pass, `npm run build` clean

## Implementation Order

1. Create `BoardStateService.ts` with all stores and helpers (no Svelte rendering)
2. Write `BoardStateService.test.ts` — red
3. Implement helpers until tests green
4. Migrate `TaskBoard.svelte` — replace local state declarations with service stores
5. Wire `TaskBoardView.ts` keyboard handler to service
6. Manual smoke test: active task, search, view switching, batch selection, keyboard nav all work

## Principles

**TDD**: Pure store helpers (derived, clearSelectionOnViewChange) written test-first.
**SRP**: `TaskBoard.svelte` becomes a pure renderer + event dispatcher. State ownership moves to `BoardStateService`.
**DRY**: `isTaskActive` and `isViewActive` derived helpers replace ad-hoc `$activeTaskPath === path` expressions duplicated across the template.
**SoC**: What state exists (BoardStateService) separate from how it's rendered (TaskBoard.svelte) separate from how keyboard events modify it (TaskBoardView.ts).

## Gotchas

- Svelte's `$store` auto-subscription syntax only works inside `.svelte` files. In plain `.ts`, use `get(store)` for one-shot reads and `store.subscribe()` for reactive subscriptions.
- `createBoardStateService` returns a new set of stores each call. There should be exactly one instance per board view — create it in `TaskBoardView.onOpen()` and pass it down, or create it once in `TaskBoard.svelte` on mount.
- `clearSelectionOnViewChange` returns an unsubscribe function. Call it in `TaskBoardView.onClose()` to avoid memory leaks.
- The migration should be done in one commit — partial state extraction (some stores extracted, some not) creates a confusing hybrid that's harder to reason about than either extreme.

## Dependencies

- Requires: E1 (adds selectedPaths), E2 (adds focusedTaskPath) — implement after both land
- Blocks: nothing
