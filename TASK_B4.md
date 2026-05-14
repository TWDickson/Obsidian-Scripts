---
name: "B4: Graph create branching tasks — right-click new dependent"
description: Add context menu option in graph to create new task dependent on selected task
type: enhancement
---

# B4: Graph create branching tasks — right-click new dependent

## Issue

In dependency graph view, users can't create branching tasks efficiently. To create a task that depends on a selected task, they must:
1. Open task detail
2. Click "Add Dependency" modal
3. Create new task (awkward)

Better workflow: **Right-click task in graph → "Create task depending on this"**

## Fix

**Location**: `TaskGraph.svelte` context menu or right-click handler

**Change**: Add context menu item that:
1. Opens "Create Task" modal (like CreateTask.js)
2. Pre-fills `parent_task` with selected task
3. Auto-fills `depends_on: [selectedTask.id]`
4. User completes form and saves
5. New task appears in graph connected to original

## Acceptance Criteria

- [ ] Right-click task in graph → "Create task depending on this" appears
- [ ] Modal opens with form pre-filled (parent, depends_on set)
- [ ] User fills title, priority, category, etc.
- [ ] Save creates task
- [ ] New task appears in graph connected with dashed arrow to original
- [ ] Original task now has "Unblocks [new task]" relationship visible
- [ ] No TypeScript errors

## Verification

1. Open graph view
2. Right-click any task
3. Select "Create task depending on this"
4. Modal opens with depends_on pre-filled (verify in form)
5. Enter task title, click Save
6. New task appears in graph
7. Dashed arrow connects new task → original task (dependency)
8. Refresh page; relationship persists

## Time Estimate

45 minutes (locate graph context menu, add new action, wire to modal)

## Implementation Notes

### Where to Look

1. **TaskGraph.svelte** (~1114 lines):
   - Search for existing context menu handling (right-click)
   - Look for: `contextMenu`, `showContextMenu`, or mouse event handlers
   - Current actions: likely open task, view details, etc.

2. **CreateTask.js** or modal pattern:
   - Review how modal is opened with pre-filled values
   - Look for: `parent_task` and `depends_on` fields in form

3. **Graph rendering**:
   - After task creation, check if graph re-queries automatically
   - If not, manually trigger re-query: `query.set({...currentQuery})`

### Implementation Order

1. **Identify context menu code** in TaskGraph.svelte:
   - Find where right-click menu items are defined
   - Note: may be using Obsidian's context menu or custom menu

2. **Add new action**:
   - New menu item: "Create task depending on this"
   - Action handler: `onCreateDependentTask(task)`

3. **Open modal**:
   - Call existing create modal (or replicate pattern from CreateTask.js)
   - Pass: `{ parent_task: task.id, depends_on: [task.id] }`

4. **Handle form submission**:
   - After task is created, trigger graph re-query if needed
   - Verify new task appears in graph

5. **Test**:
   - Right-click several tasks
   - Create dependent tasks
   - Verify graph updates

## Gotchas

### Modal API

If modal is provided by QuickAdd (CreateTask.js), may not be directly callable from TaskGraph. Solution: create minimal modal inline or dispatch event to open modal.

### Pre-fill Handling

Form fields need to accept pre-filled values. Check if modal accepts initial state parameters:
```js
openCreateModal({ parent_task: task.id, depends_on: [task.id] })
```

### Graph Re-query

After creating a new task, graph may not automatically re-query. Solution:
```js
// Trigger re-query
query.set({ ...currentQuery });
```

### Circular Dependency Prevention

Don't allow creating a task that depends on a task that already depends on it. Solution: check `sanitizeDependencies()` from TaskRelationships (A3).

## Dependencies

- **A3 (TaskRelationships)** — depends on sanitizeDependencies for validation
- **Can run with**: B5, B6 (independent graph enhancements)
- **Blocks**: Nothing

## Related Issues

- Graph view is read-only (no creation workflow)
- Users must context-switch to task detail to create branching tasks
- Inefficient dependency workflow in graph view
