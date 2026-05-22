---
name: "I1: Pure parsing layer"
description: Three pure, testable modules that underpin all of Stream I — checkbox parser, emoji field parser, date-from-filename parser
type: feature
stream: I
depends_on: []
---

# I1: Pure Parsing Layer

## Goal

All parsing logic for the ecosystem integration lives in pure functions with zero Obsidian dependencies. These modules are written test-first and everything in I2–I5 depends on them. They can be implemented in any order — all three are independent.

## Current State

`src/integration/` directory does not exist. No external task parsing exists in the codebase.

## What to Create

### I1-A: `src/integration/checkboxParser.ts`

Parses any markdown checkbox line into a structured object. The `hasTTasksLink` flag is critical — the scan engine uses it to skip checkboxes that have already been promoted.

```typescript
export interface ParsedCheckbox {
  raw: string;
  statusChar: string;     // character inside [ ] — ' ', 'x', 'X', '-', '>', etc.
  checked: boolean;       // true for 'x' or 'X'
  cancelled: boolean;     // true for '-'
  text: string;           // everything after the checkbox marker, trimmed
  indentLevel: number;    // number of leading spaces / 2
  hasTTasksLink: boolean; // true if text contains [[tasksFolder/...]] — already in system
}

export function parseCheckboxLine(line: string): ParsedCheckbox | null
// Returns null if not a checkbox list item (- [ ], * [ ], 1. [ ] etc.)

export function isTTasksLink(text: string, tasksFolder: string): boolean
// Returns true if text contains a wiki-link whose path starts with tasksFolder
```

**Tests (≥12) — `src/integration/checkboxParser.test.ts`:**

- `- [ ] text` → checked false, text 'text'
- `- [x] text` → checked true
- `- [X] text` → checked true (uppercase)
- `- [-] text` → cancelled true
- `- [>] text` → statusChar '>', checked false, cancelled false
- Non-list line → null
- Two-space indented checkbox → indentLevel 1
- `- [ ]` (no text) → text '', not null
- `- [ ] [[Planner/Tasks/abc|name]]` with tasksFolder='Planner/Tasks' → hasTTasksLink true
- `- [ ] [[SomeOtherNote]]` → hasTTasksLink false
- Tab-indented checkbox → indentLevel calculated correctly
- Numbered list `1. [ ] text` → parsed correctly

### I1-B: `src/integration/emojiFieldParser.ts`

Parses Obsidian Tasks emoji signifiers from a checkbox text string. No Obsidian dependency. Returns clean description + structured fields.

**Emoji → TTasks field map:**

| Symbol | TTasks field | Notes |
|--------|-------------|-------|
| `🔺` or `⏫` | priority = High | Highest/High both map to High |
| `🔼` | priority = Medium | |
| `🔽` or `⏬` | priority = Low | Low/Lowest both map to Low |
| `📅 YYYY-MM-DD` | due_date | Also accepts `📆` `🗓` |
| `🛫 YYYY-MM-DD` | start_date | Wins over scheduled if both present |
| `⏳ YYYY-MM-DD` | start_date | Scheduled; also accepts `⌛` |
| `➕ YYYY-MM-DD` | created | |
| `✅ YYYY-MM-DD` | completed | |
| `❌ YYYY-MM-DD` | — | Cancelled date; sets cancelled = true |
| `🔁 <text>` | recurrence | Text preserved verbatim |

Parse algorithm: strip signifiers right-to-left from the end of the string using `$`-anchored regexes. Append `️?` to each emoji to handle Variation Selector 16. Remaining text is the clean description.

```typescript
export interface ParsedEmojiFields {
  description: string;
  priority: 'High' | 'Medium' | 'Low' | 'None';
  dueDate: string | null;
  startDate: string | null;   // populated from 🛫 or ⏳; 🛫 wins if both present
  createdDate: string | null;
  completedDate: string | null;
  cancelled: boolean;
  recurrence: string | null;
}

export function parseEmojiFields(text: string): ParsedEmojiFields
// Always returns a result — fields are null/default when not present
// description = text after all signifiers stripped
```

**Tests (≥16) — `src/integration/emojiFieldParser.test.ts`:**

- `📅 2026-05-22` → dueDate '2026-05-22'
- `⏳ 2026-05-22` → startDate '2026-05-22'
- `🛫 2026-05-20 ⏳ 2026-05-22` → startDate '2026-05-20' (🛫 wins)
- `⏫` → priority 'High'
- `🔼` → priority 'Medium'
- `🔽` → priority 'Low'
- `🔺` → priority 'High'
- `⏬` → priority 'Low'
- No priority emoji → priority 'None'
- Alternate aliases `📆`, `🗓`, `⌛` → accepted
- VS16 suffix on emoji → still parses
- NBSP before emoji → scrubbed, does not crash
- `❌ 2026-05-22` → cancelled true, completedDate null
- Recurrence text `🔁 every week` → recurrence 'every week'
- All signifiers stripped → description is clean task name only
- No emoji → description = original text, all fields null/default

### I1-C: `src/integration/filenameDateParser.ts`

Extracts ISO dates from a filename (without extension) to infer task dates. First date becomes `start_date`; second becomes `due_date` (range end).

```typescript
export interface ParsedFilenameDates {
  startDate: string | null;  // first ISO date found
  dueDate: string | null;    // second ISO date found (range end), or null
}

export function parseDatesFromFilename(filename: string): ParsedFilenameDates
// filename = basename without extension, e.g. '2026-05-22 Meeting with Bob'
// Finds all /\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/g matches
// First match → startDate; second match → dueDate; rest ignored
```

**Tests (≥10) — `src/integration/filenameDateParser.test.ts`:**

- `2026-05-22 Meeting with Bob` → startDate '2026-05-22', dueDate null
- `Meeting with Bob 2026-05-22` → startDate '2026-05-22', dueDate null
- `2026-05-22 to 2026-05-24 Sprint` → startDate '2026-05-22', dueDate '2026-05-24'
- `2026-05-22` (plain daily note) → startDate '2026-05-22', dueDate null
- `Meeting with Bob` (no date) → both null
- Three dates in filename → first two used, third ignored
- Invalid date `2026-13-99` → not matched (month/day range validation in regex)
- Date mid-word `note2026-05-22end` → extracted (regex finds embedded dates)
- Empty string → both null
- `2026-W21` (weekly note format) → both null (not ISO date pattern)

## Acceptance Criteria

- [ ] All three modules have 0 TypeScript errors
- [ ] All three modules have zero Obsidian imports
- [ ] All tests red before implementation, green after
- [ ] `npm run build` clean after each module
- [ ] `npm test` passes with new tests added to baseline

## Implementation Order (TDD)

All three can be implemented in any order or in parallel — zero dependencies between them.

For each:
1. Create the `.ts` file with type definitions and function signatures only
2. Write `.test.ts` — all tests red
3. Implement until all tests green
4. Build check

## Principles

**TDD**: Every function written test-first. No exceptions.
**DRY**: `parseCheckboxLine` is the single entry point for all checkbox parsing downstream.
**SOLID**: Each module has one responsibility. `isTTasksLink` is pure and separate from `parseCheckboxLine` so callers can supply their own `tasksFolder`.
**SoC**: No Obsidian types, no vault calls, no plugin state — these modules are testable in pure Node.

## Gotchas

- Emoji regex must append `️?` (U+FE0F, Variation Selector 16) to each symbol — some editors insert it silently.
- NBSP (U+00A0) before an emoji breaks parsing — scrub `text.replace(/ /g, ' ')` before parsing.
- `🛫` (start) beats `⏳` (scheduled) when both are present — start is more explicit.
- `❌` (U+274C) is the **cancelled date** field, not "no" or "delete". Do not confuse with `✕` or `×`.
- `parseDatesFromFilename` receives the basename **without extension** — callers must strip `.md` first.
- Month/day range validation in the regex prevents matching `2026-13-99`-style strings.

## Dependencies

- None. Fully independent.
- Blocks: I2 (settings), I3 (scan engine), I4 (promote), I5 (import)
