---
name: "B3: Clarify depends_on/blocks verbiage"
description: Improve UI clarity for task dependency relationships (verbiage and/or icons)
type: enhancement
---

# B3: Clarify depends_on/blocks verbiage

## Issue

Users find `depends_on` and `blocks` relationships confusing:
- "Task A depends on Task B" — does A wait for B, or B wait for A?
- "Task A blocks Task B" — does A prevent B from starting, or vice versa?

Current UI labels don't clearly indicate **direction of causality**. Suggestions:
1. Rename to "Blocked by X" / "Unblocks Y" (directional language)
2. Add icons (⏸️ blocked, ✓ unblocks)
3. Add help text on hover or in modal

## User Decision Needed

**Choose one:**

**Option A: Rename (directional language)**
- `depends_on` → "**Blocked by**" (reads: "Task is blocked by X")
- `blocks` → "**Unblocks**" (reads: "Task unblocks Y")
- Pro: Clear, unambiguous
- Con: Breaks existing UI/labels

**Option B: Add icons + keep names**
- `depends_on` → "Depends on ⏸️" (icon indicates "waiting")
- `blocks` → "Blocks ⏰" (icon indicates "causality")
- Pro: Familiar names, visual reinforcement
- Con: Icons alone may not clarify

**Option C: Hybrid (rename + icons + help text)**
- Rename to "Blocked by" / "Unblocks"
- Add icons for visual reinforcement
- Add modal help text: "Blocked by: This task cannot start until X is complete"
- Pro: Most clarity
- Con: More UI changes

## Acceptance Criteria

*After user selects option:*

- [ ] All dependency labels updated consistently across UI
- [ ] If icons chosen: icons display clearly in list, modal, graph
- [ ] If help text chosen: tooltip/modal text explains relationship direction
- [ ] Frontmatter still uses `depends_on`, `blocks` (internal names unchanged)
- [ ] No TypeScript errors
- [ ] Existing tests pass (data structure unchanged)

## Verification

1. Create Task A
2. Create Task B
3. In Task B, add Task A as a dependency
4. In Task B detail, verify new language/icons clearly show: "B is blocked by A" (or chosen option)
5. In Task A detail, verify relationship shows: "A unblocks B" (or chosen option)
6. In dependency graph, verify direction is visually clear

## Time Estimate

1–2 hours (depends on option chosen: rename only vs rename + icons + help text)

## Implementation Notes

### Option A: Rename Only
- Update `TaskDetailRelationships.svelte` labels
- Update modals, graph labels
- Search codebase for "depends_on" / "blocks" text labels (not field names)
- Update any help text in plugin documentation

### Option B: Icons + Names
- Keep existing labels
- Add icon imports to components (use `lucide-react` or Obsidian icons)
- Add CSS for icon styling
- Update tests if testing text labels

### Option C: Hybrid
- Do Option A (rename)
- Do Option B (add icons)
- Add modal help section explaining relationships
- Update SettingsTab or plugin README with explanation

## Dependencies

- **User decision required** — implementation cannot proceed until option is chosen
- **Blocks**: Nothing (can be done anytime)
- **Blocked by**: Nothing

## Notes

- Decision can be made by looking at existing UI mockups or user testing feedback
- If unsure, recommend Option C (most clarity) for new UI system
- Backwards-compat: frontmatter field names (`depends_on`, `blocks`) never change; only UI labels change
