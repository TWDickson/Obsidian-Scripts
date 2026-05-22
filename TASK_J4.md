---
name: "J4: Parallel relationship writes + task Map index"
description: Replace sequential vault writes with batched parallel operations, and switch task lookup from O(n) array scan to O(1) Map
type: architecture
stream: J
priority: Medium
depends_on: [J1]
---

# J4: Parallel Relationship Writes + Task Map Index

## Goal

Two confirmed performance issues: relationship backlink rewrites are sequential (10 backlinks = 10 sequential vault writes), and the task store uses an array structure that requires O(n) `.find()` for every path-based lookup. Both are invisible at small vault sizes but become perceptible at 200+ tasks or high-backlink counts. Fix both together since they share the underlying data structure change.

## Confirmed Issues

### TaskRelationships.ts:45–80 — Sequential `vault.modify()` per backlink

When a task is deleted or renamed, the relationship rewriter iterates all backlinks and rewrites each file sequentially:

```typescript
for (const [filePath, file] of backlinkFiles) {
  const content = await vault.read(file);
  const updated = rewriteContent(content, oldPath, newPath);
  await vault.modify(file, updated);  // ← sequential, one at a time
}
```

10 backlinks = 10 sequential reads + 10 sequential writes. At 500ms per round-trip on mobile, that's 10 seconds for a rename with 10 backlinks.

Fix: read all files in parallel, rewrite in parallel. Obsidian's vault API handles concurrent `modify()` calls safely.

### TaskStore — Array-based task lookup

If `TaskStore` exposes tasks as `Task[]` (confirm by reading), every path-based lookup (e.g. `tasks.find(t => t.path === path)`) is O(n). This lookup occurs in:
- `TaskWriter.update()` — find task before updating
- `TaskRelationships.syncBlocks()` — find tasks by path
- `ReminderService.check()` — find task by path for snooze check
- Detail panel — find active task
- Context menu — find task for action

Each is a separate O(n) scan. With 500 tasks and 10 lookups per user interaction, that's 5,000 comparisons per click.

Fix: maintain a `Map<string, Task>` alongside or instead of `Task[]` for O(1) lookups.

## What to Create

### J4-A: Parallel vault writes in `TaskRelationships.ts`

Replace the sequential write loop with parallel execution:

```typescript
// Before:
for (const [filePath, file] of backlinkFiles) {
  const content = await vault.read(file);
  const updated = rewriteContent(content, oldPath, newPath);
  await vault.modify(file, updated);
}

// After:
const writes = await Promise.all(
  backlinkFiles.map(async ([filePath, file]) => {
    const result = await safeRead(vault, file);
    if (!result.ok) return;
    const updated = rewriteContent(result.value!, oldPath, newPath);
    await safeModify(vault, file, updated);
  })
);
```

**Concurrency cap**: use a semaphore or `p-limit` to cap parallel writes at 5 simultaneous operations. Obsidian's vault handles concurrent writes, but saturating it with 50+ parallel writes can cause visible freezes on mobile. A cap of 5 is safe and still 5× faster than sequential.

```typescript
// Lightweight semaphore — no extra dependency needed:
async function withConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]>
// Runs at most `limit` tasks concurrently
```

### J4-B: Task Map index in `TaskStore.ts`

Confirm current data structure by reading TaskStore. If tasks are stored as `Task[]`, add a parallel `Map<string, Task>`:

```typescript
export class TaskStore {
  private tasks: Task[] = [];
  private taskMap: Map<string, Task> = new Map();  // ADD

  getByPath(path: string): Task | undefined {
    return this.taskMap.get(path);  // O(1)
  }

  getAll(): Task[] {
    return this.tasks;
  }

  // On load and on each mutation, keep both in sync:
  private setTasks(tasks: Task[]): void {
    this.tasks = tasks;
    this.taskMap = new Map(tasks.map(t => [t.path, t]));
  }

  private addTask(task: Task): void {
    this.tasks.push(task);
    this.taskMap.set(task.path, task);
  }

  private removeTask(path: string): void {
    this.tasks = this.tasks.filter(t => t.path !== path);
    this.taskMap.delete(path);
  }

  private updateTask(task: Task): void {
    const idx = this.tasks.findIndex(t => t.path === task.path);
    if (idx !== -1) this.tasks[idx] = task;
    this.taskMap.set(task.path, task);
  }
}
```

Update all callers of `tasks.find(t => t.path === x)` to use `store.getByPath(x)`.

### J4-C: Pure helper for concurrency cap (`src/utils/concurrency.ts`)

```typescript
export async function withConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<Array<T | undefined>>
// Runs tasks in batches of `limit`, collecting results
// Errors are caught per-task (returns undefined for failed tasks)
```

**Tests (≥6):**
- Runs all tasks when tasks.length < limit
- Limits concurrent executions to `limit` at any moment
- Returns results in input order
- Failed tasks return undefined, don't abort batch
- Empty tasks array → empty results
- limit=1 → fully sequential (safe fallback)

## Acceptance Criteria

- [ ] `rewriteRelationshipReferences` uses `withConcurrencyLimit` with cap of 5
- [ ] Bulk rename with 10 backlinks: vault writes run in parallel (verify via timing or mock)
- [ ] `TaskStore.getByPath(path)` returns in O(1) without scanning the array
- [ ] All existing lookups via `.find(t => t.path === x)` replaced with `getByPath`
- [ ] `taskMap` and `tasks` array stay in sync on create/update/delete
- [ ] `withConcurrencyLimit` pure function has ≥6 passing tests
- [ ] All existing tests pass
- [ ] `npm run build` clean

## Tests

### `src/utils/concurrency.test.ts` (≥6 tests)

See J4-C above.

### `src/store/TaskStore.test.ts` additions (≥4 tests)

- `getByPath` returns correct task after load
- `getByPath` returns undefined for unknown path
- `getByPath` returns updated task after update
- `getByPath` returns undefined after delete

## Implementation Order (TDD)

1. Write `concurrency.test.ts` — red
2. Implement `withConcurrencyLimit` — green
3. Update `TaskRelationships.ts` to use parallel writes with cap
4. Confirm `TaskStore` data structure (read the file) — if array, add Map index
5. Write TaskStore.test additions — red
6. Implement `getByPath` and sync maintenance — green
7. Replace all `.find(t => t.path === x)` callsites with `getByPath`
8. Run full test suite

## Principles

**Performance**: O(1) lookups and parallel I/O are both about respect for the user's time. Neither should require a PRD at 200 tasks — fix it before it hurts.
**DRY**: `withConcurrencyLimit` is used by relationship writes today and may be used by I5 bulk import tomorrow. One place.
**SoC**: Concurrency management (how many parallel ops) separate from the vault operation logic (what to write).

## Gotchas

- **Don't use `Promise.all` directly on large arrays** without a concurrency cap. `Promise.all(files.map(read))` on a 500-file vault fires 500 simultaneous vault reads. Obsidian doesn't crash but it causes visible jank on mobile. The cap of 5 is the safe default.
- **Map sync discipline**: every code path that mutates `this.tasks` must also update `this.taskMap`. Use the private `setTasks`, `addTask`, `removeTask`, `updateTask` helpers exclusively — never mutate the array directly.
- **Svelte reactivity**: if `tasks` is a Svelte `writable` or `readable` store, adding `taskMap` alongside requires ensuring the store update triggers correctly. `taskMap` doesn't need to be reactive — it's an internal lookup index only.
- **`p-limit` alternative**: rather than implementing `withConcurrencyLimit` from scratch, consider `p-limit` (MIT licensed, tiny, zero deps). But the scratch implementation is only ~20 lines and avoids a new dependency.

## Dependencies

- Requires: J1 (safeRead, safeModify used inside parallel write loop)
- Blocks: nothing
