---
name: "E2: In-board keyboard shortcuts"
description: Add keyboard navigation and quick-action shortcuts within the task board view
type: feature
---

# E2: In-board keyboard shortcuts

## Goal

The board is currently mouse-only for navigation and actions. Power users want to move between tasks and trigger quick actions without lifting hands from the keyboard.

## Target shortcuts

| Key | Action |
|-----|--------|
| `j` / `↓` | Focus next task in list |
| `k` / `↑` | Focus previous task in list |
| `Enter` / `o` | Open focused task in detail panel |
| `s` | Start focused task (quick action) |
| `c` | Complete focused task (quick action) |
| `d` | Defer focused task (quick action) |
| `a` | Archive focused task (if complete) |
| `n` | New task |
| `Escape` | Close detail panel / clear focused task |
| `/` | Focus search bar |

Shortcuts only fire when: board view is open AND no modal/input is focused.

## What to Create

### 1. Pure key routing helper (TDD first)

```typescript
// src/integration/boardKeymap.ts

export type BoardShortcutId =
  | 'next' | 'prev' | 'open' | 'start' | 'complete'
  | 'defer' | 'archive' | 'newTask' | 'escape' | 'search';

export interface KeymapEntry {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  id: BoardShortcutId;
}

export const DEFAULT_KEYMAP: KeymapEntry[] = [
  { key: 'j', id: 'next' },
  { key: 'ArrowDown', id: 'next' },
  { key: 'k', id: 'prev' },
  { key: 'ArrowUp', id: 'prev' },
  { key: 'Enter', id: 'open' },
  { key: 'o', id: 'open' },
  { key: 's', id: 'start' },
  { key: 'c', id: 'complete' },
  { key: 'd', id: 'defer' },
  { key: 'a', id: 'archive' },
  { key: 'n', id: 'newTask' },
  { key: 'Escape', id: 'escape' },
  { key: '/', id: 'search' },
];

export function resolveShortcut(
  event: { key: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean },
  keymap: KeymapEntry[],
): BoardShortcutId | null {
  if (event.altKey) return null; // never intercept Alt combos
  const entry = keymap.find(
    e => e.key === event.key
      && !!e.ctrl === event.ctrlKey
      && !!e.shift === event.shiftKey,
  );
  return entry?.id ?? null;
}

// Guard: is focus inside an input, textarea, or contenteditable?
export function isInputFocused(activeEl: Element | null): boolean {
  if (!activeEl) return false;
  const tag = activeEl.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select'
    || (activeEl as HTMLElement).isContentEditable;
}
```

### 2. `FocusedTaskService` — tracks board-level focus

```typescript
// A writable store owned by TaskBoardView or TaskBoard.svelte
// Tracks which task path is "keyboard focused" (separate from activeTaskPath / detail panel)
const focusedTaskPath: Writable<string | null> = writable(null);
```

### 3. Register handler in `TaskBoardView.ts`

```typescript
// In TaskBoardView.onOpen():
this.registerDomEvent(document, 'keydown', (e: KeyboardEvent) => {
  if (isInputFocused(document.activeElement)) return;
  // only fire when this leaf is active
  if (this.app.workspace.activeLeaf !== this.leaf) return;

  const id = resolveShortcut(e, DEFAULT_KEYMAP);
  if (!id) return;
  e.preventDefault();
  this.handleShortcut(id);
});
```

### 4. `handleShortcut` in TaskBoardView

Dispatches to plugin methods or board Svelte component events:
- `next` / `prev`: advance `focusedTaskPath` through the current view's flat task list
- `open`: set `activeTaskPath` to focused task
- `start/complete/defer/archive`: call `plugin.runQuickAction(action, focusedPath)`
- `newTask`: open `CreateTaskModal`
- `escape`: close detail panel (set `activeTaskPath = null`) or clear focus
- `search`: focus the search `<input>` in the board toolbar

### 5. Visual focus indicator

In `TaskRow.svelte`:
```svelte
export let keyboardFocused: boolean = false;
<!-- ... -->
<li class="tt-task-row" class:tt-task-focused={keyboardFocused} ...>
```

CSS: `.tt-task-focused { outline: 2px solid var(--interactive-accent); border-radius: var(--radius-s, 4px); }`

## Acceptance Criteria

### Pure functions
- [ ] `resolveShortcut` returns correct ID for each keymap entry
- [ ] `resolveShortcut` returns null for unmapped keys
- [ ] `resolveShortcut` returns null when altKey is true
- [ ] `isInputFocused` returns true for input/textarea/select/contenteditable, false otherwise

### Behaviour
- [ ] `j`/`k` navigate through visible tasks in the list view
- [ ] `Enter` or `o` opens the focused task in detail panel
- [ ] `s`, `c`, `d` trigger quick actions on the focused task
- [ ] `a` archives focused task only if it is complete
- [ ] `n` opens the new task modal
- [ ] `Escape` closes detail panel (or clears focus if panel already closed)
- [ ] `/` moves focus to the board search input
- [ ] No shortcuts fire when a modal, dropdown, or text input is focused
- [ ] No shortcuts fire when the board leaf is not the active leaf

### Code Quality
- [ ] `boardKeymap.ts`: 0 TypeScript errors, pure functions, no Obsidian deps
- [ ] `boardKeymap.test.ts`: ≥10 tests (resolveShortcut for each action, null cases, isInputFocused)
- [ ] Handler registered/deregistered cleanly with `registerDomEvent`
- [ ] `focusedTaskPath` cleared when view is closed or task is deleted

### Verification
- [ ] Build: `npm run build` clean
- [ ] Tests: all pass
- [ ] Manual: j/k navigate, Enter opens, Escape closes — no interference with typing

## Implementation Order (TDD)

1. Create `boardKeymap.ts` — pure functions
2. Write `boardKeymap.test.ts` — red
3. Implement until tests green
4. Add `focusedTaskPath` store to `TaskBoard.svelte`
5. Add `keyboardFocused` prop + CSS to `TaskRow.svelte`
6. Register handler in `TaskBoardView.ts`
7. Wire `handleShortcut` — focus navigation + action dispatch

## Principles

**TDD**: Key routing logic fully tested before any DOM wiring.
**DRY**: Re-uses `plugin.runQuickAction()` for all quick actions — no new action logic.
**SOLID**: Key routing (pure), focus tracking (store), action execution (existing plugin methods), registration (TaskBoardView) are all separate.
**SoC**: What a key means (`boardKeymap.ts`) is separate from what happens when that key fires (handler). Guard logic (`isInputFocused`) is pure and reusable.

## Gotchas

- **`j`/`k` conflict with Obsidian's Vim mode** — check if Vim mode is active; if so, skip these bindings (or make them configurable in settings). For now, document that Vim mode users should disable these.
- **Multi-view**: if multiple board leaves are open, only the active leaf should respond to shortcuts.
- **Kanban focus**: `j`/`k` focus navigation only makes sense in list view. In kanban, arrow keys should move between columns (future work). For now, keyboard nav only activates in list renderer.
- **Search input**: `resolveShortcut` must NOT fire when the board's own search input is focused (covered by `isInputFocused`).

## Dependencies

- E1 (batch ops) — parallel, independent (Escape should also clear batch selection if both implemented).
- Blocks: nothing.
