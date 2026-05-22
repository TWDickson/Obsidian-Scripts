---
name: "H3: CSS file splitting"
description: Split monolithic styles.css into per-feature files before it becomes unmaintainable
type: architecture
stream: H
depends_on: []
---

# H3: CSS File Splitting

## Goal

The plugin ships a single `styles.css` file. As Streams D–G and I land (kanban badges, column collapse, batch bar, graph sidebar, capture badge, promote button), this file will exceed 1000 lines and become hard to navigate. Split into per-feature files bundled by esbuild — no behaviour change, no visual change, just maintainability.

## Current State

- Single `styles.css` in the plugin root (~400–600 lines, growing)
- `esbuild.config.mjs` bundles only `main.ts` — CSS is copied as-is
- No per-component CSS organisation

## What to Create

### H3-A: Directory structure

```
src/styles/
  base.css          — CSS custom properties, token overrides, resets
  board.css         — TaskBoard toolbar, rail, content layout
  list.css          — TaskList, TaskRow, hierarchy indentation
  kanban.css        — TaskKanban columns, cards, badges, collapse
  detail.css        — TaskDetail, sub-components, field rows
  graph.css         — TaskGraph, timeline, lane sidebar
  agenda.css        — TaskAgenda, date bucket headers
  archive.css       — TaskArchiveView, logbook entries
  modals.css        — CreateTaskModal, QueryEditorModal, ImportConfirmModal
  integration.css   — captured badge, promote button, from-yesterday label
  settings.css      — settings tab layout, section headers
```

`styles.css` in the plugin root becomes a single import file:

```css
@import 'src/styles/base.css';
@import 'src/styles/board.css';
@import 'src/styles/list.css';
@import 'src/styles/kanban.css';
@import 'src/styles/detail.css';
@import 'src/styles/graph.css';
@import 'src/styles/agenda.css';
@import 'src/styles/archive.css';
@import 'src/styles/modals.css';
@import 'src/styles/integration.css';
@import 'src/styles/settings.css';
```

### H3-B: esbuild configuration update

esbuild does not natively process `@import` in CSS by default in the plugin's build config. Two options:

**Option A (recommended) — esbuild CSS bundling:**

Update `esbuild.config.mjs` to include CSS as an entry point:

```javascript
await esbuild.build({
  entryPoints: ['main.ts', 'styles.css'],
  // esbuild automatically follows @import statements
  bundle: true,
  // ... existing config
});
```

esbuild follows `@import` chains and bundles them into a single output `styles.css`. Zero runtime change — Obsidian still loads one file.

**Option B — PostCSS with `postcss-import`:**

Add PostCSS as a build step. More flexibility (future: autoprefixer, nesting) but adds dependencies. Overkill for now — use Option A.

### H3-C: Migration process

1. Create `src/styles/` directory
2. Create each per-feature CSS file (initially empty except a header comment)
3. Move rules from `styles.css` into the appropriate file by selector prefix:
   - `.tt-board-*` → `board.css`
   - `.tt-kanban-*` → `kanban.css`
   - `.tt-task-row*`, `.tt-list-*` → `list.css`
   - `.tt-detail-*` → `detail.css`
   - `.tt-hybrid-*`, `.tt-graph-*` → `graph.css`
   - `.tt-agenda-*` → `agenda.css`
   - `.tt-archive-*` → `archive.css`
   - `.tt-badge-captured`, `.tt-action-promote` → `integration.css`
   - Modal selectors → `modals.css`
   - Settings selectors → `settings.css`
   - Root variables, `.ttask` scoped resets → `base.css`
4. Replace `styles.css` content with `@import` chain
5. Update esbuild config
6. Build and verify output is byte-for-byte identical to pre-split (or diff and confirm only whitespace changes)

## Acceptance Criteria

- [ ] `src/styles/` directory created with all files
- [ ] `styles.css` root file contains only `@import` statements
- [ ] `npm run build` produces a single bundled `styles.css` output
- [ ] Visual output is identical before and after (no rules lost, no order changed)
- [ ] No single CSS file exceeds 200 lines after split
- [ ] New feature CSS (D–G, I-stream) goes into the appropriate per-feature file from day one

## Implementation Order

This is a pure refactor — no behaviour change. Safe to do in one commit.

1. Update `esbuild.config.mjs` to include CSS bundling
2. Verify build still works with existing single-file `styles.css`
3. Create `src/styles/` directory and all target files (empty)
4. Move rules in one pass — largest sections first (kanban, detail, graph)
5. Replace `styles.css` with `@import` chain
6. Build — compare output to pre-split output
7. Load plugin in Obsidian — visual smoke test

## Principles

**SRP**: Each CSS file owns one feature area's visual concerns.
**DRY**: Shared token values stay in `base.css` — no duplication of custom property definitions across files.
**SoC**: CSS organisation mirrors the component organisation in `src/components/`.

## Gotchas

- **CSS rule order matters** — `@import` files are bundled in the order listed. `base.css` must come first (defines custom properties). Other files can be in any order as long as no rule depends on another file's selectors.
- **esbuild CSS bundling resolves paths relative to the CSS file** — `@import 'src/styles/base.css'` from the root `styles.css` should work, but verify the path resolution in `esbuild.config.mjs`.
- **Do not introduce CSS nesting** or other non-standard syntax during the migration. Keep the refactor pure — move rules only, change nothing else.
- **`!important` rules** (needed for Obsidian specificity) must stay exactly as they are. Do not remove them during the migration.
- **Obsidian's `styles.css` loading**: Obsidian loads the file named `styles.css` from the plugin root. The esbuild output must still land there.

## Dependencies

- Requires: nothing (fully independent — can be done any time)
- Blocks: nothing
