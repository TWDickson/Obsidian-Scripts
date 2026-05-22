---
name: "J5: DRY cleanup — context menu and notice creation"
description: Eliminate confirmed duplicate logic in context menu building and notice creation patterns
type: architecture
stream: J
priority: Low
depends_on: [J3]
---

# J5: DRY Cleanup

## Goal

Two confirmed DRY violations: context menu building logic is implemented twice in `main.ts`, and notice creation follows an identical pattern in two places in `ReminderService.ts` (the latter is being fixed by J3, which extracts `buildReminderNotice` — this task covers the context menu side and any remaining callsite duplication).

## Confirmed Issues

### main.ts:221–226 and 313–355 — Duplicate context menu building

Two separate code paths both build the task context menu:
1. `showTaskContextMenu()` (line ~221) — used when the user right-clicks a task row
2. `registerNativeContextMenus()` (line ~313) — registers a workspace event handler that adds items to Obsidian's native file context menu

Both call the same menu-item building function(s) but the surrounding setup code is duplicated. If a new context menu action is added, it must be wired in two places — and the second is easy to forget.

**What to do**: extract a single `buildTaskContextMenuItems(menu: Menu, task: Task, callbacks: TaskActionCallbacks): void` function that both code paths call. The only difference between the two paths is how the `Menu` object is obtained (one creates it fresh, one receives it from the workspace event) — the items added to it should be identical.

### Dependency mutation pattern in `TaskWriter.ts`

The pattern of "find task in cache → read current depends_on/blocks → add/remove a path → write back" appears in at least three methods. Each reimplements the array mutation logic. Should be one helper:

```typescript
function mutateLinkArray(
  current: string[],
  add: string[],
  remove: string[],
): string[]
// Deduplicates, removes specified paths, adds new paths
// Returns new array — pure, immutable
```

## What to Create

### J5-A: Context menu unification in `main.ts`

Audit the two context menu code paths (lines 221–226 and 313–355). Extract their shared item-building logic:

```typescript
// Confirm this function already exists as addTaskContextMenuItems or similar
// If it does, verify both paths are actually calling it
// If not, extract it:

function addTaskContextMenuItems(
  menu: Menu,
  task: Task,
  callbacks: {
    onComplete: () => void;
    onArchive: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onOpen: () => void;
  }
): void
// Adds all action items to `menu`
// Called identically by both showTaskContextMenu() and the native event handler
```

This is partly done via `integration/taskActionPorts.ts` — read that file first to understand what's already extracted. Fill the remaining gaps.

### J5-B: `mutateLinkArray` in `src/utils/arrayUtils.ts`

```typescript
export function mutateLinkArray(
  current: string[],
  add: string[],
  remove: string[],
): string[]
// Removes paths in `remove`, adds paths in `add`, deduplicates result
// Order: existing items (minus removed) first, then new items
// Pure function, no mutation of input arrays
```

Update `TaskWriter.ts` wherever depends_on/blocks arrays are modified to use this helper.

**Tests (≥8) — `src/utils/arrayUtils.test.ts`:**

- Add to empty array → returns `[newPath]`
- Remove from array → path absent in result
- Remove non-existent path → no error, array unchanged
- Add duplicate → deduplicates, appears once
- Add and remove simultaneously → remove wins if path in both
- Empty add and remove → returns copy of current
- Preserves order of unaffected items
- Returns new array, does not mutate input

## Acceptance Criteria

- [ ] Context menu item building called from exactly one function — both `showTaskContextMenu` and native event handler use it
- [ ] Adding a new context menu action requires editing exactly one place
- [ ] `mutateLinkArray` in `arrayUtils.ts` with ≥8 tests
- [ ] `TaskWriter.ts` depends_on/blocks mutations use `mutateLinkArray`
- [ ] All existing tests pass, no behaviour change
- [ ] `npm run build` clean

## Implementation Order (TDD)

1. Read `main.ts` lines 200–360 and `integration/taskActionPorts.ts` to understand the current context menu structure
2. Determine what's already shared vs. duplicated
3. Extract/verify the shared menu-item builder
4. Write `arrayUtils.test.ts` — red
5. Implement `mutateLinkArray` — green
6. Update `TaskWriter.ts` callsites
7. Run full test suite

## Gotchas

- **`integration/taskActionPorts.ts` may already handle this** — read it before assuming the context menu is fully duplicated. The issue may be smaller than it appears (only the outer setup is duplicated, not the item building itself).
- **`mutateLinkArray`** is pure — safe to add to `arrayUtils.ts` alongside other array helpers. Add it to the architecture boundary list in `architectureBoundaries.test.ts` (H4).

## Dependencies

- Requires: J3 (notice creation DRY fix is in J3 — this task covers context menu + link arrays only)
- Blocks: nothing
