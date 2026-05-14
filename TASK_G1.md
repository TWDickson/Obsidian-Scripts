---
name: "G1: Reminder snooze + per-task override"
description: Add snooze to reminder notices (dismiss for N hours) and per-task reminder override (urgent or mute)
type: feature
---

# G1: Reminder snooze + per-task override

## Goal

Once a reminder fires, it's dismissed for the entire day (via localStorage dedup). There's no way to say "remind me again in 4 hours" or "never remind me about this task." Add snooze and per-task override.

## Current State

`ReminderService` (`src/reminders.ts`):
- Fires Obsidian `Notice` for each triggered reminder rule
- Uses `localStorage` key per `(taskPath, rule, date)` to deduplicate within a day
- Runs every 30 minutes via `registerInterval`
- No snooze mechanism; no per-task override field

The `Task` type has no reminder-related fields beyond `due_date`, `start_date`, `status_changed`.

## What to Create

### 1. Pure snooze helpers (TDD first)

```typescript
// src/store/reminderSnooze.ts

export interface SnoozedTask {
  path: string;
  until: string; // ISO timestamp
}

export function snoozeTask(
  current: Record<string, string>,
  path: string,
  hours: number,
  now: Date,
): Record<string, string> {
  const until = new Date(now.getTime() + hours * 3_600_000).toISOString();
  return { ...current, [path]: until };
}

export function unsnoozeTask(
  current: Record<string, string>,
  path: string,
): Record<string, string> {
  const { [path]: _, ...rest } = current;
  return rest;
}

export function isSnoozed(
  snoozed: Record<string, string>,
  path: string,
  now: Date,
): boolean {
  const until = snoozed[path];
  if (!until) return false;
  return new Date(until).getTime() > now.getTime();
}

export function purgeSnoozed(
  snoozed: Record<string, string>,
  now: Date,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [path, until] of Object.entries(snoozed)) {
    if (new Date(until).getTime() > now.getTime()) {
      result[path] = until;
    }
  }
  return result;
}
```

### 2. Per-task override field

Add to the `Task` type (optional, no-schema-change required for existing tasks):

```typescript
// types.ts — add to Task:
reminder_override?: 'urgent' | 'mute' | null;
```

In `TaskStore.fileToTask()`:
```typescript
reminder_override: (fm.reminder_override === 'urgent' || fm.reminder_override === 'mute')
  ? fm.reminder_override : null,
```

In `TaskWriter.update()`, add `reminder_override` to the `fields` array so it persists via `processFrontMatter`.

### 3. Snooze state persistence

Stored in `localStorage` as a separate key from the fire-dedup key:
```typescript
private readonly snoozeKey = `ttasks-snoozed-v1`;

private loadSnoozed(): Record<string, string> {
  try {
    const raw = localStorage.getItem(this.snoozeKey);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

private saveSnoozed(snoozed: Record<string, string>): void {
  localStorage.setItem(this.snoozeKey, JSON.stringify(snoozed));
}
```

### 4. ReminderService changes

Before firing a reminder for a task:
```typescript
// 1. Check mute override
if (task.reminder_override === 'mute') return; // skip entirely

// 2. Check snooze
if (isSnoozed(this.loadSnoozed(), task.path, new Date())) return;

// 3. Skip quiet hours UNLESS task is marked urgent
if (!quietHoursActive || task.reminder_override === 'urgent') {
  // fire notice
}
```

After firing, show a "Snooze" action on the Notice:
```typescript
const notice = new Notice(`TTasks: ${message}`, 0); // 0 = no auto-dismiss
const snoozeBtn = notice.noticeEl.createEl('button', { text: 'Snooze 4h', cls: 'tt-notice-snooze' });
snoozeBtn.addEventListener('click', () => {
  const snoozed = snoozeTask(this.loadSnoozed(), task.path, 4, new Date());
  this.saveSnoozed(purgeSnoozed(snoozed, new Date()));
  notice.hide();
});
```

### 5. UI in task detail

In `TaskDetailActions.svelte` or `TaskDetail.svelte`, add a small "Reminders" section with a dropdown:
```svelte
<select bind:value={reminderOverride} on:change={() => saveImmediate({ reminder_override: reminderOverride || null })}>
  <option value="">Default</option>
  <option value="urgent">Urgent (ignore quiet hours)</option>
  <option value="mute">Mute (never remind)</option>
</select>
```

## Acceptance Criteria

### Pure functions
- [ ] `snoozeTask`: adds entry with correct `until` timestamp (now + N hours)
- [ ] `unsnoozeTask`: removes entry, leaves others untouched
- [ ] `isSnoozed`: returns true if `until > now`, false if expired or missing
- [ ] `purgeSnoozed`: removes expired entries, keeps active ones
- [ ] All functions are immutable (return new objects, don't mutate input)

### Behaviour
- [ ] Snoozed tasks don't fire reminders until snooze expires
- [ ] "Mute" override suppresses all reminders for that task permanently
- [ ] "Urgent" override bypasses quiet hours (task still fires during quiet period)
- [ ] "Snooze 4h" button appears on fired reminder notices
- [ ] Clicking "Snooze 4h" hides the notice and prevents re-fire for 4 hours
- [ ] `reminder_override` persists in task frontmatter
- [ ] Existing tasks without `reminder_override` behave identically to before

### Code Quality
- [ ] `reminderSnooze.ts`: 0 TypeScript errors, pure functions, no Obsidian deps
- [ ] `reminderSnooze.test.ts`: ≥12 tests (snooze adds correctly, isSnoozed active, isSnoozed expired, purge keeps/removes, unsnooze, roundtrip, mute/urgent logic is in ReminderService not here)
- [ ] `Task` type updated with optional `reminder_override`
- [ ] `TaskWriter.update()` fields list includes `reminder_override`
- [ ] `TaskStore.fileToTask()` parses `reminder_override` safely
- [ ] Build: `npm run build` clean

## Implementation Order (TDD)

1. Create `reminderSnooze.ts` — pure functions
2. Write `reminderSnooze.test.ts` — red
3. Implement until tests green
4. Add `reminder_override` to `Task` type, `TaskStore.fileToTask()`, `TaskWriter.update()`
5. Add snooze storage + `isSnoozed` guard to `ReminderService`
6. Add "Snooze 4h" button to fired notices
7. Add `reminder_override` dropdown to task detail UI

## Principles

**TDD**: Snooze state management fully tested as pure functions before any integration with Obsidian.
**DRY**: Snooze persistence re-uses existing `localStorage` infrastructure in `ReminderService`. Override logic extends the existing task type with a nullable field.
**SOLID**: Snooze state management (pure fn module) separate from snooze persistence (localStorage) separate from reminder firing logic (ReminderService) separate from UI (task detail).
**SoC**: Whether a task is snoozed (pure function) is separate from what to do about it (reminder service). Per-task frontmatter override (`reminder_override`) is separate from device-local snooze (localStorage).

## Gotchas

- **`Notice` with 0 duration** — `new Notice(msg, 0)` creates a persistent notice. Obsidian supports this. The notice must be manually closed via `.hide()` or the user clicking it.
- **Snooze duration** — 4 hours is the hardcoded default. Future work could make this configurable (1h / 4h / until tomorrow). For now, one button is enough.
- **Quiet hours interaction** — "urgent" override bypasses quiet hours but still fires only once per day per rule (fire-dedup key still applies). This prevents spam even for urgent tasks.
- **purgeSnoozed** — Call on every ReminderService check cycle to keep localStorage lean. Also call when saveSnoozed is called.
- **`reminder_override` in CreateTaskModal** — Not adding to the create flow (too much complexity up front); users set it via task detail after creation.

## Dependencies

- No prior D/E/F work needed — independent.
- Blocks: nothing.
