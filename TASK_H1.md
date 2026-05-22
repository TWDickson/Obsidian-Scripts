---
name: "H1: Svelte component tests"
description: Add @testing-library/svelte to cover component rendering and interaction behaviour for the highest-risk components
type: architecture
stream: H
depends_on: []
---

# H1: Svelte Component Tests

## Goal

553+ unit tests cover TypeScript helpers thoroughly, but zero tests verify that Svelte components render correctly or respond to prop changes and user interactions. A bug in `TaskRow.svelte`'s conditional rendering or `BatchActionBar.svelte`'s button callbacks is invisible to the current test suite. Add `@testing-library/svelte` and write tests for the four highest-risk components.

## Current State

- `vitest` is the test runner (already configured)
- No Svelte component tests exist anywhere in the codebase
- Component behaviour is verified only via manual testing and `npm run build`
- Highest-risk components (most conditional logic, most user interaction surface):
  - `TaskRow.svelte` — checkbox, promote button, selection, keyboard focus, expand/collapse
  - `BatchActionBar.svelte` — action buttons gated by eligibility
  - `TaskDetail.svelte` — field editing, debounced save, tab switching
  - `TaskKanban.svelte` — card field visibility toggles, collapse state

## What to Create

### H1-A: Test infrastructure setup

Install and configure `@testing-library/svelte`:

```bash
npm install --save-dev @testing-library/svelte @testing-library/jest-dom jsdom
```

Add to `vitest.config.ts` (or `vite.config.ts`):

```typescript
test: {
  environment: 'jsdom',
  setupFiles: ['./src/test-setup.ts'],
}
```

Create `src/test-setup.ts`:

```typescript
import '@testing-library/jest-dom';
// Mock Obsidian globals not available in jsdom
vi.mock('obsidian', () => ({
  // Minimal mocks: App, Notice, etc. as needed per component
}));
```

Components with Obsidian dependencies (e.g. `app.vault`) need prop-level mocking — pass mock callbacks rather than a real App. Components that follow the "callbacks as props" convention are easiest to test.

### H1-B: `TaskRow.svelte` tests (`src/components/TaskRow.test.ts`)

Focus: conditional rendering based on props, callback invocation.

```typescript
import { render, fireEvent } from '@testing-library/svelte';
import TaskRow from './TaskRow.svelte';

// Representative tests:
// - Renders task name
// - Checkbox renders when selectable=true, hidden when false
// - Checking checkbox calls onSelect with task path
// - Promote button renders when task.external && source_type === 'daily-note'
// - Clicking promote calls onPromote
// - keyboard-focused class applied when keyboardFocused=true
// - Expand button renders when expandable=true
// - Clicking row (not checkbox) calls onOpen
```

**Tests (≥10):**

- Task name rendered in the row
- `selectable=false` → no checkbox in DOM
- `selectable=true` → checkbox present
- Checking checkbox → `onSelect` called with `task.path`
- `keyboardFocused=true` → `.tt-task-focused` class on row element
- `expandable=true` → expand button visible
- `expandable=false` → no expand button
- External task with `source_type='daily-note'` → Promote button visible
- Non-external task → no Promote button
- Clicking Promote button → `onPromote` called

### H1-C: `BatchActionBar.svelte` tests (`src/components/BatchActionBar.test.ts`)

Focus: action button visibility based on `eligibility`, callback invocation.

**Tests (≥8):**

- Renders selected count label (`"3 selected"`)
- `eligibility.canComplete=true` → Complete button visible
- `eligibility.canComplete=false` → Complete button absent
- `eligibility.canArchive=true` → Archive button visible
- `eligibility.canArchive=false` → Archive button absent
- Delete button always visible when bar is rendered
- Clicking Complete → `onComplete` called
- Clicking ✕ → `onClear` called

### H1-D: `TaskDetail.svelte` tests (`src/components/TaskDetail.test.ts`)

Focus: field rendering from task props, tab visibility. Skip save logic (async + vault — better as integration test).

**Tests (≥8):**

- Task name rendered in the name field
- Status rendered correctly
- Priority rendered correctly
- Notes tab renders when task has notes content
- Relationships tab renders when task has depends_on or blocks
- Actions tab always rendered
- Switching tabs changes visible content
- Read-only external task → edit fields disabled or absent

### H1-E: `TaskKanban.svelte` tests (`src/components/TaskKanban.test.ts`)

Focus: card field visibility gated by settings, collapsed column rendering.

**Tests (≥8):**

- Card renders task name
- `kanbanCardFields` includes `'area'` → area badge visible
- `kanbanCardFields` excludes `'area'` → area badge absent
- `kanbanCardFields` includes `'depCount'` + task has deps → dep badge visible
- `kanbanCardFields` includes `'depCount'` + task has no deps → dep badge absent
- Column with `isCollapsed=true` → cards hidden, column narrow
- Column with `isCollapsed=false` → cards visible
- Collapse toggle button calls `onToggleCollapse` with correct column id

## Acceptance Criteria

- [ ] `@testing-library/svelte` installed and vitest configured with `jsdom` environment
- [ ] `src/test-setup.ts` provides minimal Obsidian mocks
- [ ] All 4 component test files created and passing
- [ ] Existing 553+ tests continue to pass (no environment regressions)
- [ ] `npm run build` clean

## Implementation Order

1. Install packages, update vitest config, create `test-setup.ts`
2. Verify existing tests still pass with jsdom environment
3. Write `BatchActionBar.test.ts` first — simplest, no Obsidian deps, pure renderer
4. Write `TaskRow.test.ts`
5. Write `TaskKanban.test.ts`
6. Write `TaskDetail.test.ts` last — most complex

## Principles

**TDD**: Write tests before touching component code. If a test is hard to write, that reveals a component with too many responsibilities.
**SoC**: Components that receive callbacks as props are easy to test. Components that import `plugin` directly are hard — this test effort will surface coupling violations.

## Gotchas

- `jsdom` does not support all CSS properties. Avoid asserting on computed styles — use class presence instead (`.tt-task-focused` rather than `outline: 2px solid ...`).
- Svelte's reactive `$:` statements run synchronously in tests — no `await tick()` needed for prop changes.
- Components that use `getContext()` for Obsidian's `app` need a context wrapper in tests. Prefer refactoring those components to accept `app` as a prop before testing them.
- `@testing-library/svelte` requires Svelte 4 compatible bindings — verify version compatibility before installing.
- Do not mock the entire Obsidian module globally if it breaks existing TS-only tests — scope mocks to component test files only.

## Dependencies

- Requires: nothing (independent, but easier after E1 and E2 land since BatchActionBar and keyboard-focus props will be stable)
- Blocks: nothing
