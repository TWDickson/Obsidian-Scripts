---
name: "C3: Auto-archive logic — scheduled and manual triggers"
description: Implement automatic or manual task archiving based on completion time and settings
type: feature
---

# C3: Auto-archive logic — scheduled and manual triggers

## Goal

Implement configurable archive triggers so users can choose when completed tasks move to archive (manual, immediate, or scheduled).

## Scope

*Builds on C2 (archive folder structure). Assumes Hybrid Option C from C1.*

### Current State (After C2)

- Archive folder structure exists
- Archive/restore actions implemented
- All archiving is manual (users click "Archive" button)

### What to Create

**Archive Trigger Options** (in settings):

```typescript
type ArchiveMode = "manual" | "immediate" | "scheduled";

interface ArchiveSettings {
  mode: ArchiveMode;                    // "manual" (default) | "immediate" | "scheduled"
  autoArchiveDaysAfterComplete?: number; // if "scheduled", archive after N days
}
```

**Trigger Implementations**:

1. **Manual** (default):
   - Archive button on task detail
   - User clicks → immediate archive
   - No auto-behavior

2. **Immediate**:
   - When task status changes to "Complete", auto-archive immediately
   - File moves to Archive folder automatically
   - User can still restore if needed

3. **Scheduled**:
   - When task marked complete, set timer
   - After N days (default 30), auto-archive
   - Task remains in active views for N days after completion
   - User can manually archive sooner if desired

**Archive Eligibility Checks**:
- [ ] Task status is "Complete"
- [ ] Task is not blocking any active tasks (optional safety check)
- [ ] Task is not depended-on by active tasks (optional safety check)
- [ ] Task is not in "Protected" list (optional user setting)

## Acceptance Criteria

### Manual Mode
- [ ] "Archive" button available on completed tasks
- [ ] Click → archives immediately
- [ ] No auto-behavior

### Immediate Mode
- [ ] Setting "Archive mode: Immediate" exists
- [ ] Mark task complete → auto-archives immediately
- [ ] No user action required
- [ ] Task disappears from active views
- [ ] Can still restore if needed

### Scheduled Mode
- [ ] Setting "Archive mode: Scheduled" + "Days: N" exists
- [ ] Mark task complete → stays in active views for N days
- [ ] After N days → auto-archive (background job or cron)
- [ ] Task reappears in Archive view after N days
- [ ] User can override: manually archive sooner

### Safety Checks
- [ ] If eligible check enabled: don't auto-archive if task blocks active tasks
- [ ] If eligible check enabled: don't auto-archive if active task depends on it
- [ ] Log warnings if auto-archive blocked (user sees notification)

### UI Updates
- [ ] Settings tab shows archive mode + days option
- [ ] Task detail shows when auto-archive will occur (if scheduled mode)
- [ ] Toast notification when auto-archive triggers

### No Regressions
- [ ] All existing complete/uncomplete functionality works
- [ ] Undo/redo still works on archived tasks
- [ ] No performance degradation (archive job doesn't block plugin)

## Verification

### Manual Mode
1. Set archive mode to "manual"
2. Create task, mark complete
3. Verify task doesn't auto-archive
4. Click "Archive" → archives immediately

### Immediate Mode
1. Set archive mode to "immediate"
2. Create task, mark complete
3. Task disappears from active views automatically
4. Task appears in archive view
5. Click "Restore" → task returns to active views, status is "Active"

### Scheduled Mode
1. Set archive mode to "scheduled", days = 3
2. Create task "Test Schedule"
3. Mark complete → task stays in active view
4. Wait 3 days (or simulate by changing task's `status_changed` timestamp)
5. Auto-archive triggers → task moves to archive
6. Verify notification appears

### Eligibility Checks (if enabled)
1. Create Task A (Active)
2. Create Task B (depends_on: [A.id])
3. Mark A complete → auto-archive eligible?
4. If check enabled: should NOT archive (B depends on it)
5. Verify warning: "Cannot archive: Task B depends on this"

## Time Estimate

1–1.5 hours (add settings, implement triggers, test)

## Implementation Notes

### Where to Look

1. **Settings** (src/settings/SettingsTab.ts or settings/defaults.ts):
   - Add `archiveMode: "manual" | "immediate" | "scheduled"`
   - Add `autoArchiveDaysAfterComplete: number` (default 30)
   - Add UI controls for these settings

2. **TaskStore or new ArchiveService**:
   - Hook on status change: `onTaskStatusChange(task, oldStatus, newStatus)`
   - If `newStatus === "Complete"` and `archiveMode === "immediate"`, call `archiveTask()`

3. **Background job** (for scheduled archive):
   - Periodic job (every hour or daily) that checks for tasks ready to archive
   - Query: tasks with `status: "Complete"` and `status_changed > N days ago`
   - Archive eligible tasks
   - Can use Obsidian's `registerInterval()` or similar

4. **Eligibility checks** (TaskRelationships or new helper):
   - Function: `canArchiveTask(task)` → checks if blocking/blocked
   - Called before auto-archive to decide whether to proceed

### Implementation Order

1. **Add settings**:
   ```typescript
   interface ArchiveSettings {
     mode: "manual" | "immediate" | "scheduled";
     daysAfterComplete?: number;
     checkEligibility?: boolean; // optional safety
   }
   
   // In defaults:
   archiveSettings: {
     mode: "manual",
     daysAfterComplete: 30,
     checkEligibility: false
   }
   ```

2. **Immediate mode handler**:
   ```typescript
   // In TaskStore, when status changes to "Complete":
   async onTaskStatusChange(task, oldStatus, newStatus) {
     if (newStatus === "Complete" && settings.archiveSettings.mode === "immediate") {
       await archiveTask(task);
     }
   }
   ```

3. **Scheduled mode job**:
   ```typescript
   // In plugin setup:
   registerInterval(window.setInterval(async () => {
     await checkAndArchiveScheduledTasks();
   }, 1000 * 60 * 60)); // hourly
   
   async function checkAndArchiveScheduledTasks() {
     const completedTasks = tasks.filter(t => t.status === "Complete");
     const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
     
     for (const task of completedTasks) {
       if (new Date(task.status_changed) < cutoffDate) {
         if (canArchiveTask(task)) {
           await archiveTask(task);
         }
       }
     }
   }
   ```

4. **Eligibility check** (optional):
   ```typescript
   function canArchiveTask(task: Task): boolean {
     if (!settings.archiveSettings.checkEligibility) return true;
     
     // Check if any active task depends on this
     const activeDependents = allTasks.filter(t =>
       t.status !== "Complete" && t.depends_on?.includes(task.id)
     );
     
     if (activeDependents.length > 0) {
       new Notice(`Cannot archive: ${activeDependents[0].name} depends on this`);
       return false;
     }
     
     return true;
   }
   ```

5. **Settings UI**:
   - Add dropdown: "Archive mode"
   - Add number field: "Archive after N days" (visible only if mode is "scheduled")
   - Add checkbox: "Eligibility checks" (if enabled, prevent archiving blocking tasks)

6. **Task detail UI**:
   - Show scheduled archive time (if mode is "scheduled")
   - Example: "Will auto-archive on 2026-06-12" (N days from completion)

7. **Test**:
   - Switch modes, verify behavior
   - Scheduled: fake complete time, verify archive triggers
   - Eligibility: create dependencies, verify block on auto-archive

## Gotchas

### Time Zone Issues

`status_changed` is stored as ISO string. Ensure date comparison uses same timezone.

**Solution**: Use UTC timestamps consistently. `new Date().toISOString()` is always UTC.

### Job Frequency

Running archive check too frequently wastes CPU. Too infrequently misses tasks.

**Recommendation**: Hourly (`1000 * 60 * 60` ms) is reasonable balance. Can be configurable.

### Race Condition

If user marks task complete and immediately clicks Archive before auto-archive triggers:
- First: user clicks Archive → file moves to Archive
- Then: background job runs, tries to archive same task → file not found error

**Solution**: Catch "file not found" error in archive function; silently skip if file moved.

### Notification Spam

If auto-archive triggers frequently, user gets many notifications.

**Solution**: Only show notification if user has scheduled mode enabled + eligibility blocked. Manual/immediate don't need notification (clear UI action).

## Dependencies

- **C2 (archive folder)** — must be implemented first
- **Can run with**: C4, C5 (independent features)
- **Blocks**: C6 (migration depends on archive behavior)

## Related Issues

- Users want automatic archive (don't want to click each time)
- Scheduled archive preserves short-term history (30 days common)
- Safety checks prevent archiving tasks that are still needed
