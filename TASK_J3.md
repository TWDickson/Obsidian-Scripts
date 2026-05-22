---
name: "J3: ReminderService decomposition"
description: Split the 99-line check() method and mixed-concern ReminderService into focused, testable units
type: architecture
stream: J
priority: Medium
depends_on: [J2]
---

# J3: ReminderService Decomposition

## Goal

`ReminderService.ts` mixes four distinct concerns in one class, and its `check()` method is confirmed at 99 lines. The class is difficult to test (notice creation requires a DOM), difficult to extend (adding a new rule means modifying the 99-line method), and difficult to reason about (persistence logic is interleaved with rule evaluation). Split it along clean boundaries.

## Confirmed Issues

### `check()` method — 99 lines, 4 concerns interleaved

The method currently:
1. Filters tasks (skip completed, skip muted, check snooze)
2. Evaluates reminder rules (due-today, overdue, lead-time, stale-in-progress)
3. Deduplicates against localStorage fire history
4. Creates and displays Obsidian `Notice` objects with action buttons

These four steps are sequential in one function. Adding a new rule means reading 99 lines to find the right insertion point. Testing deduplication requires mocking the DOM.

### `ReminderService` class — 4 mixed responsibilities

| Concern | Lines (approx) | Should live in |
|---------|---------------|----------------|
| Rule evaluation (when to fire) | 40 | Pure function module |
| Fire deduplication (localStorage) | 25 | `ReminderStorage` |
| Notice creation (DOM manipulation) | 30 | `ReminderNoticeBuilder` |
| Scheduling (interval, lifecycle) | 20 | `ReminderService` (keep here) |

### Duplicate notice creation (lines 165–178 and 181–203)

Two nearly identical code blocks both:
- Create a document fragment
- Append styled text
- Create a `new Notice(fragment, 0)`
- Register a click handler to open the board

The only difference is the button label and handler. Should be one factory function parameterised on those two values.

## What to Create

### J3-A: `src/store/reminderRules.ts` — Pure rule evaluation

No Obsidian dependencies. No DOM. Takes a task and today's date, returns which rules fire.

```typescript
export type ReminderRuleId = 'due-today' | 'overdue' | 'lead-time' | 'stale-in-progress';

export interface FiredReminder {
  ruleId: ReminderRuleId;
  taskPath: string;
  taskName: string;
  message: string;
}

export function evaluateReminders(
  task: Task,
  today: string,             // YYYY-MM-DD
  leadDays: number,          // REMINDER_LEAD_DAYS
  staleDays: number,         // REMINDER_STALE_DAYS
  completionStatus: string,
): FiredReminder[]
// Returns 0–N FiredReminder objects for this task
// Pure: no side effects, no Obsidian deps, easily testable
```

Each rule is a private helper called by `evaluateReminders`:

```typescript
function checkDueToday(task: Task, today: string): FiredReminder | null
function checkOverdue(task: Task, today: string): FiredReminder | null
function checkLeadTime(task: Task, today: string, leadDays: number): FiredReminder | null
function checkStaleInProgress(task: Task, today: string, staleDays: number, completionStatus: string): FiredReminder | null
```

### J3-B: `src/store/reminderStorage.ts` — Persistence concern

Moves localStorage logic out of ReminderService:

```typescript
export interface ReminderStorage {
  hasFired(taskPath: string, ruleId: ReminderRuleId, date: string): boolean;
  markFired(taskPath: string, ruleId: ReminderRuleId, date: string): void;
  clearExpired(today: string): void;
}

export function createReminderStorage(): ReminderStorage
// Wraps localStorage with safeLocalStorage/safeLocalStorageSet from J1
// Key format: `ttasks-reminder-v1:${taskPath}:${ruleId}:${date}`
// clearExpired() removes keys for dates before today
```

### J3-C: `src/store/reminderNoticeBuilder.ts` — Notice factory

Consolidates the two duplicate notice-creation patterns:

```typescript
export interface NoticeAction {
  label: string;
  onClick: () => void;
}

export function buildReminderNotice(
  message: string,
  actions: NoticeAction[],
  durationMs?: number,
): Notice
// Creates a Notice with styled text and action buttons
// durationMs = 0 for persistent notices (requires manual .hide())
// Replaces the two duplicate patterns at lines 165-178 and 181-203
```

### J3-D: Slim `ReminderService.ts` — Scheduling only

After extraction, `ReminderService` becomes a thin orchestrator:

```typescript
export class ReminderService {
  constructor(
    private store: TaskStore,
    private settings: TTasksSettings,
    private openBoard: () => void,
    private storage: ReminderStorage,
  ) {}

  start(plugin: Plugin): void {
    plugin.registerInterval(
      window.setInterval(() => this.runCheck(), REMINDER_POLL_INTERVAL_MS)
    );
  }

  private runCheck(): void {
    const tasks = this.store.getAll();
    const today = localDateString();
    const quietNow = this.isQuietHours();

    for (const task of tasks) {
      if (task.is_complete) continue;
      if (task.reminder_override === 'mute') continue;
      if (isSnoozed(loadSnoozed(), task.path, new Date())) continue;

      const fired = evaluateReminders(
        task, today,
        REMINDER_LEAD_DAYS, REMINDER_STALE_DAYS,
        this.settings.completionStatus,
      );

      for (const reminder of fired) {
        if (this.storage.hasFired(reminder.taskPath, reminder.ruleId, today)) continue;
        if (quietNow && task.reminder_override !== 'urgent') continue;

        buildReminderNotice(reminder.message, [
          { label: 'Open', onClick: () => this.openBoard() },
          { label: 'Snooze 4h', onClick: () => this.snooze(task.path) },
        ]);
        this.storage.markFired(reminder.taskPath, reminder.ruleId, today);
      }
    }
  }
}
```

`runCheck()` is now ~25 lines and reads like plain English.

## Acceptance Criteria

- [ ] `reminderRules.ts` exports `evaluateReminders` with 0 Obsidian imports
- [ ] `reminderStorage.ts` exports `createReminderStorage` with safe localStorage calls
- [ ] `reminderNoticeBuilder.ts` exports `buildReminderNotice` consolidating both patterns
- [ ] `ReminderService.ts` `check()`/`runCheck()` is ≤30 lines
- [ ] No behaviour change — same rules fire on the same conditions
- [ ] All existing reminder tests pass
- [ ] `npm run build` clean

## Tests

### `src/store/reminderRules.test.ts` (≥16 new tests)

- `checkDueToday` fires when due_date = today
- `checkDueToday` does not fire when due_date = tomorrow
- `checkOverdue` fires when due_date is before today and task not complete
- `checkOverdue` does not fire when task is complete
- `checkLeadTime` fires when due_date is within leadDays of today
- `checkLeadTime` does not fire when due_date is beyond leadDays
- `checkLeadTime` does not fire when already past due (overdue handles that)
- `checkStaleInProgress` fires when status is In Progress and status_changed > staleDays ago
- `checkStaleInProgress` does not fire when status_changed is recent
- `checkStaleInProgress` does not fire when task is not in-progress
- `evaluateReminders`: complete task → no rules fire
- `evaluateReminders`: muted task (caller handles) → test that pure fn ignores mute flag
- `evaluateReminders`: multiple rules can fire simultaneously
- Multiple rules for same task → multiple FiredReminder objects returned
- Task with null due_date → due-today and overdue never fire
- Task with null status_changed → stale rule skipped gracefully

### `src/store/reminderStorage.test.ts` (≥8 new tests)

- `hasFired` returns false for unseen key
- `hasFired` returns true after `markFired` called
- `hasFired` returns false for different date
- `markFired` is idempotent
- `clearExpired` removes keys for past dates
- `clearExpired` keeps keys for today
- `createReminderStorage` works when localStorage is unavailable (safe wrapper)
- Storage survives multiple init calls (no duplicate keys)

## Implementation Order (TDD)

1. Write `reminderRules.test.ts` — red
2. Create `reminderRules.ts` — implement until green
3. Write `reminderStorage.test.ts` — red
4. Create `reminderStorage.ts` — implement until green
5. Create `reminderNoticeBuilder.ts` (no unit tests — DOM-dependent; verify via build)
6. Refactor `ReminderService.ts` to use all three new modules
7. Run full test suite — all green

## Principles

**SRP**: Each new module owns exactly one concern. `ReminderService` goes from 4 concerns to 1 (scheduling).
**OCP**: Adding a new reminder rule means adding a `checkNewRule` function and calling it in `evaluateReminders` — no other code changes.
**TDD**: Pure rule evaluation and storage are written test-first. Notice builder is tested via build.

## Gotchas

- `reminderRules.ts` must be **pure** — no `new Date()` inside. Accept `today: string` as parameter so tests control the date.
- The `stale-in-progress` rule uses `resolveStaleDate(task.status_changed, task.start_date)` (already in `statusChanged.ts`) — import that function rather than reimplementing.
- `reminderStorage.ts` key format must be backward-compatible with whatever keys `ReminderService` currently writes to localStorage — check the exact key format before changing it.
- `buildReminderNotice` creates a `Notice` which requires the Obsidian runtime. This file **is** allowed to import from `obsidian` (it's a UI builder, not a pure module). Do NOT add it to the `architectureBoundaries.test.ts` pure-module list.

## Dependencies

- Requires: J2 (for `REMINDER_LEAD_DAYS`, `REMINDER_STALE_DAYS`, `REMINDER_POLL_INTERVAL_MS` constants)
- Requires: J1 (for `safeLocalStorage` in `reminderStorage.ts`)
- Blocks: G1 (snooze integration becomes cleaner after this decomposition)
