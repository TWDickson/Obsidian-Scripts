---
name: "B5: Graph project-scoped row grouping — Gantt lanes by project"
description: Group Gantt timeline rows by project to improve task organization in graph view
type: enhancement
---

# B5: Graph project-scoped row grouping — Gantt lanes by project

## Issue

In graph view (dependency graph + Gantt timeline), tasks are displayed in a flat list by due date. For users with many projects, it's hard to see which tasks belong to which project. Should group Gantt rows by project.

## Fix

**Location**: `TaskGraph.svelte` Gantt rendering section (likely ~500–800 lines)

**Change**: Group timeline rows by project:
1. Extract unique projects from all tasks
2. Within each project, sort tasks by due date
3. Render Gantt bars grouped by project header
4. Each project becomes a "swimlane" in Gantt

```typescript
// Pseudo-logic
function groupTasksByProject(tasks: Task[]): Map<string, Task[]> {
  const groups = new Map<string, Task[]>();
  
  for (const task of tasks) {
    const project = task.parent_task || "(no project)";
    if (!groups.has(project)) groups.set(project, []);
    groups.get(project)!.push(task);
  }
  
  // Sort tasks within each project by due date
  for (const [_, projectTasks] of groups) {
    projectTasks.sort((a, b) => 
      new Date(a.due_date || 9999).getTime() - 
      new Date(b.due_date || 9999).getTime()
    );
  }
  
  return groups;
}
```

## Acceptance Criteria

- [ ] Open graph view
- [ ] Gantt timeline shows rows grouped by project
- [ ] Each project is a collapsible/labeled section
- [ ] Within each project, tasks sorted by due date (earliest first)
- [ ] Visual separation between projects (borders, background color, header)
- [ ] Clicking project header collapses/expands project tasks
- [ ] Dependency graph still visible above timeline (unchanged)
- [ ] No TypeScript errors

## Verification

1. Create Project A with tasks: Task1 (due 2026-05-20), Task2 (due 2026-05-25)
2. Create Project B with tasks: Task3 (due 2026-05-15), Task4 (due 2026-05-22)
3. Open graph view → timeline section
4. Verify grouping: Project A section shows Task1, Task2 (sorted by due date)
5. Verify grouping: Project B section shows Task3, Task4 (sorted by due date)
6. Verify project header is clickable (can collapse/expand)

## Time Estimate

1–1.5 hours (add grouping logic, update timeline rendering, test)

## Implementation Notes

### Where to Look

1. **TaskGraph.svelte** (~1114 lines):
   - Search for Gantt rendering section (likely using `<svg>` or `<canvas>`)
   - Look for: row iteration logic, task rendering loop
   - Current structure: likely iterates all tasks, renders one row per task

2. **Current row ordering**:
   - Find how tasks are currently sorted (alphabetical? by due date?)
   - Replace with: group → project → sort by due date

3. **Visual elements**:
   - Project headers (new `<div class="gantt-project-header">`)
   - Indentation for grouped tasks
   - Collapse/expand buttons

### Implementation Order

1. **Extract grouping logic**:
   - Create `groupTasksByProject(tasks)` function
   - Returns `Map<string, Task[]>` with sorted tasks per project

2. **Update Gantt rendering**:
   - Replace: `{#each flatTasks as task}`
   - With: `{#each groupedTasks as [project, projectTasks]}`
   - Add project header rendering
   - Iterate projectTasks inside project section

3. **Add collapse/expand**:
   - Track collapsed projects in component state: `let collapsedProjects = new Set()`
   - Add toggle button on project header
   - Conditionally render projectTasks: `{#if !collapsedProjects.has(project)}`

4. **Style project sections**:
   - Add CSS classes: `.gantt-project-group`, `.gantt-project-header`
   - Visual separation between projects

5. **Test**:
   - Create multiple projects with tasks
   - Open graph, verify grouping
   - Collapse/expand projects
   - Verify timeline still accurate

## Gotchas

### Orphan Tasks

Tasks without a project (no `parent_task`) go into "(no project)" group.

**Solution**: Group these at bottom or top depending on UX preference. Current suggestion: bottom.

### Empty Projects

If a project has no tasks currently displayed (e.g., all completed), should it still appear in Gantt?

**Solution**: Only show projects with at least one active/visible task. Completed tasks excluded by filter already.

### Collapse State Persistence

Should collapsed/expanded state persist across view switches?

**Solution**: Store in `settings.graphCollapsedProjects` (Set of project IDs). Load on component mount.

### Performance

If many projects and tasks, rendering could be slow.

**Solution**: Use Svelte `{#each}` keying (`{#each ... as [project, tasks] (project)}`). Avoid re-computing grouping on every render; use reactive statement (`$: groupedTasks = groupTasksByProject(...)`).

## Dependencies

- **Can run with**: B4, B6 (independent graph enhancements)
- **Blocks**: Nothing

## Related Issues

- Gantt timeline is hard to navigate with many tasks
- Project boundaries not visually clear in timeline
- No easy way to see "all Q2 tasks for Project A"
