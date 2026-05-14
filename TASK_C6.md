---
name: "C6: Archive migration — migrate existing completed tasks"
description: One-time migration to move existing completed tasks to archive and populate logs
type: feature
---

# C6: Archive migration — migrate existing completed tasks

## Goal

One-time migration script to archive all existing completed tasks and populate archive history log. Runs once on plugin upgrade/first use.

## Scope

*Final archive phase. Assumes C2–C5 implemented. This is one-time setup.*

### Current State (After C5)

- Archive infrastructure complete
- Archive/restore/logging all work
- But: existing completed tasks still in `Planner/Tasks/` (not archived)
- Archive history is empty for old tasks

### What to Create

**Archive Migration Command**:
- Scans all tasks in `Planner/Tasks/`
- Finds completed tasks (status: "Complete")
- Moves them to `Planner/Archive/{year}/{month}/`
- Adds `archive_history` entry (reason: "migration-import")
- Runs once on plugin version upgrade
- Can be manually triggered via "Run Archive Migration" command

**Migration Logic**:
```typescript
async function runArchiveMigration(app: App) {
  const tasks = queryAllTasks(app);
  let movedCount = 0;
  let skippedCount = 0;
  
  for (const task of tasks) {
    if (task.status !== "Complete") continue;
    
    // Move task to archive
    const file = await getTaskFile(app, task);
    const archivePath = getArchivePath(task);
    await app.fileManager.renameFile(file, archivePath);
    
    // Add archive history entry
    await logArchiveAction(app, task, "archived", "migration-import", {
      notes: "Migrated from Planner/Tasks during archive setup"
    });
    
    movedCount++;
  }
  
  return { movedCount, skippedCount };
}
```

## Acceptance Criteria

### Migration Execution
- [ ] Migration command available: "Archive: Run Migration"
- [ ] Can be triggered manually (for testing)
- [ ] Runs automatically on first plugin load (version check)
- [ ] Reports progress: "Migrating 42 completed tasks..."

### Task Movement
- [ ] All completed tasks moved to Archive folder
- [ ] Tasks organized: `Archive/{year}/{month}/`
- [ ] No tasks left behind (double-check)
- [ ] Task paths updated in index
- [ ] Bilinks still work (path updated in Obsidian cache)

### Archive History
- [ ] Each migrated task has `archive_history` entry
- [ ] Entry shows: action: "archived", reason: "migration-import"
- [ ] Timestamp is current (migration date, not original completion date)
- [ ] Optional: notes field mentions "Migrated during archive setup"

### Safety & Undo
- [ ] Dry-run mode (preview what will be migrated without moving)
- [ ] User can undo migration (Ctrl+Z, or re-run with restore mode)
- [ ] Backup created before migration (optional)
- [ ] No data loss

### Verification After Migration
- [ ] Active views no longer show completed tasks (they're archived)
- [ ] Archive view shows all migrated tasks
- [ ] Search: "Show archive" toggle returns migrated tasks
- [ ] Logbook shows migration entries
- [ ] No broken bilinks
- [ ] No TypeScript errors

### No Regressions
- [ ] Existing active/in-progress tasks untouched
- [ ] Dependencies (depends_on, blocks) still work
- [ ] Recurring tasks not affected
- [ ] Tasks marked incomplete still in active views

## Verification

1. **Pre-migration state**:
   - Verify active views show completed tasks
   - Count completed tasks (note this number)

2. **Run migration**:
   - Open command palette: "Archive: Run Migration"
   - Confirm dialog: "Migrate X completed tasks to archive?"
   - Click "Confirm" → migration runs

3. **Progress**:
   - See notification: "Migrating 42 completed tasks..."
   - Notification updates: "25 done, 17 remaining..."
   - Final: "Migration complete: 42 tasks archived"

4. **Post-migration state**:
   - Active views no longer show completed tasks
   - Archive view shows all 42 migrated tasks
   - Click task in archive → see archive history entry
   - Search: enable "Show archive" → migrated tasks appear

5. **Integrity check**:
   - Create task that depends on archived task → still works
   - Create task blocked by archived task → still shows relationship
   - Click bilink in active task → opens archived task correctly
   - Undo (Ctrl+Z) → tasks move back to Planner/Tasks

6. **Edge cases**:
   - Tasks with no `status_changed` field → migrated anyway
   - Tasks with dependencies → migrated, relationships preserved
   - Recurring completed tasks → migrated, recurrence still works
   - Subtasks (if applicable) → migrated with parent

## Time Estimate

1–1.5 hours (migration logic, dry-run, safety checks, undo handling)

## Implementation Notes

### Where to Look

1. **Version checking** (src/main.ts):
   - Check plugin version on load
   - Compare with last migration version in settings
   - If new version, trigger migration

2. **Migration command** (src/commands.ts or main.ts):
   - Register command: `id: "archive-migration", name: "Archive: Run Migration"`
   - Callback: `runArchiveMigration(app, settings)`

3. **Task query** (src/store/TaskStore.ts or query engine):
   - Function: `queryAllTasksInFolder(app, "Planner/Tasks")`
   - Returns all tasks (including completed)

4. **File operations** (Obsidian API):
   - `app.fileManager.renameFile(file, newPath)` — move task
   - `app.fileManager.processFrontMatter(file, fm => ...)` — update frontmatter

### Implementation Order

1. **Create migration function**:
   ```typescript
   async function runArchiveMigration(app: App, settings: Settings) {
     const allTasks = await queryAllTasksInFolder(app, "Planner/Tasks");
     const completedTasks = allTasks.filter(t => t.status === "Complete");
     
     let movedCount = 0;
     const results = [];
     
     for (const task of completedTasks) {
       try {
         // Move file
         const file = app.vault.getAbstractFileByPath(task.path);
         const archivePath = getArchivePath(task);
         await app.fileManager.renameFile(file, archivePath);
         
         // Log action
         await logArchiveAction(app, task, "archived", "migration-import");
         
         movedCount++;
         results.push({ success: true, task: task.name });
       } catch (err) {
         results.push({ success: false, task: task.name, error: err.message });
       }
     }
     
     return { movedCount, total: completedTasks.length, results };
   }
   ```

2. **Add version tracking** (in settings):
   ```typescript
   interface Settings {
     ...
     lastMigrationVersion?: string; // e.g., "0.5.0"
   }
   ```

3. **Register migration command**:
   ```typescript
   // In main.ts
   this.addCommand({
     id: "archive-migration",
     name: "Archive: Run Migration",
     callback: async () => {
       const result = await runArchiveMigration(this.app, this.settings);
       new Notice(`Archived ${result.movedCount} tasks`);
     }
   });
   ```

4. **Auto-trigger on upgrade**:
   ```typescript
   // In main.ts onload()
   const currentVersion = this.manifest.version;
   if (!this.settings.lastMigrationVersion || 
       this.settings.lastMigrationVersion < "0.5.0") {
     // Run migration
     const result = await runArchiveMigration(this.app, this.settings);
     this.settings.lastMigrationVersion = currentVersion;
     await this.saveSettings();
     new Notice(`Migration complete: ${result.movedCount} tasks archived`);
   }
   ```

5. **Add dry-run mode** (optional):
   ```typescript
   async function runArchiveMigration(app: App, settings: Settings, dryRun = false) {
     // ... existing code ...
     
     if (dryRun) {
       return { movedCount: 0, total: completedTasks.length, results, dryRun: true };
     }
     
     // ... perform actual migration ...
   }
   ```

6. **Undo handling**:
   - Obsidian's native undo (Ctrl+Z) should handle file moves
   - Test: run migration, Ctrl+Z multiple times, verify tasks return to Planner/Tasks

7. **Test**:
   - Create 10 completed tasks
   - Run migration command
   - Verify all moved to Archive
   - Verify archive history populated
   - Verify bilinks work
   - Test undo

## Gotchas

### Order of Operations

If moving file before logging:
- File moves to Archive path
- Then log action tries to update task.path (now stale)

**Solution**: Capture task object before move, then log using new path.

### Obsidian Cache Update

When files are moved, Obsidian may take time to update its cache.

**Solution**: After migration, manually trigger cache refresh or wait a moment before operations.

```typescript
// After moving files, wait for cache to update
await new Promise(resolve => setTimeout(resolve, 500));
```

### Broken Bilinks

If task is moved but bilinks in other notes reference old path:

**Solution**: Obsidian auto-updates these in most cases. Test by:
1. Create task A in Planner/Tasks
2. Create task B with bilink to A: `[[path|Name]]`
3. Migrate A to Archive
4. Open B, click bilink → should still open A (in Archive)

If broken, manual re-indexing may be needed (rare).

### Subtasks/Nested Tasks

If tasks can be nested (subtasks):
- Don't migrate parent until all children migrated
- Or migrate entire tree together

**Solution**: Sort tasks by depth before migrating.

### Very Large Archives

If 1000+ tasks being migrated:
- Show progress bar (every 100 tasks, update UI)
- Batch operations (migrate 50 at a time, delay between batches)

**Solution**: Use `for...of` loop with periodic UI updates.

## Dependencies

- **C2 (archive folder)** — required
- **C3 (auto-archive)** — not required, but migration coexists
- **C4 (archive view)** — not required, but good to have for verification
- **C5 (logbook)** — not required, but populates logbook
- **All prior tasks complete** — this is final integration

## Related Issues

- Completed tasks accumulated in active views
- Need one-time migration to clean up
- Archive setup is incomplete until migration runs

---

## Migration Checklist

- [ ] Dry-run works (shows what will migrate, doesn't move files)
- [ ] Actual migration runs without errors
- [ ] All completed tasks moved to Archive folder
- [ ] Archive history populated for each task
- [ ] Bilinks still work after migration
- [ ] Active views no longer show migrated tasks
- [ ] Archive view shows all migrated tasks
- [ ] Undo (Ctrl+Z) restores tasks to Planner/Tasks
- [ ] No data loss or broken relationships
- [ ] User notified of migration progress
- [ ] Settings updated with migration version
