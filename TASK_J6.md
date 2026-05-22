---
name: "J6: Type safety — eliminate any casts and add workspace API types"
description: Replace confirmed unsafe `any` casts in main.ts with typed interfaces, preventing silent type errors
type: architecture
stream: J
priority: Low
depends_on: []
---

# J6: Type Safety — Eliminate `any` Casts

## Goal

Three confirmed `any` casts in `main.ts` hide real type gaps. These casts bypass TypeScript's safety net: a typo in a workspace event name or a wrong payload shape will fail silently at runtime rather than at compile time. Define proper interfaces for the Obsidian workspace APIs being used.

## Confirmed Issues

### `main.ts:271` — Workspace `trigger` cast
```typescript
(this.app.workspace as any).trigger('hover-link', payload);
```
`workspace` is cast to `any` to call `trigger()`. If the event name or payload changes, TypeScript won't catch it.

### `main.ts:285` — `SettingsHost` cast
```typescript
const host = this.app as unknown as SettingsHost;
```
Uses `unknown` as an intermediate (safer than `as any`, but still bypasses checks). If `SettingsHost` is defined inline or is an incomplete type, this is a maintenance trap.

### `main.ts:325` — Editor menu event handler
```typescript
(this.app.workspace as any).on('editor-menu', (menu, editor, view) => { ... });
```
Same pattern — workspace cast to `any` to access an event that Obsidian's type definitions don't expose.

## Root Cause

Obsidian's `obsidian.d.ts` doesn't expose all workspace events and methods. Rather than casting to `any` at each callsite, define a module-level extension interface that documents the gap and localises the escape hatch:

```typescript
// One cast, documented, in one place:
const workspace = this.app.workspace as ExtendedWorkspace;
```

## What to Create

### J6-A: `src/types/obsidianExtended.ts`

```typescript
import type { Workspace, Menu, Editor, MarkdownView } from 'obsidian';

/**
 * Obsidian workspace methods and events not included in the official type definitions.
 * These are stable undocumented APIs. If any break on an Obsidian update, errors
 * will surface at runtime in these specific integration points.
 */
export interface ExtendedWorkspace extends Workspace {
  // Hover link preview
  trigger(event: 'hover-link', payload: HoverLinkPayload): void;

  // Editor context menu
  on(
    event: 'editor-menu',
    callback: (menu: Menu, editor: Editor, view: MarkdownView) => void,
  ): EventRef;

  // File context menu
  on(
    event: 'file-menu',
    callback: (menu: Menu, file: TAbstractFile, source: string) => void,
  ): EventRef;
}

export interface HoverLinkPayload {
  event: MouseEvent;
  source: string;
  hoverParent: Element;
  targetEl: Element | null;
  linktext: string;
  sourcePath: string;
}
```

### J6-B: `src/types/settingsHost.ts`

If `SettingsHost` is currently defined inline near its usage, move it to a proper module:

```typescript
export interface SettingsHost {
  // Document what this interface represents and why the cast is needed
  // Include the Obsidian version where this was verified to work
}
```

### J6-C: Update `main.ts`

Replace all three `any` casts with typed alternatives:

```typescript
// Before (line 271):
(this.app.workspace as any).trigger('hover-link', payload);

// After:
import type { ExtendedWorkspace } from './types/obsidianExtended';
const workspace = this.app.workspace as ExtendedWorkspace;
workspace.trigger('hover-link', payload);
```

The cast now happens once, on a named type, with documentation explaining why it exists. All subsequent uses of the extended API go through `workspace` (typed) rather than repeating the cast.

## Acceptance Criteria

- [ ] `src/types/obsidianExtended.ts` defines all extended workspace APIs used in `main.ts`
- [ ] Zero `as any` casts remain in `main.ts`
- [ ] `as unknown as X` casts replaced with proper typed interfaces where possible
- [ ] `npm run build` clean with 0 new TS errors (and same or fewer errors than before)
- [ ] All existing tests pass (no behaviour change)

## Tests

No new unit tests — this is a pure type-level change. The compile-time check is the test:
- `npm run build` must pass with no new errors
- TypeScript's `strict` mode (if enabled) must not flag new issues

If a cast was hiding a real type mismatch, fixing the cast may reveal an underlying bug that needs a separate fix.

## Implementation Order

1. Read `main.ts` lines 260–340 to understand all three cast sites fully
2. Create `src/types/obsidianExtended.ts` with all required interfaces
3. Replace cast at line 271 — build check
4. Replace cast at line 285 (SettingsHost) — build check
5. Replace cast at line 325 — build check
6. Final `npm run build` — must be clean

## Principles

**Localise the escape hatch**: if you must cast, do it once, on a named type, with a comment. Don't scatter `as any` at every callsite — it's impossible to audit.
**Document the gap**: `ExtendedWorkspace` tells future developers exactly which APIs are undocumented, why the cast exists, and where to look if Obsidian updates break something.

## Gotchas

- **`obsidian.d.ts` is the `obsidian` package** installed as a devDependency — it may already define some of these events in newer versions. Read it before defining redundant extensions.
- **Method overloading in `on()`**: TypeScript interfaces support overloaded signatures. Add one `on()` overload per custom event rather than using `(event: string, callback: Function)`.
- **Casting `workspace as ExtendedWorkspace`** is still technically unsafe — if Obsidian changes the event name, the cast won't help. The value is in documentation and auditability, not runtime safety.
- **`SettingsHost`** — if this is just `App` with a specific plugin property, the cast may be eliminable entirely by restructuring how settings are accessed. Investigate before defining a new interface.

## Dependencies

- Requires: nothing (independent)
- Blocks: nothing
