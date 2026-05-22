---
name: "J2: Constants extraction"
description: Pull all hardcoded magic numbers and repeated string literals out into a central constants file
type: architecture
stream: J
priority: Medium
depends_on: []
---

# J2: Constants Extraction

## Goal

Magic numbers and string literals are scattered across the codebase. Someone changing the reminder poll interval has to grep for `5 * 60 * 1000` and hope they find every instance. String literals for view modes are compared inline with no typo protection. Extract everything to a single constants file so changes have one location and intent is always named.

## Confirmed Issues (with locations)

### Timing constants
| Location | Value | Meaning |
|----------|-------|---------|
| `ReminderService.ts:16` | `5 * 60 * 1000` | Poll interval (5 min) |
| `ReminderService.ts:17` | `8000` | Notice display duration (ms) |
| `main.ts:253` | `60 * 60 * 1000` | Auto-archive check interval (1 hr) |
| `ScanEngine` (future I3) | `300` | Vault modify debounce (ms) |

### Tree/depth limits
| Location | Value | Meaning |
|----------|-------|---------|
| `TaskDetailRelationships.svelte` | `MAX_REL_TREE_DEPTH = 5` | Max relationship tree depth rendered |
| `TaskDetailRelationships.svelte` | `MAX_REL_TREE_NODES = 60` | Max nodes before tree is truncated |

### View mode strings
| Location | Value | Meaning |
|----------|-------|---------|
| `TaskBoard.svelte` (multiple) | `'list'` `'kanban'` `'agenda'` `'graph'` `'archive'` | Renderer type identifiers — compared inline as raw strings |

### Archive settings defaults
| Location | Value | Meaning |
|----------|-------|---------|
| `settings/defaults.ts` | `45` | Default days after completion before auto-archive |
| `ArchiveService.ts` | `'Planner/Archive'` (likely) | Default archive base folder |

### Reminder business rules
| Location | Value | Meaning |
|----------|-------|---------|
| `ReminderService.ts` | `7` (lead-time days) | Days before due to send lead reminder |
| `ReminderService.ts` | `14` (stale-in-progress days) | Days in-progress before stale reminder |

## What to Create

### J2-A: `src/constants.ts` (extend or create)

`src/constants.ts` already exists for some values. Extend it with all missing constants:

```typescript
// Timing
export const REMINDER_POLL_INTERVAL_MS = 5 * 60 * 1_000;  // 5 minutes
export const NOTICE_DURATION_MS = 8_000;
export const AUTO_ARCHIVE_CHECK_INTERVAL_MS = 60 * 60 * 1_000; // 1 hour
export const VAULT_MODIFY_DEBOUNCE_MS = 300;
export const METADATA_CACHE_TIMEOUT_MS = 10_000;  // J1 fallback

// Relationship tree rendering
export const MAX_REL_TREE_DEPTH = 5;
export const MAX_REL_TREE_NODES = 60;

// Renderer type identifiers
export const RENDERER_LIST = 'list' as const;
export const RENDERER_KANBAN = 'kanban' as const;
export const RENDERER_AGENDA = 'agenda' as const;
export const RENDERER_GRAPH = 'graph' as const;
export const RENDERER_ARCHIVE = 'archive' as const;
export type RendererType =
  | typeof RENDERER_LIST | typeof RENDERER_KANBAN
  | typeof RENDERER_AGENDA | typeof RENDERER_GRAPH
  | typeof RENDERER_ARCHIVE;

// Reminder business rules
export const REMINDER_LEAD_DAYS = 7;
export const REMINDER_STALE_DAYS = 14;
export const REMINDER_SNOOZE_HOURS = 4;  // default snooze (G1)

// Archive defaults (mirrors settings/defaults.ts values — source of truth stays there)
export const DEFAULT_ARCHIVE_DAYS_AFTER_COMPLETE = 45;
```

### J2-B: Update all callsites

Replace each hardcoded value with its named constant. This is a mechanical substitution — no logic changes.

Files to update:
- `ReminderService.ts` — timing + rule constants
- `main.ts` — interval constants, `METADATA_CACHE_TIMEOUT_MS` (J1)
- `TaskDetailRelationships.svelte` — tree depth/node limits
- `TaskBoard.svelte` — replace string literals with `RendererType` union
- `ScanEngine.ts` (I3) — debounce constant

### J2-C: `RendererType` adoption in type system

Where `TaskBoard.svelte` and view registry compare renderer strings, switch from `string` to `RendererType`:

```typescript
// Before:
let currentRenderer: string = 'list';
if (currentRenderer === 'kanban') { ... }

// After:
let currentRenderer: RendererType = RENDERER_LIST;
if (currentRenderer === RENDERER_KANBAN) { ... }
```

This makes typos a compile error rather than a silent wrong-branch condition.

## Acceptance Criteria

- [ ] `src/constants.ts` contains all extracted constants with explanatory comments
- [ ] Zero hardcoded timing values remain in `ReminderService.ts` or `main.ts`
- [ ] `MAX_REL_TREE_DEPTH` and `MAX_REL_TREE_NODES` imported from constants in `TaskDetailRelationships.svelte`
- [ ] `RendererType` union used wherever renderer strings are compared
- [ ] No behaviour changes — this is a pure rename refactor
- [ ] All existing tests pass
- [ ] `npm run build` clean with 0 new TS errors

## Tests

No new tests needed — this is a mechanical substitution. The existing test suite covers the behaviour; if any test breaks, that means a constant was given the wrong value.

Run `npm test` before and after — suite must be green both times.

## Implementation Order

1. Read current `src/constants.ts` to see what's already there
2. Add all missing constants in one commit
3. Update callsites file by file (use search-replace)
4. Adopt `RendererType` in `TaskBoard.svelte` + view registry
5. Build check + test run

## Principles

**DRY**: A number that appears in two places already needs to be named. A number that could need to change (poll intervals, depths) definitely needs to be named.
**Self-documenting**: `REMINDER_POLL_INTERVAL_MS` is readable at any callsite. `5 * 60 * 1000` is not.

## Gotchas

- `src/constants.ts` already exists — read it first to avoid duplicating what's already there.
- `RendererType` may already be defined in `src/views/viewRegistry.ts` — if so, re-export from there rather than duplicating in constants.ts.
- The `45` day archive default should remain the **source of truth in `settings/defaults.ts`** — `DEFAULT_ARCHIVE_DAYS_AFTER_COMPLETE` in constants.ts is a reference for documentation only. If you move the default there, ensure `settings/defaults.ts` imports from it rather than defining its own `45`.

## Dependencies

- Requires: nothing (fully independent)
- Blocks: nothing — but J1's `METADATA_CACHE_TIMEOUT_MS` should come from this file
