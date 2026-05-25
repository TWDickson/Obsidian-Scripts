---
name: "K2: Deterministic bounded-concurrency full scan"
description: Speed up full scan using bounded concurrency while preserving deterministic output order
type: architecture
stream: K
priority: High
depends_on:
  - "TASK_K1"
---

# K2: Deterministic Bounded-Concurrency Full Scan

## Goal

Improve full scan performance on larger vaults without sacrificing deterministic ordering. Users generally structure notes intentionally; output order should remain stable and logical across runs.

## Confirmed Issues

### Full scan is serial

- Current implementation reads each source file one-by-one.
- Large capture source sets will scale poorly.

### Naive concurrency risks nondeterministic ordering

- If tasks are appended as file reads complete, ordering becomes completion-time dependent.
- This can cause list jitter, hard-to-debug behavior, and flaky tests.

## Required Behavior

- Read files with bounded concurrency (configurable limit, sensible default)
- Preserve deterministic ordering equivalent to current logical order:
  1. Entry order from capture-source resolution
  2. Line order within each file

## What To Create

### K2-A: deterministic merge strategy in ScanEngine

- Keep an index for each scan entry
- Process entries concurrently
- Store each file result by original index
- Flatten results by index order

### K2-B: shared concurrency utility usage

- Reuse existing concurrency helper if suitable
- If helper extension is needed, add minimal API change and tests

### K2-C: optional scan concurrency setting (if needed)

- If architecture prefers configurability, add a setting with default value
- If not, define a constant and document rationale

## Acceptance Criteria

- [ ] Full scan runs with bounded concurrency
- [ ] Output order is deterministic and stable across runs
- [ ] Behavior parity with previous scan logic for included/excluded files
- [ ] Failures in one entry do not abort all entries
- [ ] `npm run test` and `npm run build` pass

## Tests (TDD)

Add tests for:

- Deterministic ordering under intentionally shuffled completion timing
- Per-file line order preserved after merge
- Partial failure does not prevent other entries from returning
- Concurrency cap respected

## Implementation Order

1. Add failing tests for ordering and failure isolation
2. Implement concurrent processing with index-preserving merge
3. Validate parity against existing scan expectations
4. Run full test/build validation

## Gotchas

- Do not accidentally reorder by file path unless that is current canonical order
- Avoid introducing hidden global mutable state in concurrent loop
- Keep memory usage bounded when scanning many large files
