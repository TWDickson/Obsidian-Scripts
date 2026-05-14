---
name: "B2: Add Dependency UX — surface same-project tasks first"
description: Sort task list in Add Dependency modal to show same-project tasks at top
type: enhancement
---

# B2: Add Dependency UX — surface same-project tasks first

## Issue

When opening "Add Dependency" modal, the task list is unsorted or alphabetically sorted. For users with many tasks, it's hard to find tasks in the same project. Should prioritize same-project tasks at the top.

## Fix

**Location**: Dependency modal or `TaskDetailRelationships.svelte` (after A7)

**Change**: Sort task list by:
1. Same project (current task's parent_task) → sort alphabetically
2. Other projects → sort alphabetically
3. Orphan tasks (no parent) → sort alphabetically

```typescript
// Sorting logic
function sortDependencyTasks(tasks: Task[], currentTask: Task): Task[] {
  const currentProject = currentTask.parent_task;
  
  return tasks.sort((a, b) => {
    // Same project first
    const aIsSameProject = a.parent_task === currentProject;
    const bIsSameProject = b.parent_task === currentProject;
    
    if (aIsSameProject && !bIsSameProject) return -1;
    if (!aIsSameProject && bIsSameProject) return 1;
    
    // Within same group, sort alphabetically
    return a.name.localeCompare(b.name);
  });
}
```

## Acceptance Criteria

- [ ] Open "Add Dependency" modal
- [ ] Tasks from same project appear at top (grouped together)
- [ ] Within same-project group, tasks are alphabetically sorted
- [ ] Other projects follow (also alphabetically sorted)
- [ ] Modal opens quickly (no performance regression)
- [ ] No TypeScript errors

## Verification

1. Create Project A with tasks: Alpha, Beta, Gamma
2. Create Project B with tasks: Delta, Epsilon
3. In Project A task, open "Add Dependency"
4. Verify list shows: Alpha, Beta, Gamma, Delta, Epsilon (same project first)
5. Not: Alpha, Beta, Delta, Epsilon, Gamma (mixed order)

## Time Estimate

30–45 minutes (locate modal, add sort logic, test)

## Notes

- Check if modal already filters out invalid targets (circular deps, self-reference)
- Add sort to the task list BEFORE rendering, not during render
- Consider edge cases: tasks with same name, tasks in nested projects
- May need to import `localeCompare` or use `Intl.Collator` for internationalization
