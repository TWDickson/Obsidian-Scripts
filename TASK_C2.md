---
name: "C2: Archive folder setup + bulk archive action"
description: Create archive folder structure and implement archive/restore actions for tasks
type: feature
---

# C2: Archive folder setup + bulk archive action

## Goal

Set up archive folder structure (`Planner/Archive/`) and implement archive/restore actions so users can move completed tasks to archive.

## Scope

*Assumes Option C (Hybrid) chosen in C1. Adjust for Option A/B if needed.*

### Current State

- Completed tasks remain in `Planner/Tasks/` folder (active views list them)
- No archive folder structure
- No archive action on tasks

### What to Create

**Archive Folder Structure** (if Option A or C):
```
Planner/
├── Tasks/
│   └── {active tasks}
└── Archive/
    └── {year}/
        └── {month}/
            └── {id}-{slug}.md (archived tasks)
```

Example:
```
Planner/Archive/2026/05/{abc123-task-name}.md
```

**Archive Action** (Command + UI):
1. User selects task (or bulk-selects multiple)
2. Clicks "Archive" button (or context menu)
3. Task file moves: `Planner/Tasks/` → `Planner/Archive/2026/05/`
4. Task remains in index (still searchable, still has links)
5. Task removed from active views (queries skip archive folder)

**Restore Action**:
1. User browses archive or runs "Restore" on archived task
2. Clicks "Restore" 
3. Task file moves back: `Planner/Archive/...` → `Planner/Tasks/`
4. Status changed back to previous (or "Active")
5. Task reappears in active views

## Acceptance Criteria

### Folder Structure
- [ ] `Planner/Archive/` folder exists
- [ ] Nested: `Archive/{year}/{month}/` created on first archive
- [ ] Old archives can be manually deleted/moved without breaking links

### Archive Action
- [ ] "Archive" button available on completed tasks
- [ ] Click → task file moves to Archive folder
- [ ] Archived task has path: `Archive/2026/05/{id}-{slug}.md`
- [ ] Task no longer appears in active views
- [ ] Bilinks still work (path updated)
- [ ] Status remains "Complete" (or changed to "Archived" if Option B)

### Restore Action
- [ ] "Restore" button available on archived tasks
- [ ] Click → task file moves back to `Planner/Tasks/`
- [ ] Status changed to "Active" (or previous status)
- [ ] Task reappears in active views
- [ ] Bilinks updated

### Bulk Archive
- [ ] Can select multiple completed tasks
- [ ] "Archive all" action moves all to Archive folder
- [ ] No errors for large batches (100+ tasks)

### View Filtering
- [ ] Active views query excludes `Archive/` folder
- [ ] Search by default excludes archive (toggle to include)
- [ ] Archive view exists (browse archived tasks by date/name)

### Permissions & Undo
- [ ] No TypeScript errors
- [ ] User can undo archive (Obsidian Ctrl+Z)
- [ ] Archived tasks can be restored one-by-one or bulk

## Verification

1. **Set up folder**:
   - Create `Planner/Archive/` folder manually or via migration
   - Verify no errors in file explorer

2. **Archive single task**:
   - Create task, mark complete
   - Click "Archive" → file moves to `Archive/2026/05/`
   - Verify task disappears from active views
   - Verify task appears in archive view
   - Verify bilinks still resolve (path in Obsidian cache updates)

3. **Restore task**:
   - Open archived task, click "Restore"
   - File moves back to `Planner/Tasks/`
   - Task reappears in active views
   - Status is "Active"

4. **Bulk archive**:
   - Create 5 completed tasks
   - Select all, click "Archive all"
   - All move to Archive folder
   - All disappear from active views

5. **Search toggle**:
   - Search for task name
   - Default: returns active task only
   - Toggle "include archive" → returns both active and archived
   - Toggle off → returns active only

## Time Estimate

1–1.5 hours (folder setup, archive/restore handlers, view filters, test)

## Implementation Notes

### Where to Look

1. **Vault file operations** (Obsidian API):
   - `app.vault.getAbstractFileByPath(path)` — get file
   - `app.fileManager.renameFile(file, newPath)` — move file to new path
   - `app.vault.createFolder(path)` — create Archive folder

2. **Archive/Restore logic** (likely in TaskStore.ts or new ArchiveService):
   - Function: `archiveTask(taskId)` → moves file, updates status
   - Function: `restoreTask(taskId)` → moves file back
   - Function: `getArchivePath(task, year?, month?)` → returns target path

3. **View filtering** (viewRegistry, TaskList queries):
   - Exclude `Archive/` from active queries
   - Add search toggle: `includeArchive: boolean` in QuerySpec

4. **UI buttons** (TaskDetailQuickActions):
   - Add "Archive" button (visible when status is "Complete")
   - Add "Restore" button (visible when task is in Archive folder)

### Implementation Order

1. **Create archive folder structure**:
   ```typescript
   async function ensureArchiveFolderExists(app: App) {
     const archiveFolder = 'Planner/Archive';
     const folder = app.vault.getAbstractFileByPath(archiveFolder);
     if (!folder) {
       await app.vault.createFolder(archiveFolder);
     }
   }
   ```

2. **Archive action**:
   ```typescript
   async function archiveTask(app: App, task: Task) {
     const file = app.vault.getAbstractFileByPath(task.path);
     if (!file || !(file instanceof TFile)) return;
     
     const now = new Date();
     const year = now.getFullYear();
     const month = String(now.getMonth() + 1).padStart(2, '0');
     
     const archivePath = `Planner/Archive/${year}/${month}/${file.name}`;
     
     // Ensure folder exists
     const archiveDir = archivePath.substring(0, archivePath.lastIndexOf('/'));
     await app.vault.createFolder(archiveDir).catch(() => {});
     
     // Move file
     await app.fileManager.renameFile(file, archivePath);
     
     // Update task status (optional, if not already complete)
     // Could also set status: "Archived" instead of keeping "Complete"
   }
   ```

3. **Restore action**:
   ```typescript
   async function restoreTask(app: App, task: Task) {
     const file = app.vault.getAbstractFileByPath(task.path);
     if (!file || !(file instanceof TFile)) return;
     
     const newPath = `Planner/Tasks/${file.name}`;
     await app.fileManager.renameFile(file, newPath);
     
     // Update status to Active
     await app.fileManager.processFrontMatter(file, fm => {
       fm.status = "Active";
     });
   }
   ```

4. **Update view queries**:
   - Modify all active task queries to exclude Archive folder
   - Pattern: `path != "Planner/Archive"` or folder filter

5. **Add UI buttons**:
   - TaskDetailQuickActions: add Archive/Restore buttons
   - Condition: show Archive if `status === "Complete" && path in "Planner/Tasks"`
   - Condition: show Restore if `path in "Planner/Archive"`

6. **Test**:
   - Archive task → file moves, no errors, disappears from active views
   - Restore task → file moves back, reappears, status is Active
   - Bulk archive 10 tasks → all move to Archive
   - Search toggle works → include/exclude archive

## Gotchas

### Bilink Path Updates

When task file moves, Obsidian updates the path in its cache. However:
- Old path in other notes' bilinks may still reference old location
- Solution: Obsidian auto-updates cache; no manual intervention needed
- Verify: Click bilink in active task → still resolves to archived task (should work)

### Circular Moves

If user restores task then immediately archives again:
- First restore: Archive/2026/05/task.md → Planner/Tasks/task.md
- Second archive: Planner/Tasks/task.md → Archive/2026/05/task.md (again)
- Should work fine; no duplicates

### Archive Folder Cleanup

Old archives accumulate. Recommendations:
- Document process: user can manually delete `Archive/2020/`, `Archive/2021/` if needed
- Optional: add "Purge archives older than N years" in future

### Status Field Consistency

If using Option B/C (status-based archive), need to decide:
- Archive set: `status: "Complete"` (just moved) OR `status: "Archived"` (new)?
- Recommendation: keep `status: "Complete"`, folder location is the archive marker

## Dependencies

- **C1 decision** — strategy must be chosen first
- **Can run with**: C3, C4, C5 (independent archive features)
- **Blocks**: C6 (migration depends on archive infrastructure)

## Related Issues

- Completed tasks clutter active views
- No way to organize historical tasks
- Archive folder structure needed for scalability
