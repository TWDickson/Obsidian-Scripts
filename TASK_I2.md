---
name: "I2: Capture source configuration"
description: Settings schema, defaults, normalization, and UI for per-directory capture source config
type: feature
stream: I
depends_on: []
---

# I2: Capture Source Configuration

## Goal

Define the settings that drive every part of the ecosystem integration. Configured once, used by the scan engine (I3), promote action (I4), and bulk import (I5). Per-directory control over capture mode, section filtering, date inheritance, and task field defaults.

## Current State

`TTasksSettings` has no integration-related fields. `src/settings/` has per-feature sections (archive, kanban, reminders) but nothing for capture sources.

## What to Create

### I2-A: Types (`src/settings/types.ts` additions)

```typescript
export interface CaptureSourceDefaults {
  area: string | null;
  labels: string[];
  status: string | null;              // null = plugin inboxStatus at runtime
  priority: Task['priority'] | null;  // null = 'None'
  assignedTo: string | null;
}

export interface CaptureSourceConfig {
  path: string;                       // vault-relative directory path
  includeSubdirectories: boolean;
  mode: 'auto-capture' | 'manual' | 'auto-promote';
  sectionFilter: string;              // '' = whole file; 'Tasks' = under ## Tasks only
  inheritDateFromFilename: boolean;   // parse ISO date from filename → start_date / due_date
  defaults: CaptureSourceDefaults;
}

// Additions to TTasksSettings:
// captureSources: CaptureSourceConfig[];
// captureSourceDefaultMode: CaptureSourceConfig['mode'];
// captureSourceDefaultDefaults: CaptureSourceDefaults;
```

### I2-B: Defaults + normalization (`src/settings/defaults.ts` additions)

```typescript
export const DEFAULT_CAPTURE_SOURCE_DEFAULTS: CaptureSourceDefaults = {
  area: null,
  labels: [],
  status: null,
  priority: null,
  assignedTo: null,
};

export const DEFAULT_CAPTURE_SOURCE_CONFIG: Omit<CaptureSourceConfig, 'path'> = {
  includeSubdirectories: true,
  mode: 'auto-capture',
  sectionFilter: '',
  inheritDateFromFilename: true,
  defaults: DEFAULT_CAPTURE_SOURCE_DEFAULTS,
};

// In normalizeSettings():
captureSources: asArray(root.captureSources).map(normalizeCaptureSource),
captureSourceDefaultMode: asOneOf(root.captureSourceDefaultMode,
  ['auto-capture', 'manual', 'auto-promote'], 'auto-capture'),
captureSourceDefaultDefaults: normalizeCaptureSourceDefaults(root.captureSourceDefaultDefaults),

// Pure helpers:
export function normalizeCaptureSource(raw: unknown): CaptureSourceConfig
export function normalizeCaptureSourceDefaults(raw: unknown): CaptureSourceDefaults
```

Normalization handles old saved configs missing new fields (e.g. `inheritDateFromFilename` absent → default `true`).

### I2-C: Auto-detection on plugin load

On `onload()`, after settings are loaded, TTasks checks whether daily and periodic note folders are already present in `captureSources`. If not, it injects them using `obsidian-daily-notes-interface`:

```typescript
export function buildAutoDetectedSources(app: App): CaptureSourceConfig[]
// Uses getDailyNoteSettings(), getWeeklyNoteSettings(), etc.
// Returns one CaptureSourceConfig per detected folder (with defaults applied)
// Returns [] if no daily/periodic notes plugin is loaded

export function mergeAutoDetectedSources(
  existing: CaptureSourceConfig[],
  detected: CaptureSourceConfig[],
): CaptureSourceConfig[]
// Injects detected sources that are not already present (matched by path)
// Does NOT overwrite existing entries — user config is preserved
```

### I2-D: Settings UI (`src/settings/captureSourcesSettingsSection.ts`)

A dedicated collapsible section in the settings tab, rendered after the main task settings:

**Global defaults row:**
- Default mode dropdown: Auto-capture / Manual / Auto-promote
- Applied when user adds a new directory without specifying a mode

**Auto-detected sources** (one row per detected folder, path is read-only):
- Path label (read-only)
- Mode dropdown
- Section filter text input
- Date inheritance toggle
- Expand arrow → shows Defaults sub-form (area, labels, status, priority, assignedTo)

**Additional directories** (user-managed list):
- [+ Add directory] button → opens path picker or text input
- Each entry: same fields as auto-detected, plus a [Remove] button

**Rollover warning banner** (conditional):
- Appears at top of section if `detectRolloverPlugin(app)` returns true
- Text: "⚠️ Rollover Daily Todos detected. Promoted tasks become wiki-links that rollover copies harmlessly. Unpromoted captured tasks may appear duplicated across days."

```typescript
export function detectRolloverPlugin(app: App): boolean
// Checks app.plugins.plugins for known rollover plugin IDs:
// 'obsidian-rollover-daily-todos'
// Extend list as other rollover plugins are identified
```

## Acceptance Criteria

- [ ] `CaptureSourceConfig` and `CaptureSourceDefaults` in `settings/types.ts` with 0 TS errors
- [ ] `normalizeCaptureSource` handles all missing fields gracefully
- [ ] `mergeAutoDetectedSources` does not duplicate an existing path
- [ ] `detectRolloverPlugin` returns correct boolean for known plugin IDs
- [ ] Settings UI renders auto-detected and user-added sources correctly
- [ ] Saving settings persists all fields
- [ ] Rollover banner visible when rollover plugin installed, hidden otherwise
- [ ] `npm run build` clean

## Tests (≥8) — `src/settings/captureSourcesSettings.test.ts`

- `normalizeCaptureSource`: missing `inheritDateFromFilename` → defaults `true`
- `normalizeCaptureSource`: missing `defaults.labels` → defaults `[]`
- `normalizeCaptureSource`: missing `mode` → defaults `'auto-capture'`
- `mergeAutoDetectedSources`: detected path not in existing → injected
- `mergeAutoDetectedSources`: detected path already in existing → not duplicated
- `mergeAutoDetectedSources`: existing entry config not overwritten by detected
- `detectRolloverPlugin`: returns true for known rollover plugin ID (mocked)
- `detectRolloverPlugin`: returns false when plugin absent

## Implementation Order (TDD)

1. Add types to `settings/types.ts`
2. Write `captureSourcesSettings.test.ts` — all tests red
3. Add `normalizeCaptureSource`, `normalizeCaptureSourceDefaults`, `mergeAutoDetectedSources`, `detectRolloverPlugin` to `settings/defaults.ts`
4. Implement until tests green
5. Add `captureSourcesSettingsSection.ts` UI
6. Wire into `SettingsTab.ts`

## Principles

**TDD**: All pure normalization and detection helpers test-first.
**DRY**: `normalizeCaptureSource` reuses existing `asArray`, `asOneOf`, `asString` helpers from `defaults.ts`.
**SOLID**: Types (types.ts) separate from defaults/normalization (defaults.ts) separate from auto-detection (pure fn) separate from UI (settingsSection).
**SoC**: Auto-detection logic is a pure function — testable without an App instance (use a mock).

## Gotchas

- `obsidian-daily-notes-interface` must be added to `package.json` devDependencies before this is implemented.
- `getDailyNoteSettings()` from the interface package handles the priority chain (Periodic Notes → core Daily Notes) automatically. Do not read `.obsidian/` JSON directly.
- Auto-detected folder paths can be `''` (vault root) if the user hasn't configured a folder. Skip injecting a source for empty paths.
- `captureSourceDefaultDefaults` is a separate settings field from `DEFAULT_CAPTURE_SOURCE_DEFAULTS` — the former is user-configurable at runtime, the latter is the code-level fallback.

## Dependencies

- Requires: nothing (no parser dependency)
- Blocks: I3 (scan engine reads `captureSources` from settings)
