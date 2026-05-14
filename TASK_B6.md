---
name: "B6: Verify complete/uncomplete status cycle"
description: Ensure complete/uncomplete status transitions work correctly and cycle properly
type: bug
---

# B6: Verify complete/uncomplete status cycle

## Issue

Task status cycle (active → in progress → complete → uncomplete → active) may have bugs:
- Completing a task doesn't properly update `is_complete` derived field
- Uncompleting a task may not restore previous status
- Status may be inconsistent after undo/redo
- UI doesn't reflect status correctly after transitions

This is a **verification task** — confirms status transitions work as designed and catches any edge cases.

## Scope

### Status Values

Current status field values (from defaults):
```typescript
STATUSES: ["Inbox", "Active", "In Progress", "Blocked", "Complete"]
```

### Status Transitions (Expected Behavior)

1. **Mark Complete**: any status → `Complete`
   - Sets `status: "Complete"`
   - Sets `status_changed: now()`
   - Sets `is_complete: true` (derived)
   - UI hides task from non-complete views
   - Related tasks (depends_on, blocks) may be affected

2. **Mark Incomplete/Uncomplete**: `Complete` → previous status (or `Active`)
   - Sets `status: Active` or restored previous status
   - Updates `status_changed: now()`
   - Sets `is_complete: false` (derived)
   - Task reappears in active views

3. **Other Status Transitions**: Active ↔ In Progress ↔ Blocked
   - Should not affect `is_complete`
   - Should not hide task from views
   - Should work without issues

### Edge Cases to Check

1. **Complete → In Progress → Complete** — does complete work after intermediate status change?
2. **Complete → Uncomplete → status changed immediately** — does status persist correctly?
3. **Multiple tasks in depends_on** — does uncompleting one affect blocking relationships?
4. **Blocked task completed** — what happens to "blocks" relationships?
5. **Archived/deleted tasks** — do not have status cycle

## Acceptance Criteria

### Functionality
- [ ] Click "Complete" button → task status becomes "Complete"
- [ ] After refresh, task is still "Complete"
- [ ] Click "Uncomplete" button → task status changes back to previous (or Active)
- [ ] After refresh, task is "Active" (or previous status)
- [ ] Derived `is_complete` field matches UI state (true when Complete, false otherwise)
- [ ] Task appears/disappears from filtered views correctly based on status

### Status Transitions
- [ ] Inbox → Complete → Active (full cycle works)
- [ ] In Progress → Complete → In Progress (restore previous works)
- [ ] Active → In Progress → Complete → Active (multi-step cycle works)
- [ ] Blocked → Complete → Active (blocked can be completed)

### Edge Cases
- [ ] Complete task depends on Active task; uncomplete it — no errors, status is Active
- [ ] Active task blocks Complete task; uncomplete blocker — no errors
- [ ] Complete task with multiple dependencies — uncomplete works
- [ ] Complete task; immediately change to In Progress without uncompleting — status is In Progress

### Related Updates
- [ ] Task relationships (depends_on, blocks) still valid after status changes
- [ ] Recurrence triggers correctly when task marked Complete (if applicable)
- [ ] Status change is auditable (status_changed timestamp updates)
- [ ] No TypeScript errors

## Verification

### Manual Test Steps

1. **Create task, mark complete**:
   - Create task "Test Complete"
   - Click "Complete" button (or menu action)
   - Verify status badge shows "Complete"
   - Refresh page; verify status persists

2. **Uncomplete task**:
   - Same task, click "Uncomplete" or reopen status menu
   - Verify status changes to "Active" (or previous status)
   - Refresh page; verify status persists

3. **Multiple status transitions**:
   - Create task
   - Status: Inbox → Active → In Progress → Complete
   - Uncomplete: Complete → Active
   - Verify no errors at each step

4. **Check is_complete derived field**:
   - Open task detail (developer console or inspector)
   - Verify `task.is_complete === true` when status is "Complete"
   - Mark uncomplete; verify `task.is_complete === false`

5. **Test with dependencies**:
   - Create Task A (Active)
   - Create Task B (depends_on: [A.id])
   - Mark A as Complete
   - Verify B is not affected (still shows dependency)
   - Uncomplete A
   - Verify relationship still works

6. **Test with blocks**:
   - Create Task A (Active)
   - Create Task B (A.blocks B)
   - Mark A as Complete
   - Verify B still shows as blocked by A (or updates correctly)
   - Uncomplete A
   - Verify blocks relationship works

### Automated Test Cases (if adding tests)

- `status.complete()` → status becomes "Complete", is_complete true
- `status.uncomplete()` → status becomes previous, is_complete false
- `status.transition("In Progress")` → on complete task → status changes, no error
- `complete → uncomplete → complete` → triple cycle works
- `update({ status: "Complete" })` → is_complete derived field updates

## Time Estimate

1.5–2 hours (manual verification of all scenarios, possible bug fixes if issues found)

## Implementation Notes

### Where to Look

1. **Quick action handlers** (likely in TaskDetailQuickActions.svelte or main.ts):
   - Search for: `Complete`, `Uncomplete`, status button handlers
   - Look for: update call with `status: "Complete"`

2. **Derived field logic** (src/types.ts):
   - Find: `is_complete` getter or computed field
   - Verify: `is_complete = status === "Complete"`

3. **Status change audit** (TaskStore.ts):
   - Find: where `status_changed` is set
   - Verify: updates whenever status changes

4. **Filtering logic** (views and queries):
   - Search for: `is_complete` filters
   - Verify: filters exclude completed tasks (or include them in "All" views)

5. **Relationships validation** (TaskRelationships A3):
   - Verify: completing/uncompleting task doesn't break depends_on/blocks
   - Check: sanitizeDependencies handles complete tasks correctly

### Verification Approach

1. **Manual walkthrough**: follow test steps above, document any issues
2. **Code inspection**: verify derived field logic, status update handlers
3. **Edge case testing**: run all 5+ edge cases listed above
4. **Document findings**: record any bugs found → escalate to dev

### If Bugs Found

- Create separate GitHub issues or inline notes in code
- Don't fix in this session; escalate after verification
- Prioritize: does uncomplete work? (critical)

## Gotchas

### Restore Previous Status

When uncompleting, should restore previous status or always set to "Active"?

**Current design**: Check if previous status is stored (before setting Complete). If not, default to "Active".

**Check**: Does code store previous status? If not, add `previous_status` field or just default to "Active".

### Recurrence on Complete

If task has recurrence rule, completing it may create a new task (depends on settings).

**Check**: Does recurrence logic trigger correctly? Does new task have same parent_task?

### Blocked vs Blocking

- If Task B depends on Task A, and A is complete, should B auto-complete? (No — B just waits)
- If Task A blocks Task B, and A is complete, should B unlock? (Depends on design; verify)

**Current assumption**: Completing a blocking task doesn't unlock dependents automatically; user must manually update.

## Dependencies

- **Can run with**: B1, B2, B3, B4, B5 (independent bug verification)
- **Blocks**: Nothing

## Related Issues

- Status transitions may have silent failures
- is_complete derived field may be out of sync
- Uncomplete feature may not work as expected
- Edge cases untested in production

---

## Test Checklist

Use this checklist during manual verification:

- [ ] Complete task → status is "Complete"
- [ ] Uncomplete task → status is "Active" (or previous)
- [ ] Derived is_complete is true/false correctly
- [ ] Task appears/disappears from views
- [ ] Multiple transitions work without errors
- [ ] Dependencies not affected by status change
- [ ] No console errors during transitions
- [ ] status_changed timestamp updates
- [ ] All 5+ edge cases pass without issues
