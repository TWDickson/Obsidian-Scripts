---
name: "K4: Fix status_changed transition correctness"
description: Ensure status_changed is computed from pre-update state in TaskWriter.update so status transitions are tracked accurately
type: architecture
stream: K
priority: High
depends_on: []
---

# K4: Fix status_changed Transition Correctness

## Goal

`status_changed` must update only when status truly transitions. Current update ordering risks comparing the new value against itself, causing missed timestamp updates and stale reminder/archive anchor drift.

## Confirmed Issue

In `TaskWriter.update`, frontmatter fields are applied before transition detection. Because `fm.status` may already be overwritten when `computeStatusChanged` runs, `currentStatus` and `nextStatus` can become identical even during a real transition.

## Impact

- Stale-in-progress reminders may not trigger as intended.
- Any behavior using `status_changed` as the source of truth becomes inaccurate.
- Historical state progression in frontmatter is unreliable.

## What To Create

### K4-A: Refactor transition computation in `TaskWriter.update`

- Capture `previousStatus` from frontmatter before applying updates
- Compute transition via `computeStatusChanged(previousStatus, updates.status, today)`
- Apply `status_changed` only when transition is real

### K4-B: Add focused update-path tests

Create tests covering:

- status changes (`Active` -> `In Progress`) updates `status_changed`
- status unchanged does not modify `status_changed`
- updates without `status` do not touch `status_changed`
- null/empty edge cases preserve intended semantics

### K4-C: Verify downstream parity

- Ensure reminder/archive logic keeps expected behavior with corrected field updates

## Acceptance Criteria

- [ ] `status_changed` updates only on true status transitions
- [ ] No-op status writes leave `status_changed` untouched
- [ ] Existing logic for non-status updates remains unchanged
- [ ] Full tests and build pass

## Tests (TDD)

- Add/extend unit tests around `TaskWriter.update` transition behavior
- Keep `statusChanged` pure helper tests intact
- Add regression test reproducing old sequencing bug

## Implementation Order

1. Write failing regression test first
2. Refactor update ordering
3. Verify reminder/archive dependent tests
4. Run full test/build validation

## Suggested Conventional Commit

- `fix(store): compute status_changed from pre-update status`

## Gotchas

- Avoid writing `status_changed` during updates that omit `status`
- Keep frontmatter mutation minimal to reduce unnecessary file churn
