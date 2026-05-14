---
name: "D1: Kanban card field visibility + dependency count badge"
description: Add dependency count badge to Kanban cards and make field visibility configurable per-renderer in settings
type: enhancement
---

# D1: Kanban card field visibility + dependency count badge

## Goal

Kanban cards currently always show area, date badge, and labels. Two gaps:
1. **Dependency count** is never shown — users can't see at a glance if a card is blocked or is blocking others.
2. **Field visibility is hardcoded** — users with many labels or areas can't declutter the card view.

Add a `kanbanCardFields` setting (array of toggleable field IDs) and a dependency count badge.

## Current State

`TaskKanban.svelte` card template always renders:
- Priority dot + name (always)
- Area badge (when `task.area` is set)
- Date badge (via `getTaskDateBadge`) when due/start date exists
- All labels (all `task.labels`)

Nothing renders dependency count. There is no per-field visibility toggle.

## What to Create

### 1. Pure helper (TDD first)

```typescript
// src/components/kanbanCardFields.ts
export type KanbanCardField = 'area' | 'dueDate' | 'labels' | 'depCount';

export interface DepCountBadge {
  blockedBy: number;   // open depends_on
  unblocks: number;    // task.blocks.length
}

export function buildDepCountBadge(task: {
  depends_on: string[];
  blocks: string[];
  is_complete: boolean;
}): DepCountBadge | null {
  const blockedBy = task.depends_on.length;
  const unblocks = task.blocks.length;
  if (blockedBy === 0 && unblocks === 0) return null;
  return { blockedBy, unblocks };
}

export function isFieldEnabled(fields: KanbanCardField[], field: KanbanCardField): boolean {
  return fields.includes(field);
}
```

### 2. Settings schema

In `settings/types.ts`, add to `TTasksSettings`:
```typescript
kanbanCardFields: KanbanCardField[];
```

In `settings/defaults.ts`:
```typescript
kanbanCardFields: ['area', 'dueDate', 'labels', 'depCount'],
```

### 3. Settings UI

In `SettingsTab.ts`, add a "Kanban cards" section:
- Toggles for each field: "Area badge", "Due date badge", "Labels", "Dependency count"
- Persist to `settings.kanbanCardFields`

### 4. Card template update

In `TaskKanban.svelte`:
- Import `buildDepCountBadge`, `isFieldEnabled` and `KanbanCardField`
- Add `kanbanCardFields: KanbanCardField[]` prop (from plugin.settings)
- Gate each existing badge on `isFieldEnabled(kanbanCardFields, 'area')` etc.
- Add dep count badge: `{#if depBadge && isFieldEnabled(kanbanCardFields, 'depCount')}`

### Dep count badge UI
```svelte
{#if depBadge}
  <span class="tt-badge tt-badge-dep" title="Blocked by {depBadge.blockedBy}, unblocks {depBadge.unblocks}">
    {#if depBadge.blockedBy > 0}⏸{depBadge.blockedBy}{/if}
    {#if depBadge.unblocks > 0}→{depBadge.unblocks}{/if}
  </span>
{/if}
```

## Acceptance Criteria

### Functionality
- [ ] `buildDepCountBadge` returns null when no deps, correct counts when deps exist
- [ ] `isFieldEnabled` returns correct boolean based on settings array
- [ ] Dep count badge appears on cards that have `depends_on` or `blocks`
- [ ] Badge NOT shown on cards with no relationships
- [ ] Toggling a field in settings hides/shows it on all cards immediately (reactive)
- [ ] Default: all 4 fields enabled

### Code Quality
- [ ] `kanbanCardFields.ts`: 0 TypeScript errors, pure functions, no Obsidian deps
- [ ] `kanbanCardFields.test.ts`: ≥8 tests (buildDepCountBadge: null, only blockedBy, only unblocks, both; isFieldEnabled: true/false)
- [ ] Settings normalization handles missing `kanbanCardFields` (falls back to default)
- [ ] No prop drilling beyond what's needed

### Verification
- [ ] Build: `npm run build` clean
- [ ] Tests: all pass, new tests green

## Implementation Order (TDD)

1. Create `kanbanCardFields.ts` — pure functions only
2. Write `kanbanCardFields.test.ts` — all tests red
3. Implement until tests green
4. Add `KanbanCardField` type + `kanbanCardFields` to `settings/types.ts`
5. Add default + normalization in `settings/defaults.ts`
6. Add settings UI in `SettingsTab.ts`
7. Update `TaskKanban.svelte` — add prop, gate badges, add dep count
8. Export `kanbanCardFields` through the settings shim

## Principles

**TDD**: Pure helpers written test-first. Card rendering tested via build.
**DRY**: `isFieldEnabled` is one check reused for all 4 fields. Dep badge logic shared with any future renderer that needs it.
**SOLID**: `kanbanCardFields.ts` is a pure computation module (SRP). Settings type owns field list; component only renders.
**SoC**: Badge data computation (`kanbanCardFields.ts`) separate from badge rendering (template). Settings schema separate from settings UI.

## Gotchas

- `task.depends_on` and `task.blocks` are already on the `Task` type — no schema changes needed.
- `isFieldEnabled` must handle `undefined` gracefully (old settings without the field → show all).
- Don't use `task.blocks.length` as "unblocks active" — task may unblock already-complete tasks. For now show raw count; future work can filter to open only.

## Dependencies

- No prior D-stream work needed — standalone.
- Blocks: nothing (independent).
