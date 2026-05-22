---
name: "I4: Promote + completion sync"
description: Promote a captured task to a full TTasks note and keep the source file checkbox in sync with task state
type: feature
stream: I
depends_on: [I1, I2, I3]
---

# I4: Promote + Completion Sync

## Goal

Two related behaviours that complete the capture loop:

1. **Promote** — converts a captured `ExternalTask` into a full TTasks note, replacing the source checkbox with an unchecked wiki-link.
2. **Completion sync** — when a TTasks task (with a `source` field) is marked complete, writes `[x]` back to the source file at the linked line.

The source checkbox reflects actual task state at all times. It is only checked when the task is complete — not when it is promoted.

## Current State

No promote action exists. The `source` field is part of the frontmatter schema but is never written to or read from programmatically. `TaskWriter.update()` does not hook into any file-sync behaviour.

## What to Create

### I4-A: Promote helper (`src/integration/promoteTask.ts`)

Pure function that builds `TaskCreateInput` from an `ExternalTask`.

```typescript
export function buildPromoteInput(
  external: ExternalTask,
  inboxStatus: string,
  noteBasename: string,  // filename without extension, used for source wiki-link
): TaskCreateInput
// Maps ExternalTask fields → TaskCreateInput
// status: external.status if set, else inboxStatus
// source: buildWikiLink(external.location.path, noteBasename)
// All other fields carried over from ExternalTask (priority, due_date, start_date, etc.)
```

The full promote flow lives in `TaskBoard.svelte` (or a board-level action handler):

```typescript
async function promoteTask(external: ExternalTask): Promise<void> {
  const basename = getBasenameWithoutExt(external.location.path);
  const input = buildPromoteInput(external, plugin.settings.inboxStatus, basename);

  // 1. Create the TTasks note
  const task = await plugin.taskWriter.create(input);

  // 2. Replace the source line — unchecked wiki-link, not checked
  const file = app.vault.getAbstractFileByPath(external.location.path);
  if (file instanceof TFile) {
    const content = await app.vault.read(file);
    const lines = content.split('\n');
    const original = lines[external.location.line];
    lines[external.location.line] = buildPromotedLine(original, task.path, task.name);
    await app.vault.modify(file, lines.join('\n'));
  }

  // 3. Remove from scan engine (scanner will skip on next file event anyway)
  scanEngine.removeTasksForFile(external.location.path);
  await scanEngine.rescanFile(app, file, config, plugin.settings.tasksFolder);

  // 4. Open new task in detail panel
  activeTaskPath = task.path;
}

export function buildPromotedLine(
  originalLine: string,
  taskPath: string,
  taskName: string,
): string
// Replaces the text portion of a checkbox line with [[taskPath|taskName]]
// Preserves leading whitespace/indent and the `- [ ]` marker
// Result: `- [ ] [[Planner/Tasks/abc123|Task Name]]`
```

**Tests (≥10) — `src/integration/promoteTask.test.ts`:**

- `buildPromoteInput` maps all ExternalTask fields to TaskCreateInput correctly
- `buildPromoteInput` uses `inboxStatus` when ExternalTask status is null
- `buildPromoteInput` sets `source` to wiki-link of originating note
- `buildPromoteInput` carries emoji-parsed priority, due_date, start_date
- `buildPromoteInput` carries filename-inferred start_date
- `buildPromotedLine` replaces text with wiki-link, preserves `- [ ]` marker
- `buildPromotedLine` preserves leading indentation
- `buildPromotedLine` result is unchecked (not `[x]`) — task is not done yet
- `buildPromotedLine` handles checkbox with trailing whitespace
- After promotion, source line contains unchecked TTasks wiki-link

### I4-B: Completion sync (`src/integration/completionSync.ts`)

Pure helpers + async function that writes checkbox state back to the source file when a TTasks task's status changes.

```typescript
export function buildUpdatedSourceLine(
  originalLine: string,
  checked: boolean,
): string
// Replaces [ ] with [x] (checked=true) or [x] with [ ] (checked=false)
// Only modifies lines that already contain a TTasks wiki-link
// Returns originalLine unchanged if no checkbox pattern found

export function findTTasksLinkLine(
  lines: string[],
  taskPathFragment: string,
): number
// Returns 0-indexed line number of the line containing [[taskPathFragment...]]
// Returns -1 if not found

export async function syncCompletionToSource(
  task: Task,
  app: App,
  completionStatus: string,
): Promise<void>
// No-op if task.source is null or empty
// No-op if source file not found in vault
// No-op if TTasks link line not found in file
// Otherwise: reads file, finds link line, writes updated checkbox state
```

Hook into `TaskWriter.update()`: after a status change, call `syncCompletionToSource` if `task.source` is set. The `checked` state is `newStatus === completionStatus`.

This also handles **uncompleting** — if a task is moved back from completionStatus, the source line returns to `[ ]`.

**Tests (≥8) — `src/integration/completionSync.test.ts`:**

- `buildUpdatedSourceLine`: `[ ]` → `[x]` when checked=true
- `buildUpdatedSourceLine`: `[x]` → `[ ]` when checked=false
- `buildUpdatedSourceLine`: preserves leading whitespace
- `buildUpdatedSourceLine`: returns line unchanged if no TTasks wiki-link
- `findTTasksLinkLine`: returns correct index for matching line
- `findTTasksLinkLine`: returns -1 when no match
- `syncCompletionToSource`: no-op when task.source is null
- `syncCompletionToSource`: writes [x] to correct source line on complete

## Acceptance Criteria

- [ ] `buildPromoteInput` produces valid TaskCreateInput from any ExternalTask
- [ ] `buildPromotedLine` produces unchecked wiki-link (not `[x]`)
- [ ] After promotion, source checkbox reads `- [ ] [[path|name]]`
- [ ] After promotion, ExternalTask removed from scan engine store
- [ ] After promotion, new TTasks note opens in detail panel
- [ ] Completing a TTasks task with `source` set writes `[x]` to source file
- [ ] Uncompleting writes `[ ]` back to source file
- [ ] `syncCompletionToSource` no-ops gracefully on null source / missing file / missing line
- [ ] All pure tests pass, `npm run build` clean

## Implementation Order (TDD)

1. Write `promoteTask.test.ts` — tests for `buildPromoteInput` and `buildPromotedLine` red
2. Implement `promoteTask.ts` until tests green
3. Write `completionSync.test.ts` — red
4. Implement `completionSync.ts` until tests green
5. Wire `promoteTask` promote flow into `TaskBoard.svelte` (Promote button on captured TaskRow)
6. Hook `syncCompletionToSource` into `TaskWriter.update()`

## Principles

**TDD**: All four pure functions written test-first.
**DRY**: `buildPromotedLine` is the single function that knows how to rewrite a checkbox line with a wiki-link. Reused by I5 bulk import.
**SOLID**: Pure helpers (promoteTask.ts, completionSync.ts) own no Obsidian calls. The promote *flow* (vault reads/writes, store updates, UI) lives in TaskBoard — not in the helper modules.
**SoC**: What the promoted line looks like (pure) separate from writing it to disk (async, board-level). Whether a task is complete (TaskWriter) separate from syncing that state to source (completionSync hook).

## Gotchas

- **Promoted line must be unchecked** (`- [ ]`, not `- [x]`). The task is promoted, not done. This is a deliberate design decision — the source checkbox reflects task completion state, not whether it entered TTasks.
- **`source` field parsing**: `task.source` is stored as `[[path/without/ext|Name]]`. To find the vault file, extract the path part before `|` and append `.md`. Use `parseWikiLinkPath` from `src/utils/wikiLink.ts`.
- **Concurrent writes**: use `app.vault.process()` instead of `read()` + `modify()` to avoid data races when two promotions happen close together.
- **`findTTasksLinkLine` uses path fragment** not full path — the stored wiki-link drops the `.md` extension. Match on `task.path` without extension inside the line.
- **Rollover copies**: after promotion, rollover plugins may copy `- [ ] [[abc123|name]]` to the next daily note. The scanner ignores these (hasTTasksLink = true). When the task is completed, `syncCompletionToSource` updates the original source location only — rollover copies remain as unchecked wiki-links indefinitely, which is acceptable.

## Dependencies

- Requires: I1 (parsers), I2 (settings), I3 (ExternalTask type + ScanEngine.removeTasksForFile)
- Blocks: I5 (bulk import reuses `buildPromoteInput` and `buildPromotedLine`)
