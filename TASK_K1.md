---
name: "K1: ScanEngine error policy and surfacing contract"
description: Define and implement context-aware error handling for ScanEngine background and user-triggered flows
type: architecture
stream: K
priority: High
depends_on: []
---

# K1: ScanEngine Error Policy And Surfacing Contract

## Goal

ScanEngine currently mixes fire-and-forget background work with awaited user-triggered flows, but error handling is inconsistent. We need a clear, testable policy so failures are either surfaced to users when actionable or logged quietly when background-only.

## Confirmed Issues

### Background flows have no catch handling

- Startup full scan is launched without await/catch.
- Modify/create event rescans are launched without await/catch.
- Result: read or parse failures are silent or become unhandled promise rejections depending on runtime behavior.

### User-triggered flow can be impacted by ScanEngine failures

- Promote flow awaits rescan after source rewrite.
- If rescan fails unexpectedly, user-facing operation quality degrades and feedback is inconsistent.

### No explicit contract for Notice vs log behavior

- Some paths should never spam users.
- Some paths should provide direct feedback.
- Today this decision is implicit and scattered.

## Policy To Implement

### Error classes

- `background_non_blocking`: startup scan, file-watch rescans, previous-day surfacing
- `user_triggered_single`: promote one task
- `user_triggered_bulk`: import/migration operations

### Surfacing rules

- `background_non_blocking`: log only (plugin.log/console), no Notice spam
- `user_triggered_single`: one concise Notice on failure
- `user_triggered_bulk`: aggregate counts and show one summary Notice; detailed failures to log

### Reliability rules

- No ScanEngine method may leave pending unresolved promises on failure
- Failures in one file must not abort processing of unrelated files unless explicitly required
- All catch blocks must include context (operation + file path when applicable)

## What To Create

### K1-A: `src/integration/scanErrorPolicy.ts` (new)

Create a small policy module:

- `type ScanFlowContext = 'background_non_blocking' | 'user_triggered_single' | 'user_triggered_bulk'`
- `handleScanError(context, error, meta)`
- Keeps policy centralized and testable

### K1-B: Harden `src/integration/ScanEngine.ts`

- Wrap `runFullScan`, `rescanFile`, and `surfacePreviousDayTasks` internals with robust try/catch/finally
- Ensure timers/debounce state are always cleaned up
- Ensure all background entry points call policy handler with background context

### K1-C: Wire single-action policy in promote path

- In promote flow, map rescan failure to one concise Notice and log details
- Keep successful promote behavior unchanged

### K1-D: Ensure bulk import continues current aggregate reporting

- Maintain aggregated summary behavior already present
- Route detailed scan/promotion failures through shared policy helper for consistency

## Acceptance Criteria

- [ ] All ScanEngine paths have deterministic error handling
- [ ] Background scan failures do not show user Notices
- [ ] Promote failure due to scan issues shows one clear Notice
- [ ] Bulk import keeps aggregate summary behavior
- [ ] No unresolved promise hangs in failure paths
- [ ] `npm run test` and `npm run build` pass

## Tests (TDD)

Add or extend tests to cover:

- Background rescan read failure -> logged, no Notice
- Promote path rescan failure -> single Notice
- Bulk flow mixed failures -> aggregate summary + detailed logs
- Debounce cleanup runs on both success and failure

## Implementation Order

1. Add policy module + unit tests
2. Refactor ScanEngine internals to use policy
3. Wire promote and import call sites
4. Run full tests and build

## Gotchas

- Avoid duplicate Notices when a caller already handles user feedback
- Keep policy module free of Obsidian UI dependencies where possible (inject notice/log handlers)
- Preserve existing behavior for successful scans
