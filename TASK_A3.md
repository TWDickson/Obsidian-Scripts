---
name: "A3: Extract relationship sync logic into TaskRelationships"
description: Centralize blocks sync, sanitization, and validation logic into dedicated TaskRelationships class
type: feature
---

# A3: Extract relationship sync logic into TaskRelationships

## Goal

Extract relationship management (`blocks` sync, dependency sanitization, relationship validation) from TaskStore into a dedicated `TaskRelationships` class. This isolates mutation side-effects and makes relationship rules explicit and testable.

## Scope

### Current State

TaskStore contains scattered relationship logic:
1. `syncBlocksReverse()` — Creates reverse index: `blocks` = inverse of `depends_on`
2. `sanitizeDependencies()` (implied) — Removes circular dependencies, invalid references
3. Relationship validation (implicit in update/create)
4. `buildDeleteDeps()` — Used when deleting a task to cascade block cleanup

These are tightly coupled to CRUD operations and vault I/O.

### What to Extract

Create `TaskRelationships` class with these methods:

```typescript
export class TaskRelationships {
  /**
   * Sync blocks field from depends_on across all tasks.
   * For each task, build blocks[] = IDs of tasks that depend on this one.
   * Returns updated task array.
   */
  syncBlocksReverse(tasks: Task[]): Task[] {
    // Pure function, no vault I/O
  }
  
  /**
   * Remove circular dependencies from a task's depends_on.
   * If task A depends on B and B depends on A, remove one direction.
   * Returns sanitized task array.
   */
  sanitizeDependencies(tasks: Task[]): { count: number; tasks: Task[] } {
    // Pure function
  }
  
  /**
   * Validate all relationships exist and are not broken.
   * Checks: depends_on references valid task IDs, blocks references valid IDs.
   * Returns validation report: {valid: boolean, errors: string[]}.
   */
  validateRelationships(tasks: Task[]): { valid: boolean; errors: string[] } {
    // Pure function, returns error list
  }
  
  /**
   * When deleting a task, return list of tasks whose blocks[] needs cleaning.
   * Used by delete() to cascade cleanup.
   */
  buildDeleteDeps(deletedId: string, tasks: Task[]): Task[] {
    // Return tasks that reference deletedId in depends_on (so their blocks[] updates)
  }
}
```

### Integration Point

In `TaskStore`:

```typescript
export class TaskStore {
  tasks: Writable<Task[]>;
  writer: TaskWriter;
  migrations: TaskMigrations;
  relationships: TaskRelationships;
  
  constructor(...) {
    this.tasks = writable<Task[]>([]);
    this.writer = new TaskWriter(app, this);
    this.migrations = new TaskMigrations();
    this.relationships = new TaskRelationships();
  }
  
  // Update method can now do:
  private async updateWithRelationshipSync(id: string, updates: Partial<Task>) {
    // Call this.relationships.syncBlocksReverse() after update
    // This ensures blocks field is always correct
  }
}
```

In `TaskWriter`:

- After `create()` succeeds, call `taskStore.relationships.syncBlocksReverse()`
- After `update()` if `depends_on` changed, call sync again
- On `delete()`, use `taskStore.relationships.buildDeleteDeps()` to clean up

## Deliverables

1. **`src/store/TaskRelationships.ts`** (120–150 lines)
   - Four public methods (all pure functions, no vault I/O)
   - Helper functions for circular detection, reference validation
   - Type definitions for validation output

2. **`src/store/TaskRelationships.test.ts`** (new, 12+ tests)
   - Test syncBlocksReverse: one task depends on another → blocks updated
   - Test circular detection: A→B→A → detected and handled
   - Test missing references: depends_on points to non-existent task → reported
   - Test cascade cleanup on delete: deleting A cleans up B's blocks
   - Test edge cases: empty array, isolated tasks, complex chains

3. **`src/store/TaskStore.ts`** (updated)
   - Add `relationships: TaskRelationships` property
   - Remove old `syncBlocksReverse()`, `sanitizeDependencies()` implementations
   - Keep `buildDeleteDeps()` as thin wrapper to `this.relationships.buildDeleteDeps()`
   - Remain at 100% test coverage

4. **`src/store/TaskWriter.ts`** (updated, if A1 done)
   - After `create()` succeeds: `const synced = this.taskStore.relationships.syncBlocksReverse($tasks)`
   - After `update()` if `depends_on` changed: re-sync blocks
   - On `delete()`: use relationship service to clean up

5. **`src/store/TaskStore.test.ts`** (updated)
   - Update tests that verify blocks sync to call through `.relationships`
   - Keep end-to-end tests that verify store behavior

## Acceptance Criteria

### Functionality
- [ ] `syncBlocksReverse()` produces same `blocks[]` as original TaskStore method
- [ ] Circular dependencies are detected and reported (not silently skipped)
- [ ] Invalid references (depends_on → non-existent task) are detected
- [ ] Delete cascade cleanup removes task from all blocks[] arrays
- [ ] All relationship tests pass (12+ tests)

### Code Quality
- [ ] TaskRelationships: 0 TypeScript errors
- [ ] TaskStore: 0 TypeScript errors (relationships property added)
- [ ] All functions pure (no vault I/O, no Obsidian imports)
- [ ] Test coverage: ≥95% for TaskRelationships
- [ ] Validation report is structured and informative

### Verification
- [ ] Build: `npm run build` succeeds, zero errors
- [ ] Tests: `npm run test` passes, 440+ tests passing
- [ ] No behavior regression: existing task relationships work as before
- [ ] Circular dependency detection catches A→B→A patterns

## Code Hints

### Where to Look

1. **Current syncBlocksReverse** (~50 lines):
   - Search in TaskStore for `syncBlocksReverse()`
   - Current pattern: iterate tasks, build reverse index
   - Copy this logic as-is into TaskRelationships

2. **Current sanitizeDependencies** (~30 lines):
   - Search for references to `sanitizeDependencies` or circular-check logic
   - May be scattered or implicit in update validation
   - Look for: removing self-references, detecting cycles

3. **Current buildDeleteDeps** (~40 lines):
   - Search for `buildDeleteDeps(` in TaskStore
   - Used in delete() method to find related tasks
   - Copy as-is

4. **Validation logic** (~20 lines):
   - May be implicit in create/update checks
   - Look for: `depends_on.every(id => findTask(id))` patterns
   - Extract to `validateRelationships()`

### Implementation Order

1. Create `TaskRelationships.ts` with four methods (copy from TaskStore)
2. Refactor to pure functions: return new arrays, not mutations
3. Add helper: `hasCyclicDependency(tasks, id1, id2)` for circular detection
4. Add helper: `isValidTaskId(id, tasks)` for reference validation
5. Create `TaskRelationships.test.ts` with comprehensive test coverage
6. Update `TaskStore.ts` to instantiate and use `.relationships`
7. Update `TaskWriter.ts` to call sync after mutations (if A1 done)
8. Run tests; verify end-to-end relationship behavior
9. Run `npm run build`

## Gotchas

### Circular Dependency Detection

Current detection might be simple (A depends on B, B depends on A). But chains can be longer:
- A → B → C → A
- Must detect cycles of any length

Use DFS (depth-first search) to detect cycles:

```typescript
function hasCycleFrom(nodeId: string, dependencies: Map<string, string[]>, visited: Set<string> = new Set()): boolean {
  if (visited.has(nodeId)) return true;
  visited.add(nodeId);
  
  for (const depId of dependencies.get(nodeId) || []) {
    if (hasCycleFrom(depId, dependencies, new Set(visited))) return true;
  }
  
  return false;
}
```

### Sync After Every Relationship Change

- If depends_on changes → must call syncBlocksReverse
- If blocks changes manually (shouldn't happen, but edge case) → validate
- Pattern: any mutation of a `depends_on` or `blocks` field must trigger sync

### Edge Cases to Test

1. **Self-reference**: Task A depends on itself → should be detected/removed
2. **Dead references**: depends_on points to deleted task → reported as invalid
3. **Orphans**: Task with no dependencies → blocks=[], depends_on=[]
4. **Chains**: A→B→C→D → blocks are correct at each level
5. **Empty**: No tasks at all → return empty arrays, count=0

## Dependencies

- **A1 and A2 should complete first** — TaskStore shape must be finalized before this integrates
- **Blocks**: This can run in parallel with A1/A2 if TaskStore interface is known
- **Blocks**: TaskWriter (A1) must be refactored to call `.relationships.syncBlocksReverse()` (unless kept in TaskStore for now)

## Related Issues

- Relationship logic scattered through TaskStore
- No explicit validation (silent failures on invalid references)
- No circular dependency safeguards
- Difficult to test in isolation (mixed with vault I/O)

---

## Test Fixtures

```typescript
// Simple: A depends on B
const taskA = { id: 'a', depends_on: ['b'], blocks: [] };
const taskB = { id: 'b', depends_on: [], blocks: ['a'] };
// After syncBlocksReverse: taskB.blocks should be ['a']

// Circular: A→B→A
const circularA = { id: 'a', depends_on: ['b'], blocks: [] };
const circularB = { id: 'b', depends_on: ['a'], blocks: [] };
// validateRelationships should report cycle

// Dead reference: A depends on non-existent C
const deadRefA = { id: 'a', depends_on: ['c'], blocks: [] };
// validateRelationships should report 'c' not found
```
