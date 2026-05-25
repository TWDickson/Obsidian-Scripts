---
name: "K6: fileScanner DRY cleanup and intent clarification"
description: Remove redundant area mapping branch in fileScanner and document intended source-of-truth behavior
type: architecture
stream: K
priority: Low
depends_on: []
---

# K6: fileScanner DRY Cleanup And Intent Clarification

## Goal

Remove redundant logic in `fileScanner` and clarify field-mapping intent so parser behavior remains maintainable and predictable.

## Confirmed Issue

`fileScanner.ts` contains a ternary assigning `area` to the same value on both branches, which signals either dead logic or an unfinished decision.

## Impact

- Low runtime risk
- Higher maintenance cost and cognitive load
- Increases chance of future inconsistent mapping behavior

## What To Create

### K6-A: Simplify `area` mapping logic

- Replace redundant ternary with direct assignment
- Ensure behavior is unchanged unless intentionally expanded

### K6-B: Clarify mapping intent in code comments/tests

- Add succinct comment if needed describing source of truth for area/labels/priority defaults
- Add test assertion documenting current expected behavior

### K6-C: Optional follow-up placeholder

- If emoji-driven area extraction is planned, add explicit TODO note referencing future task, rather than ambiguous branch logic

## Acceptance Criteria

- [ ] Redundant `area` ternary removed
- [ ] Behavior remains unchanged (unless explicitly modified with tests)
- [ ] Tests/build pass
- [ ] Parser intent is explicit and easy to read

## Tests (TDD)

- Add or update scanner tests to pin current area-default behavior
- Confirm no regression in parsed task shape

## Implementation Order

1. Add expectation test first
2. Remove redundant branch
3. Re-run integration tests and build

## Suggested Conventional Commit

- `refactor(integration): simplify fileScanner area mapping`

## Gotchas

- Keep this slice behavior-neutral unless product intent explicitly changes
- Avoid mixing this refactor with larger parser feature work
