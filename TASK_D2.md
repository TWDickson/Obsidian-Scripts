---
name: "D2: Kanban column collapse"
description: Allow collapsing individual Kanban columns to thin headers, persisted per-view in settings
type: enhancement
---

# D2: Kanban column collapse

## Goal

Users with many status columns (Active, In Progress, Blocked, Future, Hold, Cancelled, Done…) can't see everything at once. Allow collapsing individual columns to a thin header-only strip to focus on what matters.

## Current State

`TaskKanban.svelte` renders all configured statuses as full-width columns. Column width is fixed; there is no collapse mechanism. `plugin.settings.statuses` drives column order.

## What to Create

### 1. Pure helpers (TDD first)

```typescript
// src/components/kanbanCollapse.ts

export function toggleColumnCollapse(
  collapsed: Set<string>,
  columnId: string,
): Set<string> {
  const next = new Set(collapsed);
  if (next.has(columnId)) {
    next.delete(columnId);
  } else {
    next.add(columnId);
  }
  return next;
}

export function isColumnCollapsed(collapsed: Set<string>, columnId: string): boolean {
  return collapsed.has(columnId);
}

export function serializeCollapsed(collapsed: Set<string>): string[] {
  return [...collapsed].sort();
}

export function deserializeCollapsed(raw: string[] | undefined): Set<string> {
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw);
}
```

### 2. Settings schema

```typescript
// In TTasksSettings:
kanbanCollapsedColumns: string[];  // persisted IDs of collapsed columns
```

Default: `kanbanCollapsedColumns: []`.

In normalization: `asStringArray(root.kanbanCollapsedColumns)` — fall back to `[]`.

### 3. TaskKanban.svelte changes

```typescript
// Reactive collapsed state (loaded from settings, persisted on toggle)
$: collapsedColumns = deserializeCollapsed(plugin.settings.kanbanCollapsedColumns);

async function toggleCollapse(columnId: string): Promise<void> {
  collapsedColumns = toggleColumnCollapse(collapsedColumns, columnId);
  plugin.settings.kanbanCollapsedColumns = serializeCollapsed(collapsedColumns);
  await plugin.saveSettings();
}
```

Collapsed column renders as a thin `64px` strip:
```svelte
<div
  class="tt-kanban-col"
  class:tt-col-collapsed={isColumnCollapsed(collapsedColumns, col.id)}
>
  <div class="tt-col-header">
    <span class="tt-col-title">{col.label}</span>
    <span class="tt-col-count">{col.tasks.length}</span>
    <button class="tt-col-toggle" on:click={() => toggleCollapse(col.id)}
      title={isColumnCollapsed(collapsedColumns, col.id) ? 'Expand' : 'Collapse'}
      aria-expanded={!isColumnCollapsed(collapsedColumns, col.id)}
    >
      {isColumnCollapsed(collapsedColumns, col.id) ? '›' : '‹'}
    </button>
  </div>
  {#if !isColumnCollapsed(collapsedColumns, col.id)}
    <!-- cards -->
  {/if}
</div>
```

CSS: `.tt-col-collapsed { width: 48px; min-width: 48px; flex: none; writing-mode: vertical-rl; }`

## Acceptance Criteria

### Functionality
- [ ] `toggleColumnCollapse`: toggles a column in/out of the collapsed set, returns new Set
- [ ] `isColumnCollapsed`: returns correct boolean
- [ ] `serializeCollapsed`/`deserializeCollapsed`: roundtrip lossless
- [ ] Collapsed columns show as thin vertical strips with title + count
- [ ] Task cards are hidden when collapsed
- [ ] Collapse state persists across view switches and page reloads (in settings)
- [ ] Collapse toggle button has correct `aria-expanded` attribute

### Code Quality
- [ ] `kanbanCollapse.ts`: 0 TypeScript errors, pure functions, no Obsidian deps
- [ ] `kanbanCollapse.test.ts`: ≥10 tests (toggle add, toggle remove, empty set, serialize, deserialize, roundtrip, isCollapsed true/false)
- [ ] Settings normalization handles missing `kanbanCollapsedColumns`
- [ ] Collapsed state resets cleanly when statuses are renamed (old IDs just become inert)

### Verification
- [ ] Build: `npm run build` clean
- [ ] Tests: all pass

## Implementation Order (TDD)

1. Create `kanbanCollapse.ts` — pure functions
2. Write `kanbanCollapse.test.ts` — tests red
3. Implement until tests green
4. Add `kanbanCollapsedColumns` to settings schema + defaults + normalization
5. Update `TaskKanban.svelte` — reactive state, toggle handler, collapsed render
6. Add CSS for collapsed column

## Principles

**TDD**: All state mutation logic written test-first as pure functions.
**DRY**: `toggleColumnCollapse` mirrors the list view's `collapsedPaths` pattern — same Set toggle idiom.
**SOLID**: Collapse logic (kanbanCollapse.ts) is a pure utility (SRP). Settings schema owns persistence; component owns UX.
**SoC**: Toggle logic (pure) separate from persistence (settings save) separate from rendering (svelte template).

## Gotchas

- Don't use column `label` as the persistence key — labels can change. Use `id` (which equals the status string).
- If a status is later deleted from the statuses list, its collapse entry in `kanbanCollapsedColumns` becomes inert — that's acceptable.
- Mobile: collapsed columns should still be draggable targets (dragover should re-expand or accept drops).
- Drag UX: dragging over a collapsed column for >500ms could auto-expand it (future enhancement, not in scope here).

## Dependencies

- D1 (Kanban card fields) — parallel, independent.
- Blocks: nothing.
