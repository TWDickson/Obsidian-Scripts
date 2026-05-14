---
name: "C4: Archive view + reporting — browse and search archived tasks"
description: Create archive-specific view showing archived tasks by date with search and reporting
type: feature
---

# C4: Archive view + reporting — browse and search archived tasks

## Goal

Create dedicated archive view so users can browse, search, and report on archived tasks.

## Scope

*Builds on C2 (archive structure), C3 (auto-archive). Creates new view for archive browsing.*

### Current State (After C3)

- Archive folder exists (`Planner/Archive/{year}/{month}/`)
- Archive/restore actions work
- Auto-archive triggers (immediate/scheduled)
- Active views exclude archive

### What to Create

**Archive View** (`src/views/TaskArchiveView.svelte` or similar):
- Browse archived tasks by date range
- Show: task name, completion date, category, archive date
- Search within archive
- Restore individual or bulk-select tasks
- Optional reporting: tasks archived by month, category, project

**Archive Queries**:
- Enhanced QuerySpec to support archive folder
- Pattern: `{ folder: "Planner/Archive", groupBy: "month", ...}`

**Archive Filters** (in Smart Lists):
- "Show Archive" toggle (include/exclude from results)
- Date range filter (archive date, completion date)
- Category/project filter (what was archived?)

## Acceptance Criteria

### Archive View (New)
- [ ] Archive view appears in view list (alongside List, Kanban, Agenda, Graph)
- [ ] Shows all archived tasks grouped by archive date (year/month)
- [ ] Each task shows: name, completion date, restore button
- [ ] Search across all archive (text input)
- [ ] Bulk select + "Restore all" action
- [ ] Displays archive statistics (total archived, by month, by category)

### Grouping Options
- [ ] Group by: Month (default)
- [ ] Group by: Completion date (when marked complete)
- [ ] Group by: Project (parent_task)
- [ ] Group by: Category
- [ ] Collapsible groups (expand/collapse by month)

### Search/Filter
- [ ] Text search: finds tasks by name
- [ ] Filter: by date range (archive date or completion date)
- [ ] Filter: by category
- [ ] Filter: by project
- [ ] Combined filters work (AND logic)

### Restore Actions
- [ ] Individual task: click "Restore" → moves to Planner/Tasks, status: Active
- [ ] Bulk restore: select multiple, click "Restore all"
- [ ] Undo works (Ctrl+Z after restore)

### Reporting (Optional)
- [ ] Summary: "X tasks archived this month"
- [ ] Chart: archived by month (bar chart)
- [ ] Chart: archived by category (pie chart)
- [ ] Export archive as CSV (name, completion date, archive date, category)

### Performance
- [ ] Archive view loads quickly (< 1s for 1000+ tasks)
- [ ] Search is responsive (no lag)
- [ ] No TypeScript errors

## Verification

1. **View appears**:
   - Open TTasks sidebar
   - Verify "Archive" view appears in view list
   - Click → archive view loads

2. **Display tasks**:
   - Archive some tasks (use C2/C3 if not already done)
   - Archive view shows all archived tasks
   - Grouped by month (default)
   - Each task shows name + completion date + restore button

3. **Search**:
   - Type in search box: "important"
   - Results filter to only archived tasks with "important" in name
   - Clear search → all archive tasks reappear

4. **Filter**:
   - Filter by date range: last 30 days
   - Restore by category: show only "Bug" category
   - Combined: show bugs archived in May

5. **Restore**:
   - Click "Restore" on archived task
   - Task moves to Planner/Tasks
   - Task reappears in active views, status: Active
   - Undo (Ctrl+Z) → task moves back to archive

6. **Bulk restore**:
   - Select 3+ archived tasks
   - Click "Restore all"
   - All move to Planner/Tasks
   - All reappear in active views

7. **Reporting** (if implemented):
   - View shows: "128 tasks archived in May 2026"
   - Chart shows archive distribution

## Time Estimate

1.5–2 hours (new view component, search/filter, bulk restore, reporting)

## Implementation Notes

### Where to Look

1. **View system** (src/views/viewRegistry.ts):
   - See how existing views (List, Kanban) are registered
   - Pattern: each has QuerySpec + component

2. **Query engine** (src/query/engine.ts):
   - Supports grouping; archive view would use `groupBy: "month"` or similar
   - May need new group function: `groupByArchiveDate(tasks)` or `groupByCompletionDate(tasks)`

3. **Smart Lists** (src/components/SmartLists.svelte or query selector):
   - Add archive view to available views
   - Add "Include Archive" toggle to query builder

### Implementation Order

1. **Create ArchiveView component**:
   ```typescript
   // src/views/TaskArchiveView.svelte
   <script>
     export let query: Writable<QuerySpec>;
     
     // Show archive tasks, grouped by month
     // Include search, filter, restore buttons
   </script>
   ```

2. **Register in view registry**:
   ```typescript
   // src/views/viewRegistry.ts
   {
     id: "archive",
     name: "Archive",
     icon: "archive",
     query: {
       filter: { folder: { contains: "Archive" } },
       group: { by: "month" },
       limit: 500
     },
     component: TaskArchiveView
   }
   ```

3. **Add grouping helper**:
   ```typescript
   function groupByArchiveMonth(tasks: Task[]): TaskGroup[] {
     // Extract year/month from task.path (Archive/2026/05/...)
     // Group tasks by month
     // Return TaskGroup[]
   }
   ```

4. **Search implementation**:
   - Add search input in view
   - Filter tasks by text: name, description, category
   - Pattern: existing list/kanban search

5. **Restore action**:
   - Add "Restore" button per task
   - Call `restoreTask()` from C2
   - Refresh view after restore

6. **Bulk restore**:
   - Add checkboxes to select multiple tasks
   - "Restore all" button
   - Loop through selected, call `restoreTask()` for each

7. **Reporting** (optional):
   - Add summary section at top: "X tasks in archive"
   - Optional: embed ChartsView chart for visualization

8. **Test**:
   - Archive 20+ tasks
   - Open archive view → all appear
   - Search, filter, restore
   - Bulk restore multiple tasks

## Gotchas

### Path Parsing

Archive path is: `Planner/Archive/2026/05/task.md`

To extract year/month:
```typescript
const parts = task.path.split('/');
const year = parts[2];
const month = parts[3];
```

### Sorting Within Groups

After grouping by month, should tasks be sorted alphabetically or by completion date?

**Recommendation**: Alphabetically (easier to scan for specific task).

### Large Archives

If archive grows to 10k+ tasks:
- Consider pagination (show 100 per page)
- Limit initial load (show last 12 months by default)
- Lazy-load older archive on demand

### Search Performance

Searching through large archive on every keystroke could be slow.

**Solution**: Debounce search input (100–200ms delay before filtering).

### Folder Structure Integrity

If user manually deletes Archive folder or moves files, archive view breaks.

**Solution**: Gracefully handle missing folders. Show message: "Archive folder not found" and offer to recreate.

## Dependencies

- **C2 (archive folder)** — required
- **C3 (auto-archive)** — optional (archive view works with manual archive too)
- **Can run with**: C5 (logbook independent)
- **Blocks**: C6 (migration may depend on archive view working)

## Related Issues

- No way to browse/restore archived tasks
- Archive folder grows but no reporting
- Users want history searchable/auditable

---

## Sample Archive View UI

```
Archive

[Search box] [Filter: Date range / Category / Project]

May 2026 (12 tasks)
├── □ Important bug fix    | Completed 2026-05-10 | [Restore]
├── □ Refactor TaskStore   | Completed 2026-05-08 | [Restore]
└── □ Fix UI bug           | Completed 2026-05-15 | [Restore]

April 2026 (8 tasks)
├── □ Add feature X        | Completed 2026-04-28 | [Restore]
└── ...

[Select All] [Restore Selected (3)] [Stats] [Export CSV]

Stats:
- Total archived: 128 tasks
- This month: 12 tasks
- By category: Bugs (45), Features (63), Refactor (20)
```
