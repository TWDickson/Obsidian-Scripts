---
name: "H4: Architecture boundary enforcement"
description: Harden architectureBoundaries.test.ts to actively enforce layer separation rules and prevent regression
type: architecture
stream: H
depends_on: []
---

# H4: Architecture Boundary Enforcement

## Goal

`src/integration/architectureBoundaries.test.ts` exists but its current scope is unknown — it may be a placeholder or only enforce a subset of the intended boundaries. Harden it to actively assert that the codebase's layer rules hold, so that future developers cannot accidentally import Obsidian into a pure module without a failing test.

## Current State

- `src/integration/architectureBoundaries.test.ts` exists (unknown scope)
- No documented layer contract in the test suite
- Adding an Obsidian import to `src/query/engine.ts` would currently pass all tests and only fail at runtime on a vault that doesn't have the right context

## Layer Contract

```
┌──────────────────────────────────────────────────────────────┐
│  Obsidian API  (app, vault, workspace, Plugin, TFile, etc.)  │
├──────────────────────────────────────────────────────────────┤
│  main.ts  ← ALLOWED to import Obsidian                       │
│  views/   ← ALLOWED to import Obsidian                       │
│  modals/  ← ALLOWED to import Obsidian                       │
│  store/TaskStore.ts  ← ALLOWED (vault watchers)              │
│  store/TaskWriter.ts ← ALLOWED (vault writes)                │
│  store/ArchiveService.ts ← ALLOWED                           │
│  store/ReminderService.ts ← ALLOWED                          │
│  settings/SettingsTab.ts ← ALLOWED                           │
│  integration/ScanEngine.ts ← ALLOWED (vault watchers)        │
├──────────────────────────────────────────────────────────────┤
│  MUST NOT import Obsidian:                                    │
│  query/engine.ts                                             │
│  query/types.ts                                              │
│  utils/dateUtils.ts                                          │
│  utils/pathUtils.ts                                          │
│  utils/wikiLink.ts                                           │
│  utils/dependencySort.ts                                     │
│  store/statusChanged.ts                                      │
│  store/taskDuplicate.ts                                      │
│  store/taskHierarchy.ts                                      │
│  store/recurrence.ts                                         │
│  store/archiveUtils.ts                                       │
│  store/taskCreateGuards.ts                                   │
│  store/reminderSnooze.ts                                     │
│  store/graph/taskGraph.ts                                    │
│  store/graph/graphTimeline.ts                                │
│  store/graph/graphLaneLayout.ts                              │
│  store/graph/graphCrossingOptimizer.ts                       │
│  store/graph/graphPresentation.ts                            │
│  store/graph/graphQualityMetrics.ts                          │
│  integration/checkboxParser.ts        (I1-A)                 │
│  integration/emojiFieldParser.ts      (I1-B)                 │
│  integration/filenameDateParser.ts    (I1-C)                 │
│  integration/fileScanner.ts           (I3-A)                 │
│  integration/promoteTask.ts           (I4-A)                 │
│  integration/completionSync.ts        (I4-B)                 │
│  integration/importScanner.ts         (I5-A)                 │
│  settings/types.ts                                           │
│  settings/defaults.ts                                        │
└──────────────────────────────────────────────────────────────┘
```

## What to Create / Rewrite

### H4-A: Read current `architectureBoundaries.test.ts`

Before writing anything, read the existing file and assess what it already enforces. Extend it rather than replacing it — preserve any working assertions.

### H4-B: Boundary assertion helper

```typescript
// src/integration/architectureBoundaries.test.ts

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

function readSourceFile(relativePath: string): string {
  const absolute = resolve(__dirname, '../../', relativePath);
  if (!existsSync(absolute)) return ''; // file not yet created (I-stream modules)
  return readFileSync(absolute, 'utf-8');
}

function assertNoObsidianImport(relativePath: string): void {
  const content = readSourceFile(relativePath);
  const hasObsidian = /from ['"]obsidian['"]|require\(['"]obsidian['"]\)/.test(content);
  expect(hasObsidian, `${relativePath} must not import from 'obsidian'`).toBe(false);
}
```

### H4-C: Pure module boundary tests

```typescript
describe('Architecture boundaries — pure modules must not import Obsidian', () => {
  const purePaths = [
    'src/query/engine.ts',
    'src/query/types.ts',
    'src/utils/dateUtils.ts',
    'src/utils/pathUtils.ts',
    'src/utils/wikiLink.ts',
    'src/utils/dependencySort.ts',
    'src/store/statusChanged.ts',
    'src/store/taskDuplicate.ts',
    'src/store/taskHierarchy.ts',
    'src/store/recurrence.ts',
    'src/store/archiveUtils.ts',
    'src/store/taskCreateGuards.ts',
    'src/store/reminderSnooze.ts',
    'src/store/graph/taskGraph.ts',
    'src/store/graph/graphTimeline.ts',
    'src/store/graph/graphLaneLayout.ts',
    'src/store/graph/graphCrossingOptimizer.ts',
    'src/store/graph/graphPresentation.ts',
    'src/store/graph/graphQualityMetrics.ts',
    'src/settings/types.ts',
    'src/settings/defaults.ts',
    // I-stream pure modules (skip if file doesn't exist yet)
    'src/integration/checkboxParser.ts',
    'src/integration/emojiFieldParser.ts',
    'src/integration/filenameDateParser.ts',
    'src/integration/fileScanner.ts',
    'src/integration/promoteTask.ts',
    'src/integration/completionSync.ts',
    'src/integration/importScanner.ts',
  ];

  for (const path of purePaths) {
    it(`${path} has no Obsidian import`, () => {
      assertNoObsidianImport(path);
    });
  }
});
```

### H4-D: Settings layer boundary

```typescript
describe('Architecture boundaries — settings types/defaults have no Obsidian imports', () => {
  it('settings/types.ts', () => assertNoObsidianImport('src/settings/types.ts'));
  it('settings/defaults.ts', () => assertNoObsidianImport('src/settings/defaults.ts'));
});
```

### H4-E: Component coupling check (advisory, not hard failure)

Verify that Svelte components do not import `TaskStore` directly — they should receive data via props or context.

```typescript
describe('Architecture advisory — components should not import TaskStore directly', () => {
  const componentPaths = [
    'src/components/TaskList.svelte',
    'src/components/TaskKanban.svelte',
    'src/components/TaskAgenda.svelte',
    'src/components/TaskDetail.svelte',
    'src/components/TaskRow.svelte',
  ];

  for (const path of componentPaths) {
    it(`${path} does not import TaskStore`, () => {
      const content = readSourceFile(path);
      const importsStore = /from ['"].*TaskStore['"]/.test(content);
      expect(importsStore, `${path} imports TaskStore directly — use props instead`).toBe(false);
    });
  }
});
```

## Acceptance Criteria

- [ ] `architectureBoundaries.test.ts` asserts no Obsidian import in all listed pure modules
- [ ] Adding `import { App } from 'obsidian'` to `src/query/engine.ts` causes a test failure
- [ ] I-stream pure modules (not yet created) are in the list but skipped gracefully when file absent
- [ ] Component coupling checks pass for all current components
- [ ] All existing tests continue to pass
- [ ] `npm run build` clean

## Implementation Order (TDD — inverted)

This is boundary enforcement, so the test-first rule applies inversely: write the assertions, verify they pass against the current codebase, then trust they catch future violations.

1. Read current `architectureBoundaries.test.ts` — assess existing scope
2. Add `assertNoObsidianImport` helper
3. Add all pure module assertions from H4-C
4. Run tests — all should pass (no current violations)
5. Manually add a test `import { App } from 'obsidian'` to `src/query/engine.ts` — verify test fails
6. Remove the manual test import
7. Add settings layer assertions (H4-D)
8. Add component coupling checks (H4-E) — fix any current violations before committing

## Principles

**Living documentation**: The boundary test file is the authoritative spec of the layer contract. Any developer adding a new pure module adds it to this list at the same time.
**Zero false negatives**: `assertNoObsidianImport` uses a regex that matches both ESM (`from 'obsidian'`) and CJS (`require('obsidian')`) — no import form slips through.
**Graceful for in-progress work**: Files that don't exist yet (I-stream) return empty string and pass — the assertion activates automatically once the file is created.

## Gotchas

- **Test reads source files at test time** — this only works if vitest runs in Node (not browser). Confirm `vitest.config.ts` environment is `node` for this test file (not `jsdom` from H1).
- **Path resolution**: `__dirname` in vitest points to the test file's directory. Use `resolve(__dirname, '../../', relativePath)` to reach the project root.
- **Svelte files**: the component coupling check reads `.svelte` files as text — the `import` statements appear in the `<script>` block and are matched by the same regex.
- **Add new pure modules to the list** when they're created. Make this a documented convention in `ttasks/CLAUDE.md`.

## Dependencies

- Requires: nothing (independent — can be done any time)
- Blocks: nothing (enforcement only, no behaviour change)
