---
name: "I3: Scan engine + auto-capture"
description: Vault-watching scan engine that surfaces external checkboxes as ExternalTasks in the TTasks inbox
type: feature
stream: I
depends_on: [I1, I2]
---

# I3: Scan Engine + Auto-Capture

## Goal

A reactive engine that watches configured directories for unchecked checkboxes, normalises them into `ExternalTask` objects, and surfaces them in the TTasks inbox automatically. No user action required for capture — tasks appear as soon as they exist in a watched file.

## Current State

TTasks has no mechanism to read checkboxes from external files. The query engine only operates on native task notes in the configured tasks folder.

## What to Create

### I3-A: Pure file scanner (`src/integration/fileScanner.ts`)

Given file content, path, and a single `CaptureSourceConfig`, returns all capturable `ExternalTask` objects. No Obsidian API calls — pure function.

```typescript
export function scanFileForCapturableTasks(
  content: string,
  filePath: string,
  config: CaptureSourceConfig,
  tasksFolder: string,
): ExternalTask[]
```

Processing pipeline per line:
1. If `sectionFilter` is set, only process lines under a matching heading (`## Filter Text`)
2. `parseCheckboxLine(line)` — skip if null
3. Skip if `checked`, `cancelled`, or `hasTTasksLink` (already promoted)
4. `parseEmojiFields(parsed.text)` — extract structured fields if present
5. `parseDatesFromFilename(basename)` if `inheritDateFromFilename` — infer start/due dates
6. Apply `config.defaults` for any field not already set by emoji parsing
7. Build and return `ExternalTask`

Field priority (highest → lowest): emoji signifiers → filename dates → `config.defaults` → null.

Explicit emoji priority overrides a configured default priority.

```typescript
// Also export for use by I5:
export function isInCaptureScope(
  filePath: string,
  config: CaptureSourceConfig,
): boolean
// Returns true if filePath is within config.path
// Respects includeSubdirectories flag
```

**Tests (≥14) — `src/integration/fileScanner.test.ts`:**

- Returns ExternalTask for each unchecked, non-TTasks checkbox
- Skips checked items `[x]`
- Skips cancelled items `[-]`
- Skips lines containing TTasks wiki-links
- Section filter active → only tasks under matching heading returned
- Section filter `''` → all tasks returned regardless of headings
- Emoji due date extracted into ExternalTask.due_date
- No emoji → all date/priority fields null
- `inheritDateFromFilename: true` + dated filename → start_date set from filename
- `inheritDateFromFilename: false` → filename dates ignored
- Config defaults applied: area, labels from config
- Emoji priority overrides config default priority
- `isInCaptureScope`: path inside directory → true
- `isInCaptureScope`: `includeSubdirectories: false` → subdirectory path → false

### I3-B: ScanEngine (`src/integration/ScanEngine.ts`)

Orchestrates vault watching across all configured capture sources. Maintains a reactive `ExternalTask[]` store.

```typescript
export class ScanEngine {
  private store: Writable<ExternalTask[]> = writable([]);
  get tasks(): Readable<ExternalTask[]> { return this.store; }

  onload(plugin: Plugin, app: App): void {
    this.runFullScan(app, plugin.settings);

    // Re-scan a file when it's modified
    plugin.registerEvent(app.vault.on('modify', (file) => {
      if (!(file instanceof TFile)) return;
      const config = this.findConfig(file.path, plugin.settings.captureSources);
      if (config) this.rescanFile(app, file, config, plugin.settings.tasksFolder);
    }));

    // When a new daily note is created, surface previous day's uncaptured tasks
    plugin.registerEvent(app.vault.on('create', (file) => {
      if (!(file instanceof TFile)) return;
      if (isDailyNoteFile(file.path, app)) {
        this.surfacePreviousDayTasks(app, plugin.settings);
      }
    }));
  }

  private async rescanFile(
    app: App, file: TFile, config: CaptureSourceConfig, tasksFolder: string,
  ): Promise<void>
  // Reads file, runs scanFileForCapturableTasks, replaces entries for this file path
  // Debounced 300ms — rapid saves don't trigger multiple scans

  private async runFullScan(app: App, settings: TTasksSettings): Promise<void>
  // Iterates all captureSources, finds all in-scope files, scans each

  private async surfacePreviousDayTasks(app: App, settings: TTasksSettings): Promise<void>
  // Uses getDailyNote(yesterday, getAllDailyNotes()) to find yesterday's note
  // Re-scans it and marks resulting ExternalTasks with fromPreviousDay: true
  // These sort to the top of the inbox view

  removeTasksForFile(filePath: string): void
  // Called when a file is deleted or moved out of scope
}
```

`rescanFile` replaces only the entries for the given file path, preserving entries from all other files. Implemented as a partial update — no full re-scan on every keystroke.

### I3-C: ExternalTask type extension

Add `fromPreviousDay?: boolean` to `ExternalTask` in `src/integration/types.ts`. Defaults to `false`. Set to `true` only by `surfacePreviousDayTasks`. Used by the inbox view to render the "from yesterday" indicator and sort order.

### I3-D: Query engine merge + inbox surface

In `TaskBoard.svelte`, derive a merged list from native tasks and captured tasks:

```typescript
// TaskBoard.svelte
$: allTasks = [...$taskStore.tasks, ...$scanEngine.tasks];
// Pass allTasks to the query engine instead of $taskStore.tasks directly
```

Captured tasks already have `is_inbox: true` (set by fileScanner when `config.defaults.status` is null or maps to inboxStatus). They appear in the existing Inbox smart list automatically.

In `TaskRow.svelte`, external tasks (`task.external === true`) render with:
- A small `captured` pill badge to distinguish from native inbox tasks
- `fromPreviousDay` renders as a "from yesterday" label
- Clicking opens the source file at `task.location.line` (not a detail panel)
- A **Promote** button in row actions (implemented in I4)

## Acceptance Criteria

- [ ] `scanFileForCapturableTasks` returns correct ExternalTasks from all checkbox formats
- [ ] Emoji fields extracted correctly when present
- [ ] Filename date inference applies when configured
- [ ] Checked, cancelled, and TTasks-linked checkboxes are skipped
- [ ] Section filter correctly limits scope to heading content
- [ ] `isInCaptureScope` respects `includeSubdirectories`
- [ ] ScanEngine initialises and runs full scan on plugin load
- [ ] File modify event triggers targeted rescan within 300ms debounce
- [ ] New daily note creation triggers surface of previous day's tasks
- [ ] `fromPreviousDay` tasks visible at top of inbox
- [ ] External tasks visible in Inbox smart list alongside native tasks
- [ ] Captured pill badge distinguishes external tasks visually
- [ ] Clicking a captured task row opens source file at correct line
- [ ] `npm run build` clean, all tests pass

## Tests (≥14 pure) — `src/integration/fileScanner.test.ts`

See I3-A test list above. ScanEngine tests are integration-level (mock App + vault); focus unit tests on `scanFileForCapturableTasks` and `isInCaptureScope`.

## Implementation Order (TDD)

1. Add `fromPreviousDay?: boolean` to `ExternalTask` in `src/integration/types.ts`
2. Write `fileScanner.test.ts` — all tests red
3. Implement `scanFileForCapturableTasks` and `isInCaptureScope` until tests green
4. Implement `ScanEngine` class (no unit tests — manual verification + build)
5. Wire merge into `TaskBoard.svelte`
6. Add `captured` badge + `fromPreviousDay` label to `TaskRow.svelte`
7. Wire `app.vault.on('create')` for daily note detection

## Principles

**TDD**: `scanFileForCapturableTasks` and `isInCaptureScope` written test-first. ScanEngine is integration glue — tested via build + manual.
**DRY**: Reuses `parseCheckboxLine` (I1-A), `parseEmojiFields` (I1-B), `parseDatesFromFilename` (I1-C) — no duplicate parsing logic.
**SOLID**: `fileScanner.ts` (pure computation) separate from `ScanEngine.ts` (Obsidian orchestration) separate from `TaskRow.svelte` (rendering).
**SoC**: What to scan (config) separate from how to scan (fileScanner) separate from when to scan (ScanEngine watchers).

## Gotchas

- `rescanFile` must **replace only entries for that file path** in the store — not clear the whole store and re-scan all files. A partial update keeps captured tasks from other files stable during rapid edits.
- Daily note detection: use `getDateFromFile(file, 'day')` from `obsidian-daily-notes-interface` — returns null for non-daily-note files. No need for manual regex on the filename.
- `surfacePreviousDayTasks` is called on every new file create event — guard with the daily note check first to avoid unnecessary reads.
- Manual mode directories (`config.mode === 'manual'`) should still be scanned — they just don't appear in the inbox view automatically. The promote button is still available if the user navigates there.
- `auto-promote` mode: after scanning, immediately call the promote flow (I4-A) for each found task without waiting for user action. Implement after I4 is complete.

## Dependencies

- Requires: I1 (all three parsers), I2 (CaptureSourceConfig settings)
- Blocks: I4 (promote needs ExternalTask from store), I5 (import uses fileScanner directly)
