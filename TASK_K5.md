---
name: "K5: TaskBoard subscription lifecycle cleanup"
description: Ensure TaskBoard unsubscribes activeViewMode listener on destroy to prevent duplicate handlers and leaks
type: architecture
stream: K
priority: Medium
depends_on: []
---

# K5: TaskBoard Subscription Lifecycle Cleanup

## Goal

Eliminate subscription lifecycle leakage in `TaskBoard.svelte` by cleaning up all store subscriptions on destroy.

## Confirmed Issue

`TaskBoard.svelte` subscribes to `plugin.activeViewMode` without storing and disposing its unsubscribe function, while other subscriptions in the component are cleaned up. Re-mounts can accumulate handlers.

## Impact

- Duplicate view-mode handling on repeated mount/unmount cycles
- Potential memory growth over long sessions
- Hard-to-debug behavior where events appear to trigger multiple times

## What To Create

### K5-A: Fix subscription cleanup in `TaskBoard.svelte`

- Capture unsubscribe from `plugin.activeViewMode.subscribe`
- Register `onDestroy` cleanup for this unsubscribe
- Keep current behavior unchanged otherwise

### K5-B: Add lifecycle regression test

- Mount/unmount/remount sequence
- Assert only one effective handler path after remount
- Ensure no duplicate side effects

## Acceptance Criteria

- [ ] `activeViewMode` subscription has explicit cleanup
- [ ] No duplicate behavior after remount cycles
- [ ] Existing board behavior remains unchanged
- [ ] Full tests and build pass

## Tests (TDD)

- Add component-level lifecycle test for mount/unmount/remount
- Validate one-shot mode switch handling after remount

## Implementation Order

1. Add failing lifecycle test
2. Implement unsubscribe cleanup
3. Re-run component and full test suites

## Suggested Conventional Commit

- `fix(components): unsubscribe TaskBoard activeViewMode listener on destroy`

## Gotchas

- Keep cleanup symmetric with existing `clearSelectionOnViewChange` teardown
- Avoid introducing ordering issues between multiple onDestroy callbacks
