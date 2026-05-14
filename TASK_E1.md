---
name: "E1: Multi-select + batch operations"
description: Add checkbox selection to task lists, with a batch action bar for bulk archive, status change, and delete
type: feature
---

# E1: Multi-select + batch operations

## Goal

Every task operation currently requires opening the detail panel or right-clicking one task at a time. Completing a sprint and archiving 8 tasks means 8 separate interactions. Add multi-select with a batch action bar.

## Current State

- `TaskRow.svelte` has no selection concept
- No global selection state exists
- `ArchiveService`, `TaskStore` already support per-task archive/delete/update — the building blocks exist
- `TaskBoard.svelte` manages view-level state

## What to Create

### 1. Pure selection helpers (TDD first)

```typescript
// src/store/taskSelection.ts

export function addToSelection(current: Set<string>, path: string): Set<string> {
  const next = new Set(current);
  next.add(path);
  return next;
}

export function removeFromSelection(current: Set<string>, path: string): Set<string> {
  const next = new Set(current);
  next.delete(path);
  return next;
}

export function toggleSelection(current: Set<string>, path: string): Set<string> {
  return current.has(path) ? removeFromSelection(current, path) : addToSelection(current, path);
}

export function selectAll(paths: string[]): Set<string> {
  return new Set(paths);
}

export function clearSelection(): Set<string> {
  return new Set();
}

// Eligibility: which operations are available given selection
export function batchEligibility(
  selectedPaths: Set<string>,
  tasks: Array<{ path: string; is_complete: boolean }>,
): {
  canArchive: boolean;     // all selected are complete
  canDelete: boolean;      // any selected (always true if non-empty)
  canComplete: boolean;    // any selected are not complete
} {
  if (selectedPaths.size === 0) return { canArchive: false, canDelete: false, canComplete: false };
  const selected = tasks.filter(t => selectedPaths.has(t.path));
  return {
    canArchive: selected.every(t => t.is_complete),
    canDelete: true,
    canComplete: selected.some(t => !t.is_complete),
  };
}
```

### 2. `SelectionStore` (writable store, lives in TaskBoard)

```typescript
// In TaskBoard.svelte script:
const selectedPaths: Writable<Set<string>> = writable(new Set());

// Clear selection when view changes
$: if (currentView) selectedPaths.set(clearSelection());
```

### 3. `TaskRow.svelte` — add selection props

New props:
```typescript
export let selectable: boolean = false;
export let selected: boolean = false;
export let onSelect: ((path: string) => void) | undefined = undefined;
```

When `selectable`, render a checkbox before the expand button:
```svelte
{#if selectable}
  <input
    type="checkbox"
    class="tt-task-checkbox"
    checked={selected}
    on:click|stopPropagation
    on:change={() => onSelect?.(task.path)}
    aria-label="Select task"
  />
{/if}
```

### 4. `BatchActionBar.svelte` (new component)

```svelte
<!-- Visible when selectedPaths.size > 0 -->
<!-- Positioned: sticky bottom of tt-board-content -->
<script>
  export let selectedCount: number;
  export let eligibility: BatchEligibility;
  export let onArchive: () => Promise<void>;
  export let onComplete: () => Promise<void>;
  export let onDelete: () => Promise<void>;
  export let onClear: () => void;
</script>

<div class="tt-batch-bar">
  <span class="tt-batch-count">{selectedCount} selected</span>
  {#if eligibility.canComplete}
    <button on:click={onComplete}>✓ Complete</button>
  {/if}
  {#if eligibility.canArchive}
    <button on:click={onArchive}>Archive</button>
  {/if}
  <button class="tt-batch-delete" on:click={onDelete}>Delete</button>
  <button class="tt-batch-clear" on:click={onClear}>✕</button>
</div>
```

### 5. `TaskBoard.svelte` — wire batch actions

```typescript
async function batchArchive(): Promise<void> {
  for (const path of $selectedPaths) {
    await plugin.archiveService.archiveTask(path);
  }
  selectedPaths.set(clearSelection());
}

async function batchComplete(): Promise<void> {
  const completionStatus = plugin.settings.completionStatus;
  const today = localDateString();
  for (const path of $selectedPaths) {
    await plugin.taskStore.update(path, { status: completionStatus, completed: today });
  }
  selectedPaths.set(clearSelection());
}

async function batchDelete(): Promise<void> {
  // Show confirm dialog before delete
  if (!await confirmBatchDelete($selectedPaths.size)) return;
  for (const path of $selectedPaths) {
    await plugin.taskStore.delete(path);
  }
  selectedPaths.set(clearSelection());
}
```

### Keyboard shortcut

- `Escape`: clear selection (if batch bar is visible)

## Acceptance Criteria

### Pure functions
- [ ] `addToSelection`, `removeFromSelection`, `toggleSelection`, `selectAll`, `clearSelection`: all correct, immutable (return new Set)
- [ ] `batchEligibility`: canArchive false if any incomplete; canComplete false if all complete; canDelete always true when non-empty

### UI
- [ ] Checkbox appears on TaskRow when `selectable=true`
- [ ] Selecting multiple tasks shows batch action bar at bottom of board
- [ ] Bar shows correct available actions based on selection eligibility
- [ ] "Archive" only shows when all selected tasks are complete
- [ ] "Complete" marks all incomplete selected tasks as done
- [ ] "Delete" shows confirmation dialog before deleting
- [ ] `✕` button clears selection
- [ ] Selection clears automatically when switching views
- [ ] `Escape` key clears selection when bar is visible

### Code Quality
- [ ] `taskSelection.ts`: 0 TypeScript errors, pure functions, no Obsidian deps
- [ ] `taskSelection.test.ts`: ≥12 tests covering all helpers + batchEligibility cases
- [ ] `BatchActionBar.svelte`: 0 TypeScript errors
- [ ] No business logic inside BatchActionBar (pure renderer)
- [ ] Batch operations use existing store methods — no duplicate vault logic

### Verification
- [ ] Build: `npm run build` clean
- [ ] Tests: all pass

## Implementation Order (TDD)

1. Create `taskSelection.ts` — pure functions
2. Write `taskSelection.test.ts` — red
3. Implement until tests green
4. Add checkbox props to `TaskRow.svelte`
5. Create `BatchActionBar.svelte`
6. Update `TaskBoard.svelte` — selection store, batch handlers, wire row+bar
7. Pass `selectable` + `onSelect` to TaskList (list view only, skip kanban/graph)

## Principles

**TDD**: All selection logic written test-first as pure functions.
**DRY**: Re-uses existing `archiveTask`, `taskStore.update`, `taskStore.delete` — zero new vault logic.
**SOLID**: Selection state (store), eligibility (pure fn), rendering (BatchActionBar), execution (board handlers) are all separate responsibilities.
**SoC**: Selection data (which paths) separate from eligibility (what's allowed) separate from execution (what happens) separate from UI (checkboxes + bar).

## Gotchas

- **List view only initially** — Kanban cards are drag targets; adding checkboxes complicates drag semantics. Implement for list view first; add to kanban in D-stream follow-up if desired.
- **Deselect on navigate** — If user opens a task in the detail panel, selection should NOT clear (they may want to come back and act). Only clear on view switch.
- **Confirm dialog for delete** — Re-use existing `Modal`-based confirm pattern from single-task delete.
- **Progress feedback** — If batch contains many tasks, show a "Processing..." notice; complete notice when done.

## Dependencies

- C2 (ArchiveService) — must exist (it does).
- D1, D2 — parallel, independent.
- Blocks: nothing.
