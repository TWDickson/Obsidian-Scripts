---
name: "I5: Bulk import"
description: One-time batch promotion of all captured tasks to TTasks notes, accessible via Settings → Advanced
type: feature
stream: I
depends_on: [I1, I2, I3, I4]
---

# I5: Bulk Import

## Goal

Allow users migrating from Obsidian Tasks (or with a large backlog of unprocessed checkboxes) to promote all captured tasks to TTasks notes in one operation. Located in Settings → Advanced — not the command palette — so it is discoverable during setup but not accidentally triggered during normal use.

## Current State

No bulk import exists. Promotion is one task at a time via the Promote button (I4). The scan engine (I3) and promote helpers (I4) provide all the building blocks.

## What to Create

### I5-A: Import scanner (`src/integration/importScanner.ts`)

Thin wrapper: runs `scanFileForCapturableTasks` (from I3-A) across all files in all configured capture sources, collecting the full candidate list synchronously.

```typescript
export async function collectAllCapturableTasks(
  app: App,
  settings: TTasksSettings,
): Promise<ExternalTask[]>
// For each CaptureSourceConfig in settings.captureSources:
//   - Find all markdown files within config.path (respecting includeSubdirectories)
//   - Exclude files inside settings.tasksFolder (don't re-import native tasks)
//   - Call scanFileForCapturableTasks on each
// Returns flat ExternalTask[] across all sources
```

This is the same logic as `ScanEngine.runFullScan` but returns results synchronously rather than updating a store. Extract the shared file-finding logic into a shared utility to avoid duplication.

**Tests (≥6) — `src/integration/importScanner.test.ts`:**

- Collects tasks from all configured capture sources
- Respects `includeSubdirectories: false` for a source
- Excludes files whose path starts with `tasksFolder`
- Excludes already-promoted checkboxes (hasTTasksLink)
- Empty `captureSources` → returns `[]`
- File outside any configured source → not included

### I5-B: Import confirm modal (`src/modals/ImportConfirmModal.ts`)

A Modal shown before any files are modified. Extends the existing Modal pattern used by delete confirmation.

Display:
- "Found **N tasks** across **M files**."
- Preview list: first 5 task names with their source file basename
- Body text: "Each will become a TTasks note. The original checkboxes will be replaced with wiki-links. **This cannot be undone.**"
- Two buttons: **[Import N tasks]** (primary) and **[Cancel]**

Returns a `Promise<boolean>` — resolves `true` on confirm, `false` on cancel or close.

### I5-C: Batch promote loop

Wired into the **Settings → Advanced** section (add a new collapsible "Migration" group to `SettingsTab.ts`):

```typescript
// In the Advanced / Migration settings section:
new Setting(containerEl)
  .setName('Import all captured tasks')
  .setDesc('Scan configured capture sources and promote all found tasks to TTasks notes at once.')
  .addButton(btn => btn
    .setButtonText('Import captured tasks')
    .onClick(async () => {
      const candidates = await collectAllCapturableTasks(app, plugin.settings);

      if (candidates.length === 0) {
        new Notice('No capturable tasks found in configured directories.');
        return;
      }

      const confirmed = await new ImportConfirmModal(app, candidates).openAndWait();
      if (!confirmed) return;

      let created = 0;
      let errors = 0;
      for (const external of candidates) {
        try {
          await promoteTaskToTTasks(external, plugin, app);
          created++;
        } catch (e) {
          errors++;
          console.error(`TTasks import: failed to promote task "${external.name}" from ${external.location.path}`, e);
        }
      }

      const msg = errors > 0
        ? `Imported ${created} tasks (${errors} errors — see console).`
        : `Imported ${created} tasks.`;
      new Notice(msg);
    })
  );
```

`promoteTaskToTTasks` is the same promote flow as I4 — extracted into a shared async function callable from both the board's Promote button and this batch loop.

### I5-D: Progress feedback

If the batch contains more than 10 tasks, show a persistent Notice with a progress counter that updates:

```typescript
const progressNotice = new Notice(`TTasks: importing 0 / ${candidates.length}…`, 0);
// Update inside the loop:
progressNotice.setMessage(`TTasks: importing ${created + errors} / ${candidates.length}…`);
// Dismiss on completion:
progressNotice.hide();
new Notice(finalMessage);
```

## Acceptance Criteria

- [ ] `collectAllCapturableTasks` returns correct tasks from all configured sources
- [ ] Files in `tasksFolder` excluded from results
- [ ] Already-promoted checkboxes excluded from results
- [ ] Confirm modal displays correct task count and file count
- [ ] Confirm modal preview shows first 5 task names with source files
- [ ] Cancel → zero tasks created, zero files modified
- [ ] After confirm: each candidate becomes a TTasks note with correct fields
- [ ] After confirm: each source checkbox replaced with unchecked wiki-link
- [ ] Individual task errors logged but do not abort the batch
- [ ] Final notice shows created count and error count
- [ ] Progress notice shown for batches > 10 tasks
- [ ] Import button located in Settings → Advanced, not command palette
- [ ] `npm run build` clean, all tests pass

## Tests (≥10 total)

`src/integration/importScanner.test.ts` (≥6): see I5-A above.

`src/modals/ImportConfirmModal.test.ts` (≥4):
- Modal displays correct task count
- Modal displays correct file count (deduplicated)
- Clicking Import resolves true
- Clicking Cancel resolves false

## Implementation Order (TDD)

1. Write `importScanner.test.ts` — red
2. Implement `collectAllCapturableTasks` — green (reuses `scanFileForCapturableTasks`)
3. Extract shared file-finding logic from ScanEngine if needed (DRY)
4. Write `ImportConfirmModal.test.ts` — red
5. Implement `ImportConfirmModal.ts` — green
6. Add Advanced / Migration section to `SettingsTab.ts` with batch promote loop
7. Add progress Notice for large batches

## Principles

**TDD**: `collectAllCapturableTasks` and modal logic test-first.
**DRY**: Reuses `scanFileForCapturableTasks` (I3-A) and `buildPromoteInput` + `buildPromotedLine` (I4-A). Zero new vault or task-creation logic.
**SOLID**: Scanner (collect candidates) separate from confirmation UI separate from execution loop (batch promote) separate from feedback (progress notice).
**SoC**: The bulk import is just "run promote N times" — no new concepts. All domain logic lives in I3 and I4.

## Gotchas

- **Not the command palette** — the import button lives in Settings → Advanced only. Users who need it will find it; users who don't won't trigger it accidentally.
- **Progress Notice**: `new Notice(msg, 0)` creates a persistent notice. Call `.hide()` explicitly when done. Do not leave it open.
- **Batch size**: vault writes are sequential (one at a time) to avoid overwhelming the vault API. Do not `Promise.all()` the promote calls.
- **Re-entrant guard**: if the user opens settings and clicks Import twice in quick succession, the second click should be blocked while the first batch runs. Disable the button during the operation.
- **`promoteTaskToTTasks` shared function**: extract from `TaskBoard.svelte` into a module importable by both the board's Promote button and this batch loop. Keeps the promote logic in one place.

## Dependencies

- Requires: I1 (parsers), I2 (settings), I3 (fileScanner, ScanEngine), I4 (promote helpers)
- Blocks: nothing (final item in I-stream)
