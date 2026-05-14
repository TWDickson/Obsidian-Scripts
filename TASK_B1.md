---
name: "B1: Fix Due Date Estimation clear button"
description: Fix clearing estimated_days field via clear button in task detail
type: bug
---

# B1: Fix Due Date Estimation clear button

## Issue

Clicking the "Clear" button on the estimated_days field doesn't clear the value. The UI shows it as cleared, but the field retains its value in storage and re-appears after refresh.

## Root Cause

The clear button's click handler is not properly updating the task via `taskStore.update()`. Likely missing: `estimated_days: null` in the update payload.

## Fix

**Location**: `src/components/TaskDetailDatesPanel.svelte` (after A7) or current `TaskDetail.svelte`

**Change**: Ensure clear button calls taskStore update with `estimated_days: null`

```typescript
// Before (likely wrong):
onClearEstimatedDays() {
  // Maybe just clearing UI state, not updating store
  localState.estimated_days = null;
}

// After (correct):
async onClearEstimatedDays() {
  await taskStore.writer.update(task.id, { estimated_days: null });
}
```

## Acceptance Criteria

- [ ] Click "Clear" on estimated_days field
- [ ] Value clears in UI immediately
- [ ] After refresh, field is still cleared
- [ ] Task update event fires (can verify in console)
- [ ] No TypeScript errors

## Verification

1. Create task with estimated_days = 5
2. Open task detail
3. Click "Clear" button next to estimated_days
4. Verify field is empty in UI
5. Refresh page (F5)
6. Re-open task detail
7. Verify estimated_days is still empty (not 5)

## Time Estimate

30 minutes (quick fix once location is confirmed)

## Notes

- Check both TaskDetail.svelte (current) and TaskDetailDatesPanel.svelte (after A7)
- Verify other clear buttons (clear due date, clear start date) don't have same issue
- Consider adding inline comment explaining `null` is used to clear the field
