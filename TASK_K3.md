---
name: "K3: Exact completion-sync link matching"
description: Replace prefix-based source-line matching with exact normalized wikilink matching and optional resolver fallback
type: architecture
stream: K
priority: High
depends_on: []
---

# K3: Exact Completion-Sync Link Matching

## Goal

Prevent incorrect source checkbox updates by replacing substring/prefix matching with exact task-link matching.

## Confirmed Issue

Current completion sync line lookup matches using substring prefix behavior. If two task paths share prefixes, the wrong line can be selected and modified.

## Design

### Primary matcher: pure normalized equality

- Parse wikilink target from line
- Normalize both target and task path to extensionless canonical form
- Match only on exact equality

### Secondary matcher: optional resolver fallback

- If exact normalized compare fails, optionally use injected resolver
- Keep resolver dependency optional so core logic remains pure/testable

### Non-goals

- No UI changes
- No behavior change to marker update formatting beyond correct line selection

## What To Create

### K3-A: Refactor `src/integration/completionSync.ts`

- Replace prefix line match helper with exact-match helper
- Add optional resolver function signature where needed
- Preserve existing external API behavior unless explicitly improved

### K3-B: Expand `src/integration/completionSync.test.ts`

Add regression coverage for:

- Prefix collision false-positive prevention
- Aliased link exact match
- Non-aliased link exact match
- Path normalization with/without `.md`
- Resolver fallback success when direct string compare cannot match

## Acceptance Criteria

- [ ] Only exact linked task line is updated
- [ ] Prefix collision regression is covered and passes
- [ ] Existing completion sync behavior remains intact for valid matches
- [ ] Core matcher remains pure and unit-testable
- [ ] `npm run test` and `npm run build` pass

## Implementation Order

1. Add failing regression tests first
2. Implement exact matcher + optional resolver fallback
3. Refactor for readability and DRY helper usage
4. Run full test/build validation

## Suggested Conventional Commit

- `fix(integration): use exact wikilink path matching in completion sync`

## Gotchas

- Resolve and compare normalized paths, not display aliases
- Avoid broad resolver usage that adds unnecessary overhead in common cases
- Keep fallback path deterministic and well-documented
