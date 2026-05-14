---
name: "A6: Complete Phase 6 Step 3 — Remove viewAdapters flatten bridge"
description: Refactor views to consume Readable<TaskGroup[]> directly, eliminating unnecessary adapter conversions
type: feature
---

# A6: Complete Phase 6 Step 3 — Remove viewAdapters flatten bridge

## Goal

Complete Phase 6 Step 3 by refactoring views to consume `Readable<TaskGroup[]>` directly from the query engine. Remove the intermediate `viewAdapters` layer that unnecessarily flattens and re-groups data, defeating the purpose of the query architecture.

## Scope

### Current State (Phase 6 Step 3 Partial)

Phase 6 established a clean query engine pattern:
- Query engine outputs: `Readable<TaskGroup[]>` (grouped data)
- Views should receive this directly

But current implementation has:
- `TaskList.svelte` receives `groups: Readable<TaskGroup[]>` ✓
- Immediately calls `buildListSections($groups, statuses)` ✗ (flattens groups back to custom format)
- `TaskKanban.svelte` receives `groups` ✓
- Calls `buildKanbanColumns($groups, statuses)` ✗ (flattens and restructures)
- `viewAdapters.ts` has: `flattenTaskGroups`, `buildListSections`, `buildListRows`, `buildKanbanColumns`

### The Problem

The query engine groups tasks for display efficiency (e.g., by status, by date). The adapters undo this grouping, creating duplicate structure:
1. Query engine groups by status → `TaskGroup[]`
2. `buildListSections()` converts back to custom format
3. View re-renders using custom format

This adds unnecessary layers and defeats the purpose of having a query engine.

### What to Refactor

**`TaskList.svelte`** (refactored to ~100 lines):
```svelte
<script>
  export let groups: Readable<TaskGroup[]>;
  export let hierarchy: 'tree' | 'flat';
  export let collapsedPaths: Set<string>;
  
  $: {
    // For each group, render:
    // 1. Group heading (e.g., "In Progress")
    // 2. List of tasks using buildListRows directly
  }
</script>

{#each $groups as group (group.key)}
  <div class="group">
    <div class="group-heading">{group.key}</div>
    <div class="group-tasks">
      {#each buildListRows(group.tasks, ...) as row}
        <!-- render row -->
      {/each}
    </div>
  </div>
{/each}
```

**`TaskKanban.svelte`** (refactored to ~400 lines):
```svelte
<script>
  export let groups: Readable<TaskGroup[]>;
  
  // Status order from settings
  export let statusOrder: string[];
  
  $: {
    // Map groups by status to columns
    // Each group.key = status, group.tasks = tasks in that status
  }
</script>

{#each statusOrder as status}
  {#each $groups as group}
    {#if group.key === status}
      <div class="kanban-column">
        <div class="column-title">{status}</div>
        <!-- render tasks in column -->
      </div>
    {/if}
  {/each}
{/each}
```

**`TaskAgenda.svelte`**:
- Already works correctly (groups by date buckets, renders directly from groups)
- No changes needed

**`TaskGraph.svelte`**:
- Needs `flattenTaskGroups` to render dependency graph on flat canvas
- Keep this function (it's not defeating the purpose)

**`src/components/viewAdapters.ts`** (reduced):
- Delete: `buildListSections`, `buildKanbanColumns`, `buildListRows`
- Keep: `flattenTaskGroups` (graph needs it)
- Keep: `buildVisibleItems`, `getParentPaths`, other hierarchy helpers

### Key Insight

- Query engine outputs: `TaskGroup[]` (grouped for display efficiency)
- Views should iterate groups, render content per-group
- Only flatten if rendering engine requires it (e.g., graph canvas)

## Deliverables

1. **`TaskList.svelte`** (refactored, ~100 lines)
   - Remove `buildListSections()` call
   - Direct iteration: `{#each $groups as group}`
   - Render group heading + tasks inline
   - Maintain same visual output as before
   - Support hierarchy tree/flat via `buildListRows`

2. **`TaskKanban.svelte`** (refactored, ~400 lines)
   - Remove `buildKanbanColumns()` call
   - Map groups by status field
   - Create kanban columns from status order (settings)
   - Maintain drag-drop, card layout, etc.
   - Same visual output as before

3. **`src/components/viewAdapters.ts`** (reduced, ~80 lines)
   - Delete: `buildListSections`, `buildKanbanColumns`, `buildListRows`
   - Keep: `flattenTaskGroups`, hierarchy helpers
   - Update tests accordingly

4. **`src/components/viewAdapters.test.ts`** (updated)
   - Remove tests for deleted adapter functions
   - Keep tests for `flattenTaskGroups`, hierarchy helpers
   - Add tests for `buildListRows` in TaskList.svelte if needed

5. **No behavior change** — views render identically

## Acceptance Criteria

### Functionality
- [ ] TaskList renders all tasks with correct grouping (same as before)
- [ ] TaskKanban renders all status columns with tasks (same as before)
- [ ] TaskAgenda already works, no regression
- [ ] TaskGraph still renders dependency graph (uses flattenTaskGroups)
- [ ] Hierarchy tree/flat modes work correctly
- [ ] Collapsible/expanded state preserved

### Code Quality
- [ ] TaskList.svelte: logic is straightforward group iteration
- [ ] TaskKanban.svelte: columns built from group.key matching status
- [ ] No adapters breaking encapsulation
- [ ] All tests pass (adapt test names/functions)
- [ ] Query engine purpose now clear (group → render, not group → flatten → regroup)

### Verification
- [ ] Build: `npm run build` succeeds, zero errors
- [ ] Tests: `npm run test` passes, 440+ tests passing
- [ ] Manual: View by Status → groups render correctly
- [ ] Manual: Kanban board → columns render correctly with right tasks
- [ ] Manual: Toggle tree/flat hierarchy → works
- [ ] Code diff: viewAdapters.ts reduced by ~70 lines

## Code Hints

### Where to Look

1. **Current TaskList.svelte** (~145 lines):
   - Line ~20: `buildListSections($groups, statuses)`
   - This is what we're removing
   - Look for: how sections are rendered
   - Look for: how rows are built from sections

2. **Current TaskKanban.svelte** (~538 lines):
   - Line ~50–100: `buildKanbanColumns($groups, statuses, colors)`
   - This is what we're removing
   - Look for: column creation logic
   - Look for: task assignment to columns

3. **viewAdapters.ts** (~153 lines):
   - `buildListSections` — delete
   - `buildListRows` — check if can move to TaskList or keep as export
   - `buildKanbanColumns` — delete
   - `flattenTaskGroups` — keep

4. **viewAdapters.test.ts**:
   - Tests for deleted functions → delete or adapt
   - Tests for kept functions → preserve

### Implementation Order

1. Refactor `TaskList.svelte`:
   - Remove `buildListSections()` call
   - Iterate `$groups` directly: `{#each $groups as group}`
   - Render group heading + tasks per group
   - Test: verify tasks appear in correct groups
   
2. Refactor `TaskKanban.svelte`:
   - Remove `buildKanbanColumns()` call
   - Build column map: `const columnMap = new Map(groups.map(g => [g.key, g.tasks]))`
   - Iterate `statusOrder`, render column if exists in map
   - Test: verify columns appear with right tasks
   
3. Update `viewAdapters.ts`:
   - Delete three functions
   - Keep `flattenTaskGroups` and helpers
   - Update exports
   
4. Update `viewAdapters.test.ts`:
   - Remove tests for deleted functions
   - Preserve tests for kept functions
   
5. Update imports across codebase:
   - Check for imports of deleted functions
   - Remove or update as needed
   
6. Run tests; fix any issues
7. Run `npm run build`

## Gotchas

### Status Order Matters

TaskKanban columns should respect status order from settings, not random group order.

**Solution**: In TaskKanban, iterate `statusOrder` (from settings), check if each status exists in groups.

```svelte
{#each statusOrder as status}
  {#each $groups as group}
    {#if group.key === status}
      <!-- render column -->
    {/if}
  {/each}
{/each}
```

### Tree vs Flat Hierarchy

TaskList supports hierarchy: tree (nested) vs flat (collapsed).

**Solution**: Keep `buildListRows` export (or move logic into TaskList component). It handles expanding/collapsing.

### Graph Still Needs Flat View

TaskGraph renders on canvas, needs `flattenTaskGroups` to get a flat array of all tasks.

**Solution**: Keep `flattenTaskGroups` in viewAdapters. Don't delete it.

### Visual Regression

If views look different after refactor:
1. Check group heading formatting
2. Check indentation/nesting of tasks
3. Check spacing and borders
4. Compare before/after screenshots

### Test Coverage

After deleting adapter functions, tests that called them will fail.

**Solution**: Update tests to either:
1. Test components directly (`TaskList.svelte`, `TaskKanban.svelte`)
2. Test helpers that remain (`flattenTaskGroups`, hierarchy utils)

## Dependencies

- **A1, A2, A3, A4, A5** should be done first (no blocking dependencies, but improves overall codebase)
- **Can run with**: A5 (independent systems)
- **Blocks**: Nothing (this completes existing work)

## Related Issues

- Phase 6 Step 3 is "incomplete" — views still use adapters
- Query engine grouping is being undone unnecessarily
- Adds confusion: why group if we're going to flatten?
- Architecture mismatch: clean query engine, messy view layer

---

## Testing Strategy

1. **Unit tests** (adapt existing):
   - Test TaskList renders groups correctly
   - Test TaskKanban renders columns correctly
   - Test hierarchy tree/flat works

2. **Visual regression**:
   - Compare before/after: List view, Kanban board, Agenda, Graph
   - Verify no spacing/alignment changes

3. **Integration**:
   - Create task, view in List → appears in correct group
   - Create task, view in Kanban → appears in correct column
   - Drag task in Kanban → changes status → query re-groups
   - Collapse group in List → tasks hidden, expand → tasks shown

4. **Edge cases**:
   - Empty groups (status with no tasks) → column/section still renders?
   - New status added → appears in Kanban?
   - Task status changed → moves to new group in real-time?
