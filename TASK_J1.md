---
name: "J1: Vault boundary error handling"
description: Add error recovery to all vault I/O operations to prevent partial writes leaving the vault in an inconsistent state
type: architecture
stream: J
priority: High
depends_on: []
---

# J1: Vault Boundary Error Handling

## Goal

Vault I/O calls across ArchiveService, TaskWriter, TaskRelationships, and main.ts have no error recovery. A failed write mid-operation (disk full, file locked, concurrent access) leaves the vault in a partially-updated state with no indication to the user. This is the highest data-integrity risk in the codebase.

## Confirmed Issues

### ArchiveService.ts:68–120 — `archiveTask()`
Three sequential operations with no rollback:
1. Create archive folder (can fail if path is invalid or permissions denied)
2. Move task file to archive
3. Write `archive_history` logbook entry

If step 3 fails after step 2 succeeds, the file is archived but the logbook is missing. If step 2 fails after step 1 succeeds, the folder exists but the file isn't moved. No user feedback in either case.

### TaskRelationships.ts:45–80 — `rewriteRelationshipReferences()`
Iterates backlinks and calls `vault.modify()` for each one sequentially. If a file is deleted between reading the backlinks and rewriting (race condition during bulk operations), the error propagates uncaught and leaves the backlink index inconsistent.

### TaskWriter.ts — `create()` / `update()`
File write operations lack guards for:
- Disk full → silent failure
- File locked by another process → silent failure
- Concurrent modification → last-write-wins, losing intermediate changes

### main.ts:146–157 — Metadata cache resolution
`metadataCache.on('resolved')` is used to start `ReminderService`. If the cache never resolves (large vault, corrupted index), reminders never start and no user feedback is given. No fallback timeout.

### ReminderService.ts:245–250 — `localStorage` access
```typescript
const raw = localStorage.getItem(this.storageKey);
```
No try-catch. In environments where `localStorage` is disabled or quota-exceeded, this throws and the reminder deduplication state is lost — causing reminder spam.

## What to Create

### J1-A: `src/utils/vaultSafe.ts` — Safe vault operation wrappers

```typescript
export interface VaultOpResult<T> {
  ok: boolean;
  value?: T;
  error?: Error;
}

export async function safeRead(
  vault: Vault, file: TFile,
): Promise<VaultOpResult<string>>

export async function safeModify(
  vault: Vault, file: TFile, content: string,
): Promise<VaultOpResult<void>>

export async function safeProcess(
  vault: Vault, file: TFile,
  fn: (content: string) => string,
): Promise<VaultOpResult<void>>
// Uses Vault.process() to avoid read-modify-write races

export function safeLocalStorage(key: string): string | null
// Wraps localStorage.getItem in try-catch, returns null on any error

export function safeLocalStorageSet(key: string, value: string): boolean
// Wraps localStorage.setItem in try-catch, returns false on quota-exceeded
```

All wrappers: catch errors, log them to `console.error`, return `VaultOpResult` so callers can handle gracefully without crashing the UI.

### J1-B: Update `ArchiveService.ts` — transactional archive

Wrap the 3-step archive operation in a try-catch that rolls back on failure:

```typescript
async archiveTask(path: string): Promise<boolean> {
  // Step 1: read task (safe)
  const result = await safeRead(this.vault, file);
  if (!result.ok) { new Notice('Archive failed: could not read task.'); return false; }

  // Step 2: move file
  const moved = await this.safeMove(file, archivePath);
  if (!moved) { new Notice('Archive failed: could not move file.'); return false; }

  // Step 3: write logbook — if this fails, log warning but don't roll back
  // (file is already moved; logbook is best-effort)
  const logged = await safeModify(this.vault, archivedFile, updatedContent);
  if (!logged.ok) {
    console.warn('Archive logbook write failed — task archived but history not recorded.');
  }
  return true;
}
```

### J1-C: Update `TaskRelationships.ts` — per-file error isolation

Wrap each `vault.modify()` call in the backlink rewrite loop in its own try-catch so one failed file doesn't abort rewrites on other files:

```typescript
for (const [filePath, newContent] of writes) {
  const result = await safeModify(vault, file, newContent);
  if (!result.ok) {
    console.error(`TTasks: failed to rewrite relationship in ${filePath}`, result.error);
    // Continue with remaining files — don't abort
  }
}
```

### J1-D: Update `main.ts` — metadata cache fallback

Add a 10-second timeout fallback so ReminderService always starts:

```typescript
const METADATA_CACHE_TIMEOUT_MS = 10_000;

private startServicesWhenReady(): void {
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    this.reminderService.start();
  };

  this.app.metadataCache.on('resolved', start);
  setTimeout(start, METADATA_CACHE_TIMEOUT_MS);
}
```

### J1-E: Update `ReminderService.ts` — safe localStorage

Replace direct `localStorage` calls with `safeLocalStorage` / `safeLocalStorageSet` from `vaultSafe.ts`.

## Acceptance Criteria

- [ ] `vaultSafe.ts` created with all safe wrappers, 0 TS errors
- [ ] `ArchiveService.archiveTask` returns false and shows Notice on each failure mode, no partial vault state
- [ ] `TaskRelationships` backlink rewrite continues after per-file errors, logs failures
- [ ] `ReminderService` starts within 10 seconds even if metadata cache never resolves
- [ ] `localStorage` calls wrapped in try-catch — no crash in private browsing
- [ ] All existing tests pass
- [ ] `npm run build` clean

## Tests (≥10) — `src/utils/vaultSafe.test.ts`

- `safeRead`: returns `{ ok: true, value: content }` on success
- `safeRead`: returns `{ ok: false, error }` when vault throws
- `safeModify`: returns `{ ok: true }` on success
- `safeModify`: returns `{ ok: false, error }` when vault throws
- `safeProcess`: correct content returned on success
- `safeLocalStorage`: returns null when localStorage.getItem throws
- `safeLocalStorage`: returns value when getItem succeeds
- `safeLocalStorageSet`: returns false when setItem throws (quota exceeded)
- `safeLocalStorageSet`: returns true on success
- Archive failure on step 2 → no logbook write attempted

## Implementation Order (TDD)

1. Create `vaultSafe.ts` with all signatures
2. Write `vaultSafe.test.ts` — red
3. Implement until green
4. Update ArchiveService, TaskRelationships, main.ts, ReminderService
5. Run full test suite

## Gotchas

- **`Vault.process()`** is the preferred API for read-modify-write — it uses an internal lock to prevent concurrent modifications. Prefer `safeProcess` over `safeRead` + `safeModify` where both a read and write are needed on the same file.
- **Archive rollback**: rolling back a file move (move it back) is risky — the rollback itself can fail. The pragmatic approach is: if the move succeeds, treat the archive as done, make the logbook best-effort.
- **ReminderService timeout**: the `setTimeout` fallback must be cancelled with `clearTimeout` in `onunload` to avoid starting reminders after the plugin is unloaded.

## Dependencies

- Requires: nothing
- Blocks: nothing (independent hardening)
