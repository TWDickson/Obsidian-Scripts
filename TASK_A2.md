---
name: "A2: Extract TaskStore migrations into TaskMigrations"
description: Consolidate 4 migration commands (CSS classes, status_changed, Phase 6 data model, checklist) into dedicated TaskMigrations class
type: feature
---

# A2: Extract TaskStore migrations into TaskMigrations

## Goal

Consolidate four separate migration functions scattered through TaskStore into a dedicated `TaskMigrations` class. Each migration becomes a pure, testable, side-effect-free function.

## Scope

### Current State
TaskStore contains four migration methods:
1. `migrateCssClasses()` — Add `cssclasses: [ttask]` to all tasks
2. `migrateStatusChanged()` — Populate `status_changed` field with `created` date
3. `migrateToPhase6()` — Update task schema from Phase 5 to Phase 6 (existing fields → new structure)
4. `migrateChecklistChildren()` — Normalize checklist children relationships

Each is called from `main.ts` as a command. They modify the in-memory task array and persist via vault.

### What to Extract

Move these four methods to new `TaskMigrations` class. Each method signature:

```typescript
export class TaskMigrations {
  async migrateCssClasses(tasks: Task[]): Promise<{ count: number; tasks: Task[] }> {
    // Return {count: N, tasks: [updated tasks]}
    // Pure function: does not modify input, returns new array
  }
  
  async migrateStatusChanged(tasks: Task[]): Promise<{ count: number; tasks: Task[] }> {
    // Return {count: N, tasks: [updated tasks]}
  }
  
  async migrateToPhase6(tasks: Task[]): Promise<{ count: number; tasks: Task[] }> {
    // Return {count: N, tasks: [updated tasks]}
  }
  
  async migrateChecklistChildren(tasks: Task[]): Promise<{ count: number; tasks: Task[] }> {
    // Return {count: N, tasks: [updated tasks]}
  }
}
```

### Key Requirements

- **Pure functions** — no vault I/O, no side effects
- **Return both count and updated tasks** — count for logging, tasks for chaining
- **Idempotent** — running twice doesn't double-apply
- **Logged** — each migration logs how many tasks were updated

### TaskStore Integration

In `TaskStore`:

```typescript
export class TaskStore {
  tasks: Writable<Task[]>;
  writer: TaskWriter;
  migrations: TaskMigrations;
  
  constructor(...) {
    this.tasks = writable<Task[]>([]);
    this.writer = new TaskWriter(app, this);
    this.migrations = new TaskMigrations();
  }
}
```

Commands in `main.ts`:

```typescript
// Before: taskStore.migrateCssClasses()
// After:  const result = await taskStore.migrations.migrateCssClasses($tasks);
//         taskStore.tasks.set(result.tasks);
//         console.log(`Migrated ${result.count} tasks`);
```

## Deliverables

1. **`src/store/TaskMigrations.ts`** (150–200 lines)
   - Four public async migration methods
   - Each: `(tasks: Task[]) => Promise<{ count: number; tasks: Task[] }>`
   - No Obsidian imports, no vault access
   - Helper functions for each migration logic

2. **`src/store/TaskMigrations.test.ts`** (new, 16+ tests)
   - Test each migration in isolation
   - Test idempotency (running twice = one result)
   - Test partial migrations (only some tasks need update)
   - Test edge cases (empty tasks, null fields, etc.)
   - Mock data: Task[] fixtures for each scenario

3. **`src/store/TaskStore.ts`** (updated)
   - Add `migrations: TaskMigrations` property
   - Remove original `migrateCssClasses`, `migrateStatusChanged`, etc. methods
   - Remain at 100% test coverage

4. **`src/main.ts`** (updated)
   - Commands now call `taskStore.migrations.migrate*()` 
   - After each migration, persist tasks: `taskStore.tasks.set(result.tasks)`
   - Log result: `console.log(`Migrated ${result.count} tasks`)`
   - No other behavior changes

## Acceptance Criteria

### Functionality
- [ ] All four migrations produce identical output to original TaskStore methods
- [ ] Migrations are idempotent (running twice doesn't double-apply)
- [ ] Each migration returns count of changed tasks (accurate)
- [ ] Each migration returns full task array (not just changed ones)
- [ ] Commands in main.ts trigger migrations correctly

### Code Quality
- [ ] TaskMigrations: 0 TypeScript errors
- [ ] TaskStore: 0 TypeScript errors (migrations property added)
- [ ] main.ts: 0 TypeScript errors (commands refactored)
- [ ] All migration tests pass (16+ tests)
- [ ] Each migration test covers: normal case, edge case, idempotency
- [ ] Test coverage: ≥95% for TaskMigrations

### Verification
- [ ] Build: `npm run build` succeeds, zero errors
- [ ] Tests: `npm run test` passes, 440+ tests passing
- [ ] Manual: Run each migration command via Obsidian UI, verify count is correct
- [ ] Code diff: TaskStore is further reduced (removed 4 methods)

## Code Hints

### Where to Look

1. **Current migrations in TaskStore** (~lines 400–600):
   - Search for `migrateCssClasses(`, `migrateStatusChanged(`, `migrateToPhase6(`, `migrateChecklistChildren(`
   - These are your copy-paste sources

2. **CSS classes migration** (~50 lines):
   - Current: adds `cssclasses: ['ttask']` to all tasks missing it
   - Check condition: `!task.cssclasses?.includes('ttask')`
   - Update: `task.cssclasses = [...(task.cssclasses || []), 'ttask']`

3. **status_changed migration** (~30 lines):
   - Current: sets `status_changed = created` for tasks missing it
   - Check: `!task.status_changed && task.created`
   - Update: `task.status_changed = task.created`

4. **Phase 6 migration** (~80 lines):
   - Likely converts old task schema to Phase 6 schema
   - Look for field renames or new field initialization
   - Should handle tasks that are already Phase 6 (skip them)

5. **Checklist children migration** (~50 lines):
   - Normalizes `checklist_children` relationships
   - May involve parsing or restructuring nested data
   - Should be safe for tasks without checklists

### Implementation Order

1. Create `TaskMigrations.ts` with four methods (copy-paste from TaskStore)
2. Update each method signature to return `{count, tasks}` instead of void
3. Refactor to be pure functions: return new task array instead of modifying
4. Create `TaskMigrations.test.ts` with full test coverage
5. Update `TaskStore.ts` to instantiate `migrations: TaskMigrations`
6. Update `main.ts` commands to use new signatures
7. Run tests; verify migrations work end-to-end
8. Run `npm run build`

## Gotchas

### Immutability Pattern
- Original methods likely modify tasks in-place
- New methods must return new Task[] (not mutate input)
- Pattern: `tasks.map(task => needsMigration(task) ? {...task, newField} : task)`

### Idempotency Check
- Each migration must check if already applied
- `migrateCssClasses`: skip if `cssclasses` already contains `ttask`
- `migrateStatusChanged`: skip if `status_changed` already set
- Test this! Run migration twice on same data → same result

### Count Accuracy
- Return count of tasks that were actually changed
- Don't count tasks that already had the field/value
- Helps detect if migration ran before

### Edge Cases
- Empty tasks array → `count: 0, tasks: []`
- All tasks already migrated → `count: 0, tasks: [...unchanged...]`
- Partial data (some tasks missing required fields) → still migrate others
- Null/undefined handling → don't crash, skip gracefully

### Async Signature
- Methods are `async` but currently have no I/O
- Keep `async` for consistency (future: could add logging/telemetry)
- No `await` needed inside (pure functions)

## Dependencies

- **A1 must complete first** — TaskStore shape must be finalized
- **Completed before**: Nothing else blocks this
- **Blocks**: None (this is independent functionality extraction)
- **Can parallelize with**: A1 (if A1 finalized), A3

## Related Issues

- Migrations scattered through TaskStore, hard to test
- No isolation: vault I/O mixed with schema logic
- No idempotency verification: unknown if safe to run twice
- Commands in main.ts are implicit (no discovery)

---

## Migration Testing Fixtures

Create test data for each migration type to test against:

```typescript
// Example: a task missing cssclasses
const taskNoCssClasses = {
  id: 'abc123',
  cssclasses: [],
  // ... other fields
};

// Example: a task already migrated
const taskAlreadyMigrated = {
  id: 'def456',
  cssclasses: ['ttask'],
  // ... other fields
};
```

Each test should cover:
1. Empty array
2. Array of unmigrated tasks
3. Array of already-migrated tasks
4. Mixed array (some migrated, some not)
