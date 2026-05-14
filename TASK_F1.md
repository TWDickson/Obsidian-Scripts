---
name: "F1: Graph lane headers + accessibility"
description: Replace background-band project labels with proper lane header rows; add keyboard focus and ARIA for the graph view
type: enhancement
---

# F1: Graph lane headers + accessibility

## Goal

The graph/overview timeline's project grouping currently uses a low-contrast background band with a small overlaid text label. Users with many projects find it hard to read which lane belongs to which project. Accessibility is also incomplete: bars are not keyboard-focusable and have no ARIA roles.

## Current State

In `TaskGraph.svelte`:
- `definedGroups` renders as `<div class="tt-hybrid-group-band">` (background band) and `<div class="tt-hybrid-group-label">` (overlaid text) — both absolutely positioned within the timeline canvas.
- Group labels use `top: {N}px` positioning — they can overlap task bars.
- Task bars have `role="button"` but are not in the natural tab order and have no `aria-label`.
- No keyboard navigation exists within the timeline.

## What to Create

### 1. Pure layout helper (TDD first)

The lane header needs to know the pixel `top` of each group band. Extract and test:

```typescript
// src/store/graphLaneLayout.ts

export interface LaneHeader {
  key: string;
  label: string;
  topPx: number;
  heightPx: number;
  taskCount: number;
}

export function buildLaneHeaders(
  groups: Array<{ key: string; label: string; startRow: number; endRow: number; taskCount?: number }>,
  rowHeight: number,
  rowGap: number,
  trackPadding: number,
): LaneHeader[] {
  return groups.map(group => ({
    key: group.key,
    label: group.label,
    topPx: trackPadding + group.startRow * (rowHeight + rowGap),
    heightPx: (group.endRow - group.startRow + 1) * rowHeight
             + Math.max(0, group.endRow - group.startRow) * rowGap,
    taskCount: group.taskCount ?? 0,
  }));
}
```

### 2. Lane header sidebar (visual upgrade)

Replace the overlaid `tt-hybrid-group-label` with a **left sidebar** column next to the timeline canvas:

```svelte
<!-- Left-side lane header panel, aligned with canvas rows -->
<div class="tt-hybrid-lane-sidebar" style="height:{definedTrackHeightPx}px;">
  {#each laneHeaders as header (header.key)}
    <div
      class="tt-hybrid-lane-header"
      style="top:{header.topPx}px;height:{header.heightPx}px;"
      role="group"
      aria-label="{header.label} ({header.taskCount} tasks)"
    >
      <span class="tt-lane-title">{header.label}</span>
      <span class="tt-lane-count">{header.taskCount}</span>
    </div>
  {/each}
</div>
<!-- Timeline canvas moves right to accommodate sidebar -->
<div class="tt-hybrid-track-canvas" ...>
  <!-- Remove old tt-hybrid-group-label divs -->
  {#each hybridTimeline.definedGroups as group}
    <div class="tt-hybrid-group-band" style={groupBandStyle(group)}></div>
  {/each}
  <!-- ... task bars ... -->
</div>
```

CSS:
```css
.tt-hybrid-lane-sidebar {
  width: 120px;
  flex-shrink: 0;
  position: relative;
  border-right: 1px solid var(--background-modifier-border);
}
.tt-hybrid-lane-header {
  position: absolute;
  left: 0; right: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 8px;
  border-bottom: 1px solid var(--background-modifier-border);
  overflow: hidden;
}
.tt-lane-title {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tt-lane-count {
  font-size: 0.65rem;
  color: var(--text-faint);
}
```

### 3. Accessibility for task bars

Each task bar already has `role="button"`. Add:
```svelte
<button
  ...
  tabindex="0"
  aria-label="{item.task.name} — {formatDate(item.start)} to {formatDate(item.end)}{item.isInferred ? ' (estimated)' : ''}"
  aria-pressed={$activeTaskPath === item.path}
>
```

Add keyboard handler to bars:
```svelte
on:keydown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    onOpen(item.path);
  }
}}
```

## Acceptance Criteria

### Pure functions
- [ ] `buildLaneHeaders` returns correct `topPx` and `heightPx` for each group
- [ ] Handles single-row group: `heightPx = rowHeight`
- [ ] Handles multi-row group: `heightPx = N * rowHeight + (N-1) * rowGap`
- [ ] Empty groups array returns `[]`

### Visual
- [ ] Lane headers appear as a left-side sidebar panel, not overlaid on bars
- [ ] Each header shows project name (truncated with ellipsis if too long) and task count
- [ ] Background band still shows for visual separation within the canvas
- [ ] Old `.tt-hybrid-group-label` overlaid text is removed

### Accessibility
- [ ] Each lane container has `role="group"` and `aria-label`
- [ ] Each task bar has `aria-label` with name + date range
- [ ] Each task bar has `tabindex="0"` (natural tab order)
- [ ] Task bars respond to Enter/Space for open action
- [ ] Screen reader announces group membership via `role="group"` hierarchy

### Code Quality
- [ ] `graphLaneLayout.ts`: 0 TypeScript errors, pure functions, no Obsidian deps
- [ ] `graphLaneLayout.test.ts`: ≥6 tests (single row, multi-row, padding, zero groups, correct px math)
- [ ] No layout constants hardcoded in the helper — passed as parameters
- [ ] Build: `npm run build` clean

## Implementation Order (TDD)

1. Create `graphLaneLayout.ts` — pure function
2. Write `graphLaneLayout.test.ts` — red (use HYBRID_ROW_HEIGHT, HYBRID_ROW_GAP, HYBRID_TRACK_PADDING constants as inputs)
3. Implement until tests green
4. Update `TaskGraph.svelte` — add sidebar panel, update canvas layout, add ARIA + keyboard to bars
5. Remove old overlaid `tt-hybrid-group-label` divs
6. Adjust `tt-hybrid-track` flex layout to accommodate sidebar width

## Principles

**TDD**: Lane pixel layout logic extracted and tested independently of Svelte.
**DRY**: `buildLaneHeaders` takes the same `startRow/endRow` data already in `HybridTimelineGroupBand` — no new data model.
**SOLID**: Layout math (pure fn) separate from rendering (template) separate from data model (existing `HybridTimelineModel`).
**SoC**: Sidebar header (navigation landmark) separate from canvas body (data visualization). ARIA structure reflects visual structure.

## Gotchas

- **Sidebar width reduces canvas width** — the horizontal percentage positions of bars (`leftPercent`, `widthPercent`) are relative to the canvas width. Sidebar lives OUTSIDE the canvas div, so no recalculation needed.
- **Mobile**: on narrow screens, a 120px sidebar may be too wide. Use a media query to hide the sidebar on mobile and fall back to the overlaid label. Or reduce to 64px on mobile.
- **No-project group**: the "No project" lane should still render a header. Label: "No project" in italics/faint style.
- **Underdefined track**: apply same sidebar treatment to the underdefined track section.

## Dependencies

- No prior D/E work needed — independent.
- Blocks: nothing.
