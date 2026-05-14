---
name: "A4: Split settings.ts into 3 files"
description: Refactor 1869-line settings.ts into types.ts, defaults.ts, and SettingsTab.ts to separate concerns
type: feature
---

# A4: Split settings.ts into 3 files

## Goal

Reduce `src/settings.ts` from 1869 lines to three focused files by separating type definitions, default/normalization logic, and Obsidian UI. This eliminates the SRP violation where one file handles three separate concerns.

## Scope

### Current State

`src/settings.ts` contains:
1. **Type definitions** (~200 lines) — `TTasksSettings` interfaces, enums, constants
2. **Defaults & normalization** (~150 lines) — `DEFAULT_SETTINGS`, `normalizeSettingsFromSources()`, resolve functions
3. **UI implementation** (~1500 lines) — Obsidian `PluginSettingTab` subclass, DOM manipulation, event handlers

### What to Create

**`src/settings/types.ts`** (250 lines)
- All TypeScript interfaces: `TTasksSettings`, `CustomTaskViewDefinition`, `TaskViewPresentation`, etc.
- All enums: `TaskViewRenderer`, `TaskViewHierarchy`, etc.
- All type constants that are used only for type information

**`src/settings/defaults.ts`** (180 lines)
- `DEFAULT_SETTINGS` constant with all default values
- `normalizeSettingsFromSources()` function to merge/validate user settings
- Resolve functions: `resolveCustomViews()`, `resolveViewRegistry()`, etc.
- Helper functions for validation and coercion

**`src/settings/SettingsTab.ts`** (1500 lines)
- Obsidian `PluginSettingTab` subclass implementation
- All DOM manipulation, event handlers, UI state
- Import types from `types.ts`, defaults from `defaults.ts`
- Identical public interface as before

**`src/settings.ts`** (10 lines, compatibility shim)
- Re-export everything from new modules for backward compatibility
- Allows existing imports like `import { TTasksSettings } from '../settings'` to still work

### Key Constraints

1. **Backward compatibility** — Existing imports must not break
2. **No behavior change** — Settings resolution, validation, defaults all identical
3. **Type safety** — Zero TypeScript errors
4. **Data format unchanged** — Serialized settings in vault remain valid

## Deliverables

1. **`src/settings/types.ts`** (new, 250 lines)
   - All interfaces: `TTasksSettings`, `CustomTaskViewDefinition`, `TaskViewPresentation`, etc.
   - All enums and constants
   - Standalone, no dependencies on other settings modules

2. **`src/settings/defaults.ts`** (new, 180 lines)
   - `DEFAULT_SETTINGS: TTasksSettings`
   - `normalizeSettingsFromSources(loaded: any): TTasksSettings` — merge, validate, apply defaults
   - Any resolve/helper functions used during normalization
   - Imports only: `types.ts`, no Obsidian dependencies

3. **`src/settings/SettingsTab.ts`** (new, 1500 lines)
   - Obsidian `PluginSettingTab` subclass
   - Full implementation of settings UI
   - Imports from `types.ts`, `defaults.ts`, and Obsidian modules

4. **`src/settings.ts`** (updated, 10 lines)
   ```typescript
   // Re-export for backward compatibility
   export type { TTasksSettings, CustomTaskViewDefinition, ... } from './settings/types';
   export { DEFAULT_SETTINGS, normalizeSettingsFromSources } from './settings/defaults';
   export { SettingsTab } from './settings/SettingsTab';
   ```

5. **Import path updates** (across codebase)
   - Update all imports in `main.ts`, `TaskStore.ts`, components, etc.
   - Change: `import { TTasksSettings, SettingsTab } from '../settings'`
   - To: `import { TTasksSettings, SettingsTab } from '../settings'` (re-export still works)
   - OR for direct imports: `import { TTasksSettings } from '../settings/types'` (more explicit)

6. **`src/settings/index.ts`** (optional, recommended)
   - Centralize re-exports in `src/settings/index.ts`
   - `src/settings.ts` becomes a simple redirect: `export * from './index'`
   - Makes folder structure explicit

## Acceptance Criteria

### Functionality
- [ ] All settings are loaded correctly (no data loss)
- [ ] Defaults are applied to new settings
- [ ] Normalization validates and coerces user input
- [ ] UI renders all setting options
- [ ] Settings persist to vault correctly
- [ ] Existing vault settings files load without error

### Code Quality
- [ ] `types.ts`: 0 TypeScript errors, no Obsidian imports
- [ ] `defaults.ts`: 0 TypeScript errors, pure functions
- [ ] `SettingsTab.ts`: 0 TypeScript errors
- [ ] No circular imports (types → defaults → nothing; SettingsTab → types + defaults)
- [ ] All imports in codebase updated to use new structure
- [ ] Backward-compatibility re-exports in `settings.ts` work

### Verification
- [ ] Build: `npm run build` succeeds, zero errors
- [ ] Tests: `npm run test` passes (existing settings tests still pass)
- [ ] Manual: Open Obsidian, settings tab loads, can save settings
- [ ] Manual: New vault loads defaults without error
- [ ] Manual: Existing vault settings load without error
- [ ] No console warnings about import paths or missing exports

## Code Hints

### Where to Look

1. **Type definitions in current settings.ts** (~top 200 lines):
   - Search for `export interface TTasksSettings`
   - Search for `export enum` and constants
   - These go into `types.ts`

2. **DEFAULT_SETTINGS constant** (~lines 200–250):
   - Full default settings object
   - All nested properties must be included
   - Copy to `defaults.ts`

3. **normalizeSettingsFromSources()** (~lines 250–350):
   - Function that merges loaded settings with defaults
   - Validates user input
   - Copy to `defaults.ts`

4. **PluginSettingTab implementation** (~lines 350–1869):
   - Class extends `PluginSettingTab`
   - Entire `display()` method
   - All event handlers, UI construction
   - Copy to `SettingsTab.ts`

### Import Dependency Chain

```
types.ts
  ↑ (no dependencies)

defaults.ts
  ↑ imports from types.ts
  
SettingsTab.ts
  ↑ imports from types.ts, defaults.ts, Obsidian

main.ts, TaskStore.ts, components
  ↑ import from settings.ts (re-export shim)
  or from settings/types.ts (direct)
```

### Implementation Order

1. Create `src/settings/types.ts`:
   - Extract all interfaces and enums from current `settings.ts`
   - Copy as-is; no logic changes
   - Verify zero TypeScript errors

2. Create `src/settings/defaults.ts`:
   - Extract `DEFAULT_SETTINGS` constant
   - Extract `normalizeSettingsFromSources()` function
   - Update imports: `import type { TTasksSettings } from './types'`
   - Verify zero TypeScript errors

3. Create `src/settings/SettingsTab.ts`:
   - Extract entire `PluginSettingTab` class
   - Update imports: `import type { ... } from './types'` and `import { DEFAULT_SETTINGS } from './defaults'`
   - Verify zero TypeScript errors

4. Update `src/settings.ts`:
   - Replace content with re-export shim
   - Test: `import { TTasksSettings } from '../settings'` should work

5. Find and update all imports in codebase:
   - `main.ts`: import SettingsTab from '../settings' → should still work
   - `TaskStore.ts`: import TTasksSettings → should still work
   - Any direct imports from settings.ts → update if using direct paths
   - Use grep to find: `from.*settings['\"]` and verify

6. Run tests; fix any import errors

7. Run `npm run build` and verify zero errors

## Gotchas

### Circular Imports

Risk: SettingsTab imports types, types imports from SettingsTab (avoid this!)

**Solution**: Use `import type { }` for type-only imports. Never import a class from types.ts.

**Check**: SettingsTab.ts should only `import type` from types.ts, never `import` (no values).

### Re-export Maintenance

If you add a new type later, remember to:
1. Add it to `types.ts`
2. Re-export it from `settings.ts` (the shim)
3. OR update consuming imports to use direct path

### Obsidian Dependencies

- `types.ts` must NOT import from Obsidian (no App, Plugin, etc.)
- `defaults.ts` must NOT import from Obsidian
- `SettingsTab.ts` can import from Obsidian

Verify: Run `npm run build` with `--strict` to catch import violations.

### Normalization Edge Cases

`normalizeSettingsFromSources()` must handle:
1. Empty/null input → return DEFAULT_SETTINGS
2. Partial input (only some fields set) → fill with defaults
3. Unknown fields (user edited vault JSON) → ignore, don't crash
4. Type mismatches (field is wrong type) → coerce or use default
5. Array migrations (old format vs new) → transform

Test each scenario!

## Dependencies

- **No prior refactoring required** — A4 can run independently
- **Blocks**: A4 should complete before A5 (if A5 touches settings)
- **After A1, A2, A3** complete, this improves code quality overall

## Related Issues

- Settings file is 1869 lines (god object)
- Mixing types, logic, and UI makes testing difficult
- No way to use settings types without including SettingsTab UI code
- New developers confused about what's in settings.ts

---

## Testing Strategy

1. **Unit tests for `defaults.ts`**:
   - Test `normalizeSettingsFromSources` with various inputs
   - Empty, partial, full, malformed
   - Verify defaults applied correctly

2. **Integration tests**:
   - Load plugin with no existing settings → should use defaults
   - Load plugin with old settings → should normalize and preserve values
   - Save settings from UI → verify vault persistence

3. **Import testing**:
   - Verify old imports still work (backward compat)
   - Verify new imports work (direct paths)
   - Verify no circular dependencies (run tsc)
