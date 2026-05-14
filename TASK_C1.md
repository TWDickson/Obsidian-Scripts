---
name: "C1: Archive strategy design — choose archive approach"
description: Design and select archive approach (folder-based, status-based, or hybrid) before implementation
type: decision
---

# C1: Archive strategy design — choose archive approach

## Goal

Define archive strategy for completed tasks before implementing archive infrastructure. Three viable options; user decision needed.

## Issue

Completed tasks accumulate in active views, cluttering the workspace. Need a way to move completed tasks out of active views while preserving history and search.

## Three Options

### Option A: Folder-Based Archive

**Concept**: Move completed tasks to `Planner/Archive/` folder.

**Workflow**:
1. User marks task complete
2. Auto-move (or manual action): task moves from `Planner/Tasks/{id}-{slug}.md` → `Planner/Archive/{year}/{month}/{id}-{slug}.md`
3. Task removed from active views, queries skip Archive folder
4. Search can optionally include archive (toggle in settings)

**Pros**:
- Simple mental model (file location = archived)
- Easy to audit (browse Archive folder, browse by date)
- Backups naturally separate current/historical
- Easy to export/delete old archive folders

**Cons**:
- More files on disk (can slow Obsidian file watcher)
- Archive folder grows large (requires folder nesting by year/month)
- Bilinks to archived tasks become "broken" (unless Obsidian auto-updates)
- Migration: need to move existing completed tasks

### Option B: Status-Based Archive

**Concept**: Add "Archived" status to task. Queries filter by default.

**Workflow**:
1. User marks task complete
2. Auto-change (or manual): status: "Complete" → "Archived"
3. Active views filter out "Archived" status
4. Search/report views can toggle archived on/off
5. All tasks remain in `Planner/Tasks/` folder

**Pros**:
- All tasks in one folder (no file movement)
- Search/queries simple (just filter status)
- Bilinks don't break (task still exists in same location)
- No migration needed (just add new status)
- Flexible: can create archive views without archive folder

**Cons**:
- No physical organization (harder to browse by date)
- Archive status mixes with status field (clutters enum)
- Queries more complex (must explicitly exclude "Archived")
- Hard to bulk-delete old archive (requires status filter)

### Option C: Hybrid (Recommended)

**Concept**: Folder + Status combined for best of both worlds.

**Workflow**:
1. User marks task complete
2. Auto-move to Archive folder (Option A) AND set status to "Complete" (or "Archived")
3. Active views query: `status != "Archived"` AND not in Archive folder
4. Archive views: browse Archive folder OR filter `status: "Archived"`
5. Search can toggle archive on/off

**Pros**:
- Physical organization (folder browsing) + query flexibility (status)
- Bilinks mostly work (path changes can be handled)
- Easy to bulk-delete (Archive folder can be cleared)
- Queries are explicit (`status = "Archived" AND folder = Archive`)

**Cons**:
- More implementation complexity
- File movement + metadata change (two operations)
- Bilink breakage possible (requires re-indexing)

## User Decision Points

### Q1: Which archive approach?

- **Option A: Folder-based** (move tasks to Archive folder)
- **Option B: Status-based** (add Archived status, tasks stay in Planner/Tasks)
- **Option C: Hybrid** (folder + status, recommended)

### Q2: When to archive?

**Only relevant for Options A & C (auto-move):**

- **Immediate**: On mark complete (automatic)
- **Manual**: Add "Archive" button, user chooses when (on task detail)
- **Scheduled**: After N days of being complete (e.g., auto-archive after 30 days)
- **Never**: Don't auto-move; require manual archive action

### Q3: What counts as "archive eligible"?

- **Complete tasks only** (status: "Complete" or "Archived")
- **Complete + all dependencies finished** (won't affect any active tasks)
- **Complete + no blockers** (task isn't blocking anything active)
- **All of above** (conservative, safest)

### Q4: Search behavior

- **Exclude by default**: Active search ignores archive; opt-in to include
- **Include always**: Search all tasks including archive; filter available
- **Separate archive search**: "Search Active" vs "Search Archive" tabs

## Acceptance Criteria

*After user selects strategy:*

- [ ] Archive strategy documented in CLAUDE.md
- [ ] Archive folder (if Option A/C) created: `Planner/Archive/`
- [ ] Archive trigger documented (immediate/manual/scheduled)
- [ ] Archive eligibility rules defined
- [ ] Search behavior defined (include/exclude/separate)
- [ ] Query engine updated to support archive (if needed)
- [ ] View filters updated to exclude archive by default
- [ ] Documentation updated with archive workflow

## Time Estimate

0.5 hours (decision only) + design/implementation in C2–C6

## Implementation After Decision

Once strategy chosen, implementation spans C2–C6:
- **C2**: Archive folder setup (if Option A/C)
- **C3**: Bulk archive action + auto-archive logic
- **C4**: Archive view UI + reporting
- **C5**: Archive logbook (audit trail)
- **C6**: Archive migration (move existing completed tasks)

## Related Decisions

Depends on:
- When tasks should be archived (timing)
- How users interact with history (browsing vs searching)
- Data retention requirements (keep all history or purge old archives?)

---

## Recommendation

**Option C (Hybrid)** is recommended:
- Physical organization (folder) matches user mental model
- Query flexibility (status) supports both active/archive workflows
- Audit trail easier (folder structure + timestamps)
- Scalable (old archives can be moved to backup/deleted)

**Archive timing**: Manual (user chooses when) — safest approach, gives user control, no surprises.

**Eligibility**: Complete only — simple, safe, doesn't accidentally archive important tasks.

**Search**: Include by default with toggle — users usually want complete history searchable.
