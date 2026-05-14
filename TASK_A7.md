---
name: "A7: Decompose TaskDetail.svelte into sub-components"
description: Break 1381-line TaskDetail.svelte into 6 focused, reusable sub-components
type: feature
---

# A7: Decompose TaskDetail.svelte into sub-components

## Goal

Break `TaskDetail.svelte` from 1381 lines into 5–6 focused sub-components (~200 lines max each). Improves readability, reusability, and maintainability without changing behavior.

## Scope

### Current State

`TaskDetail.svelte` is a monolithic component handling:
1. Header (title, type badge, project breadcrumb)
2. View/edit mode toggle
3. Edit form (modal-like with all fields)
4. Read-only display with inline edits
5. Relationship management (parent, depends_on, blocks)
6. Dates panel (due date, start date, estimated days, recurrence)
7. Quick actions panel (start/complete/block/defer buttons)

All logic mixed in one file makes it hard to:
- Test individual sections
- Reuse components
- Navigate the code
- Modify without side-effects

### What to Create

**`TaskDetailHeader.svelte`** (100–150 lines)
- Task title (text input in edit, text display in view)
- Type badge (task/project/note)
- Priority indicator
- Project breadcrumb (clickable link to parent project)

**`TaskDetailEditMode.svelte`** (300–350 lines)
- Modal-like form with collapsible sections
- All editable fields: title, description, type, status, dates, priority, category, etc.
- Save/Cancel buttons
- Validation on submit

**`TaskDetailViewMode.svelte`** (250–300 lines)
- Read-only display of task
- Inline edit buttons (click to edit specific fields)
- Non-editable sections (project breadcrumb, read-only dates display)

**`TaskDetailRelationships.svelte`** (200–250 lines)
- Parent task display + "Change parent" button
- Depends on list + "Add dependency" + remove buttons
- Blocks list + "Manage blocking" + remove buttons
- Modals for adding/removing relationships

**`TaskDetailDatesPanel.svelte`** (150–200 lines)
- Due date picker + "Clear due date" button
- Start date picker
- Estimated days input + "Clear" button
- Recurrence editor (frequency, end date, etc.)
- Visual indicators (overdue, upcoming, etc.)

**`TaskDetailQuickActions.svelte`** (100–150 lines)
- Button panel: Start/In Progress, Complete, Block, Defer, Duplicate, Archive
- Button states (disabled if not applicable)
- Confirmation dialogs if needed (delete, archive)

**`TaskDetail.svelte`** (refactored orchestrator, ~150 lines)
- Import all sub-components
- Manage high-level state (view/edit mode, selected task)
- Layout sub-components in correct order
- Pass props and callbacks to each

### Component Contract

Each sub-component:
- Receives `task: Task` (read-only)
- Receives callbacks: `on:taskUpdate`, `on:taskDelete`, `on:openTask`, etc.
- No internal state changes (mutations via callbacks)
- Clear prop interface
- Single responsibility

### Integration Point

In parent component that uses TaskDetail:

```svelte
<TaskDetail
  bind:task={selectedTask}
  on:taskUpdate={(e) => taskStore.writer.update(e.detail.id, e.detail)}
  on:taskDelete={(e) => taskStore.writer.delete(e.detail.id)}
  on:openTask={(e) => workspace.open(e.detail)}
/>
```

## Deliverables

1. **`TaskDetailHeader.svelte`** (new, ~120 lines)
   - Props: task, isEditMode
   - Display: title, type badge, breadcrumb
   - Events: update title, open parent project

2. **`TaskDetailEditMode.svelte`** (new, ~320 lines)
   - Props: task, formState
   - Display: all fields in editable form
   - Events: save form, cancel edit, field updates

3. **`TaskDetailViewMode.svelte`** (new, ~280 lines)
   - Props: task
   - Display: read-only with inline edit buttons
   - Events: open inline editor for specific field

4. **`TaskDetailRelationships.svelte`** (new, ~220 lines)
   - Props: task, allTasks
   - Display: parent, depends_on, blocks lists
   - Events: change parent, add/remove dependency

5. **`TaskDetailDatesPanel.svelte`** (new, ~180 lines)
   - Props: task, currentDate
   - Display: due date, start date, estimated days, recurrence
   - Events: update dates, clear dates

6. **`TaskDetailQuickActions.svelte`** (new, ~120 lines)
   - Props: task
   - Display: button panel with action buttons
   - Events: action clicked (start, complete, block, defer, duplicate, archive)

7. **`TaskDetail.svelte`** (refactored, ~140 lines)
   - Remove inline implementations
   - Import and compose sub-components
   - Manage edit/view mode state
   - Pass props and callbacks

8. **`TaskDetail.test.ts`** (updated)
   - Existing tests should still pass (no behavior change)
   - May need to mount sub-components individually

## Acceptance Criteria

### Functionality
- [ ] All task details display correctly (same as before)
- [ ] Edit mode works (all fields editable)
- [ ] View mode works (inline edits available)
- [ ] Relationships update correctly
- [ ] Dates display and update correctly
- [ ] Quick actions execute correctly
- [ ] No behavior changes from original component

### Code Quality
- [ ] Each sub-component: 0 TypeScript errors
- [ ] TaskDetail.svelte: 0 TypeScript errors
- [ ] Each sub-component single responsibility
- [ ] Props clearly typed (no `any`)
- [ ] Events are semantic (not generic `update` events)
- [ ] Each file <200 lines (except edit/view at ~300)
- [ ] Tests still pass (no regression)

### Verification
- [ ] Build: `npm run build` succeeds, zero errors
- [ ] Tests: `npm run test` passes, 440+ tests passing
- [ ] Manual: Open task detail → all sections appear, work as before
- [ ] Manual: Switch edit/view mode → works
- [ ] Manual: Edit dates, relationships, quick actions → work correctly
- [ ] Code diff: original 1381 lines → 6 files ~1200 lines total (slightly reduced, much clearer)

## Code Hints

### Where to Look

1. **Current TaskDetail.svelte** (~1381 lines):
   - Structure via `<section>` or `<div class="...">` tags
   - Look for: header section, view/edit sections, relationships, dates, quick actions
   - Extract each section into its own component

2. **Header section** (~50 lines):
   - Title display/edit
   - Type badge
   - Breadcrumb
   - → TaskDetailHeader.svelte

3. **Edit form** (~400 lines):
   - All input fields
   - Save/cancel buttons
   - Validation
   - → TaskDetailEditMode.svelte

4. **View mode** (~300 lines):
   - Read-only display
   - Inline edit buttons
   - → TaskDetailViewMode.svelte

5. **Relationships section** (~200 lines):
   - Parent display/change
   - Dependencies list
   - Blocks list
   - → TaskDetailRelationships.svelte

6. **Dates section** (~150 lines):
   - Due date, start date pickers
   - Estimated days
   - Recurrence
   - → TaskDetailDatesPanel.svelte

7. **Quick actions** (~100 lines):
   - Button row
   - Click handlers
   - → TaskDetailQuickActions.svelte

### Implementation Order

1. **Identify section boundaries** in TaskDetail.svelte:
   - Find where header ends, edit form begins, etc.
   - Mark with comments

2. **Extract header** → TaskDetailHeader.svelte:
   - Copy header HTML
   - Extract title, type, breadcrumb logic
   - Replace in TaskDetail with `<TaskDetailHeader />`

3. **Extract relationships** → TaskDetailRelationships.svelte:
   - Copy relationships HTML
   - Extract parent/depends_on/blocks logic
   - Replace in TaskDetail with `<TaskDetailRelationships />`

4. **Extract dates** → TaskDetailDatesPanel.svelte:
   - Copy dates HTML
   - Extract date picker logic
   - Replace in TaskDetail with `<TaskDetailDatesPanel />`

5. **Extract quick actions** → TaskDetailQuickActions.svelte:
   - Copy button panel HTML
   - Extract action handlers
   - Replace in TaskDetail with `<TaskDetailQuickActions />`

6. **Split view/edit** → TaskDetailViewMode.svelte, TaskDetailEditMode.svelte:
   - This is the largest extraction
   - Copy view-mode HTML → ViewMode component
   - Copy edit-mode HTML → EditMode component
   - Replace in TaskDetail with conditional: `{#if isEditMode}<EditMode />{:else}<ViewMode />{/if}`

7. **Clean up TaskDetail.svelte**:
   - Remove all inline implementations
   - Keep only: imports, state management, event handlers that coordinate
   - Should be <150 lines

8. **Update tests**:
   - Keep integration tests in TaskDetail.test.ts (tests whole component)
   - Can add unit tests for sub-components if needed

## Gotchas

### Event Bubbling

Sub-components emit events (update, delete). Parent TaskDetail.svelte must forward them up.

**Pattern**:
```svelte
<TaskDetailHeader
  on:updateTask={(e) => dispatch('taskUpdate', e.detail)}
/>
```

### Prop Drilling

If sub-component needs global state (allTasks, settings), pass via props, don't store globally.

**Solution**: TaskDetail.svelte receives all needed props, passes them down:
```svelte
<TaskDetailRelationships
  {task}
  {allTasks}
  {settings}
/>
```

### Edit State Management

Which component owns edit/view mode state?

**Solution**: Outer TaskDetail.svelte owns this state:
```svelte
<script>
  let isEditMode = false;
</script>

{#if isEditMode}
  <TaskDetailEditMode {task} on:save={() => (isEditMode = false)} />
{:else}
  <TaskDetailViewMode {task} on:edit={() => (isEditMode = true)} />
{/if}
```

### Reactive Updates

When task changes (from parent), all sub-components need to update.

**Solution**: Use reactive statements:
```svelte
<script>
  export let task;
  
  $: {
    // Any change to task re-runs this block
    // Update local state if needed
  }
</script>
```

### Testing

Existing tests for TaskDetail may break if they reference internal elements.

**Solution**: Update tests to:
1. Test component still works (black-box testing)
2. Test sub-components receive correct props
3. Test events bubble correctly

## Dependencies

- **A1–A6 should complete first** — improves foundation
- **Can run with**: No parallel constraints
- **Blocks**: Nothing (final refactoring item before bugs)

## Related Issues

- TaskDetail.svelte at 1381 lines (hard to navigate)
- Single-file component makes reuse difficult
- Mixing concerns (layout, data editing, relationship management)
- No isolation for testing specific features

---

## Component Ownership & State

```
TaskDetail.svelte (orchestrator)
  ├─ manages: isEditMode, taskChanges
  ├─ TaskDetailHeader (props: task, isEditMode)
  ├─ TaskDetailViewMode (props: task, isEditMode) OR
  ├─ TaskDetailEditMode (props: task, isEditMode)
  ├─ TaskDetailRelationships (props: task, allTasks)
  ├─ TaskDetailDatesPanel (props: task)
  └─ TaskDetailQuickActions (props: task)
     └─ all emit events that bubble to parent
```

Each sub-component is stateless (or has minimal UI state). All task mutations flow through events to parent TaskDetail, which dispatches to TaskStore.
