---
name: "A1: Extract TaskStore mutations into TaskWriter"
description: Refactor TaskStore to reduce from 1272→600 lines by extracting all CRUD operations into dedicated TaskWriter class
type: feature
---

# A1: Extract TaskStore mutations into TaskWriter

## Goal

Reduce TaskStore from 1272 lines to ~600 lines by extracting all create, update, delete, and duplicate operations into a dedicated `TaskWriter` class. This isolates mutations, improves testability, and clarifies responsibilities.

## Scope

### Current State
- `src/store/TaskStore.ts` contains:
  - State store (writable `tasks` store)
  - Vault watchers and file I/O (load, loadFromDisk)
  - CRUD methods: `create()`, `update()`, `delete()`, `duplicate()`
  - Blocks sync logic
  - Four migration methods (CSS classes, status_changed, Phase 6, checklist)
  - Graph test helpers

### What to Extract
Move these methods to new `TaskWriter` class:
- `create(input: TaskCreateInput): Promise<Task>`
- `update(id: string, updates: Partial<Task>): Promise<void>`
- `delete(id: string): Promise<void>`
- `duplicate(id: string): Promise<Task>`

Keep in TaskStore:
- `tasks: Writable<Task[]>` (state store)
- `load(folderPath): Promise<void>` (vault watcher setup)
- `loadFromDisk(folderPath): Promise<Task[]>` (file I/O)
- All vault/Obsidian integration

### TaskWriter Implementation

```typescript
// src/store/TaskWriter.ts
export class TaskWriter {
  constructor(private app: App, private taskStore: TaskStore) {}
  
  async create(input: TaskCreateInput): Promise<Task> {
    // Move entire TaskStore.create() implementation here
    // Call this.taskStore.tasks for state access
    // Maintains all logic: slug generation, frontmatter creation, blocks sync, etc.
  }
  
  async update(id: string, updates: Partial<Task>): Promise<void> {
    // Move entire TaskStore.update() implementation here
    // Maintains: processFrontMatter, blocks sync on relationship changes
  }
  
  async delete(id: string): Promise<void> {
    // Move entire TaskStore.delete() implementation here
  }
  
  async duplicate(id: string): Promise<Task> {
    // Move entire TaskStore.duplicate() implementation here
  }
}
```

### Integration Point

In `TaskStore` constructor:
```typescript
export class TaskStore {
  tasks: Writable<Task[]>;
  writer: TaskWriter;
  
  constructor(app: App, vault: Vault, blocksCacheService: BlocksCacheService, settingsService: SettingsService) {
    this.tasks = writable<Task[]>([]);
    this.writer = new TaskWriter(app, this);
    // ... rest of TaskStore init
  }
}
```

In `main.ts`, update all CRUD calls:
```typescript
// Before: taskStore.create(input)
// After:  taskStore.writer.create(input)

// Before: taskStore.update(id, updates)
// After:  taskStore.writer.update(id, updates)

// And so on...
```

## Deliverables

1. **`src/store/TaskWriter.ts`** (200–300 lines)
   - Complete CRUD implementation moved from TaskStore
   - Fully tested with unit tests
   - No Obsidian imports except `App` and `TFile` types
   - Pure mutations (returns new Task, then updates store)

2. **`src/store/TaskStore.ts`** (reduced to ~600 lines)
   - Remove all CRUD method implementations
   - Keep state store, vault loading, watchers
   - `writer: TaskWriter` property
   - Remain at 100% test coverage

3. **`src/store/TaskWriter.test.ts`** (new, 15–20 tests)
   - Test all CRUD operations in isolation
   - Mock app, vault, blocksCacheService
   - Verify blocks sync happens on create/update
   - Verify file creation, frontmatter updates, deletion

4. **`src/main.ts`** (refactored, no behavior change)
   - Update all TaskStore CRUD calls to use `.writer`
   - Example: `taskStore.create()` → `taskStore.writer.create()`
   - No other changes

5. **`src/store/TaskStore.test.ts`** (updated)
   - Remove CRUD test implementations
   - Keep integration tests that verify store state changes
   - Tests may now call `.writer.create()` instead of `.create()`

## Acceptance Criteria

### Functionality
- [ ] All existing CRUD operations produce identical output (no behavior change)
- [ ] Blocks sync still happens on create/update/delete
- [ ] File creation, updates, and deletion work as before
- [ ] `duplicate()` still creates correct clones with new IDs/slugs
- [ ] All existing task tests still pass

### Code Quality
- [ ] TaskWriter: 0 TypeScript errors
- [ ] TaskStore: 0 TypeScript errors
- [ ] main.ts: 0 TypeScript errors
- [ ] All CRUD tests pass (15–20 new + existing)
- [ ] TaskStore test coverage ≥95% (no regression)
- [ ] TaskWriter test coverage 100%

### Verification
- [ ] Build: `npm run build` succeeds, zero errors
- [ ] Tests: `npm run test` passes, 440+ tests passing
- [ ] No console warnings about unused TaskStore methods
- [ ] Code diff: TaskStore is ~600 lines (down from 1272)

## Code Hints

### Where to Look

1. **Current CRUD in TaskStore** (~lines 100–300):
   - Search `async create(`, `async update(`, `async delete(`, `async duplicate(`
   - These are your copy-paste source

2. **Blocks sync pattern** (~line 150–200):
   - Inside `create()` and `update()`, look for `syncBlocksReverse()`
   - Move this call pattern to TaskWriter; TaskWriter calls `this.taskStore.tasks` when needed

3. **File I/O pattern** (throughout):
   - `app.vault.create(path, content)` for creating files
   - `app.fileManager.processFrontMatter(file, fm => {})` for updates
   - Keep these in TaskWriter; don't move to shared utility yet

4. **Tests to preserve**:
   - `src/store/TaskStore.test.ts` has ~15 CRUD tests
   - Move test logic to `TaskWriter.test.ts` but keep integration tests in TaskStore.test.ts

### Implementation Order

1. Create `TaskWriter.ts` with all CRUD methods (copy-paste from TaskStore)
2. Update `TaskStore.ts` to inject `writer: TaskWriter` and remove CRUD implementations
3. Create `TaskWriter.test.ts` with full test coverage
4. Update `main.ts` to use `taskStore.writer.*` calls
5. Update `TaskStore.test.ts` to call through `.writer` if needed
6. Run tests; fix any integration issues
7. Run `npm run build` and verify zero errors

## Gotchas

### Blocks Sync Dependency
- `create()` and `update()` call `syncBlocksReverse()`
- This function lives in `TaskStore`
- TaskWriter will access it via `this.taskStore.syncBlocksReverse()` (still on TaskStore)
- (TaskRelationships extraction in A3 will move this later; for now, keep it as internal TaskStore method)

### State Updates
- TaskWriter must update `this.taskStore.tasks` after CRUD
- Use Svelte store update pattern: `this.taskStore.tasks.update(tasks => { ... })`
- Don't replace entire store; use `update()` or direct mutation depending on context

### Tests and Mocking
- TaskWriter tests need to mock `TaskStore` (which has `tasks: Writable<Task[]>`)
- Use a minimal mock TaskStore with a real writable store for tests
- Example: `const mockTaskStore = { tasks: writable<Task[]>([]), syncBlocksReverse: jest.fn() }`

### No Behavior Change
- Every test that passed before must pass after
- Identical task output, identical file creation, identical side-effects
- This is pure refactoring; if tests fail, re-check the method move

## Dependencies

- **Completed before**: Nothing (this is first in refactoring stream)
- **Blocks**: A1 must complete before A2 or A3 start (they depend on TaskStore shape)
- **Can parallelize with**: A2, A3 (if TaskStore structure is finalized first)

## Related Issues

- TaskStore is 1272 lines (God object)
- Makes testing difficult (vault I/O + state + mutations all mixed)
- Blocks sync and migrations also live here (extracted in A2, A3)
