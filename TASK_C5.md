---
name: "C5: Archive logbook — audit trail of archive/restore actions"
description: Create audit log tracking when tasks are archived, restored, or modified in archive
type: feature
---

# C5: Archive logbook — audit trail of archive/restore actions

## Goal

Maintain audit trail of all archive/restore operations so users can track when and why tasks were archived.

## Scope

*Builds on C2–C4. Adds logging/audit functionality.*

### Current State (After C4)

- Archive/restore works
- Archive view exists
- No logging of archive operations

### What to Create

**Archive Logbook** (per-task audit trail):
- Records each archive/restore action
- Stored in task frontmatter: `archive_history: [{action, date, reason}]`
- Displayed in task detail (read-only log)

**Archive Logbook View** (system-wide log):
- Timeline of all archive/restore operations
- Shows: task name, action (archive/restore), date, reason
- Filter by date range, task, action
- Export as CSV/report

**Archive Log Schema**:
```typescript
interface ArchiveLogEntry {
  action: "archived" | "restored";
  date: string; // ISO timestamp
  reason?: string; // "manual", "auto-immediate", "auto-scheduled-30d", etc.
  restoredBy?: string; // user action vs auto
  notes?: string; // optional user notes
}

// In task frontmatter:
archive_history: [
  { action: "archived", date: "2026-05-20T10:30:00Z", reason: "manual" },
  { action: "restored", date: "2026-05-21T14:15:00Z", reason: "user override" }
]
```

## Acceptance Criteria

### Per-Task Log
- [ ] Task frontmatter includes `archive_history` array
- [ ] Each archive/restore action recorded with timestamp
- [ ] Archive reason captured ("manual", "immediate", "scheduled-30d")
- [ ] Task detail shows archive history (read-only)
- [ ] Can export task's archive history

### System Logbook View
- [ ] New "Logbook" view shows all archive operations
- [ ] Timeline sorted by date (newest first)
- [ ] Shows: task name, action, date, reason
- [ ] Filter by: date range, task name, action type, reason
- [ ] Search across logbook
- [ ] Bulk export selected entries as CSV

### Statistics
- [ ] Total tasks archived (ever)
- [ ] Tasks archived this month/year
- [ ] Most common archive reason
- [ ] Restore rate (% of archived tasks restored)

### No Regressions
- [ ] Archive/restore still works
- [ ] Performance not degraded by logging
- [ ] Existing tasks without `archive_history` handled gracefully

## Verification

1. **Log on archive**:
   - Create task, mark complete, archive
   - Check task frontmatter: `archive_history` exists with entry
   - Entry shows: action: "archived", date, reason: "manual"

2. **Log on restore**:
   - Restore task
   - Check frontmatter: new entry added, action: "restored"

3. **Task detail display**:
   - Open archived task
   - View tab shows archive history (read-only)
   - Displays each entry: "Archived on 2026-05-20 (manual)", "Restored on 2026-05-21"

4. **Logbook view**:
   - Open Logbook view
   - Shows all archive/restore operations for all tasks
   - Timeline sorted by date

5. **Filter**:
   - Filter by "last 7 days"
   - Show only "archived" actions
   - Show only "manual" reason
   - Verify filtering works

6. **Statistics**:
   - "18 tasks archived in May 2026"
   - "3 tasks (16%) restored in May"
   - "Most common reason: auto-scheduled-30d (12 tasks)"

## Time Estimate

1–1.5 hours (logging logic, display in task detail, logbook view, filtering)

## Implementation Notes

### Where to Look

1. **Archive/restore functions** (C2):
   - Add logging before/after file operations
   - Pattern: `logArchiveAction(task, "archived", "manual")`

2. **Task frontmatter** (TaskStore):
   - `archive_history` is array field (new)
   - May need migration to add to existing tasks (handled in C6)

3. **Task detail display** (TaskDetailViewMode or new component):
   - Add "Archive History" section (expandable)
   - Show read-only log entries

4. **Logbook view** (new component, similar to C4 archive view):
   - Query all tasks with non-empty `archive_history`
   - Build timeline of entries
   - Display with filters

### Implementation Order

1. **Add logging function**:
   ```typescript
   async function logArchiveAction(
     app: App,
     task: Task,
     action: "archived" | "restored",
     reason: string
   ) {
     const file = app.vault.getAbstractFileByPath(task.path);
     if (!file || !(file instanceof TFile)) return;
     
     const entry: ArchiveLogEntry = {
       action,
       date: new Date().toISOString(),
       reason
     };
     
     await app.fileManager.processFrontMatter(file, fm => {
       if (!fm.archive_history) fm.archive_history = [];
       fm.archive_history.push(entry);
     });
   }
   ```

2. **Update archive/restore** (in C2 functions):
   ```typescript
   async function archiveTask(app: App, task: Task) {
     // ... existing code ...
     
     // After file moved, log action
     await logArchiveAction(app, task, "archived", "manual");
   }
   
   async function restoreTask(app: App, task: Task) {
     // ... existing code ...
     
     // After file moved, log action
     await logArchiveAction(app, task, "restored", "user override");
   }
   
   // In C3 auto-archive:
   await logArchiveAction(app, task, "archived", "auto-immediate");
   // or
   await logArchiveAction(app, task, "archived", "auto-scheduled-30d");
   ```

3. **Display in task detail**:
   - Add section: "Archive History" (only if `archive_history.length > 0`)
   - Show table: Date | Action | Reason
   - Example: "2026-05-20 | Archived | manual"

4. **Create Logbook view**:
   ```typescript
   // src/views/TaskLogbookView.svelte
   // Query: all tasks with archive_history
   // Display: timeline of entries
   // Filter: date, action, reason, task name
   ```

5. **Add filtering**:
   - Date range picker (last 7/30/90 days, custom range)
   - Action dropdown (archived, restored, both)
   - Reason filter (manual, auto-immediate, etc.)

6. **Export**:
   - Button: "Export CSV"
   - Columns: Date, Action, Task, Reason
   - Can filter before export

7. **Statistics**:
   - Dashboard card: "Archive Stats"
   - Show: total archived, this month, restore rate, common reasons

8. **Test**:
   - Archive task → check frontmatter log entry
   - Restore → new entry added
   - Open logbook view → entries appear
   - Filter, search, export

## Gotchas

### Frontmatter Size

If `archive_history` grows very large (100+ entries), task frontmatter becomes bloated.

**Solution**: Cap log at last 50 entries. Delete oldest entries once limit reached.

```typescript
const MAX_LOG_SIZE = 50;
if (fm.archive_history.length > MAX_LOG_SIZE) {
  fm.archive_history = fm.archive_history.slice(-MAX_LOG_SIZE);
}
```

### Timezone Display

Log stores ISO strings (UTC). Display should convert to user's local timezone.

**Solution**: Use `toLocaleString()` when displaying dates.

```typescript
new Date(entry.date).toLocaleString()  // Converts to local time
```

### Restore Reason Naming

What reason to use when user restores a task?

**Options**: 
- "manual restore"
- "user override"
- "not ready to archive" 
- Custom reason (user input)?

**Recommendation**: "user restore" (simple, clear).

### Auto-Archive Reason

When auto-archive triggers, capture which rule triggered it:
- "auto-immediate" (immediate mode)
- "auto-scheduled-30d" (scheduled mode, 30 days)
- "auto-scheduled-60d" (if different default)

**Solution**: Pass reason parameter when calling `logArchiveAction()`.

### Performance on Large Logs

If querying thousands of tasks with large archive histories:
- Building logbook timeline could be slow
- Solution: Paginate logbook (show 100 entries per page)
- Lazy-load older entries on demand

## Dependencies

- **C2 (archive/restore)** — required for logging to work
- **C3 (auto-archive)** — optional (manual archive also logs)
- **C4 (archive view)** — optional (logbook independent)
- **Blocks**: C6 (migration may depend on logbook format)

## Related Issues

- No audit trail of archive operations
- Users can't see when/why tasks were archived
- No accountability for auto-archive decisions
- No reporting on archive activity

---

## Archive History Example

```
Task: "Refactor TaskStore"

Archive History (newest first):
1. Restored on 2026-05-21 at 14:15 (reason: user override - found a dependency)
2. Archived on 2026-05-20 at 10:30 (reason: manual)
```

## Logbook View Example

```
Archive Logbook

[Date Range: Last 30 days] [Action: All] [Reason: All] [Search...]

May 2026
├── 2026-05-21 14:15 | Restored | "Refactor TaskStore" | user override
├── 2026-05-21 10:00 | Archived | "Fix bug #42" | manual
├── 2026-05-20 23:45 | Archived | "Old feature" | auto-immediate
└── ...

April 2026
├── ...

[Export CSV] [Stats]

Stats:
- Total archived: 128
- This month: 42
- Restored: 8 (5%)
- Most common reason: auto-scheduled-30d (35 tasks)
```
