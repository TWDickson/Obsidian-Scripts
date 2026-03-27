# Planner System — Project Context

> **CAUTION — `.obsidian/` folder:** Changes here affect live Obsidian config (plugins, hotkeys, community plugin data, workspace layout). Always confirm with the user before editing any file under `.obsidian/`. Prefer editing plugin config files (e.g. `quickadd/data.json`) only when explicitly asked, and never delete or overwrite without showing the user the diff first.

Obsidian-based project/task management system in `Planner/` folder, replacing TickTick.
Tasks live in `Planner/Tasks/` as `{6hex}-{slug}.md` files. The `name` frontmatter field is the human-readable title.

## What's been built

- `Scripts/CreateTask.js` — QuickAdd macro. Custom Modal (no Modal Forms plugin). Creates notes via `app.vault.create()`. Syncs `blocks` on depends_on targets via `app.fileManager.processFrontMatter()`.
- `Scripts/SyncBlocks.js` — Bulk repair script for blocks/depends_on sync.
- `Planner/Tasks.base` — 5-view Bases file: Active Tasks, In Progress, Blocked/Hold, All Tasks, Projects.
- `Planner/_Templates/task.md` — Reference schema/template.
- `.obsidian/plugins/quickadd/data.json` — "New Planner Task" and "Sync Planner Blocks" macros registered.
- `.obsidian/types.json` — All planner property types registered.

## CreateTask.js — current capabilities

- **Type switching** — `project` hides Task Type and Parent Task rows dynamically
- **Dropdown constants at top of file** — edit `CATEGORIES`, `STATUSES`, `PRIORITIES`, `TASK_TYPES` to change all options
- **Blank options** — Category and Task Type both have a `''` first option (no category / none)
- **Priority default = None**
- **Advanced collapsible** (`<details>`) — Status, dates, estimated days, blocked reason, assigned to, notes. Blocked reason only visible when status = Blocked.
- **Live relationship preview** — text tree in the modal updates as name/parent/deps change
- **Mermaid block in note body** — static `flowchart TD` written at creation when parent_task or depends_on are set. Solid arrow = parent containment, dashed arrow = dependency sequencing.
- **Aliased wiki-links** — parent_task and depends_on stored as `[[path|Name]]` so Bases renders the human name instead of the raw path.

## Script patterns

All scripts follow the QuickAdd macro contract:

```js
module.exports = { entry: start, settings: { name: "...", author: "Taylor Dickson" } };
async function start(params, settings) { ... }
```

Key conventions:

- **`params.app`** is the Obsidian `App` instance — all vault/workspace access goes through it.
- **`params.obsidian?.Modal ?? globalThis.Modal`** — how the Obsidian `Modal` class is obtained; always use this pattern, not a direct import.
- **`app.plugins.plugins.dataview?.api`** — Dataview is used for querying notes (`dv.pages('"Planner/Tasks"')`). Always guard with a `if (!dv) { new Notice(...); return; }` check.
- **`app.vault.create(path, content)`** — creates new notes; path is relative to vault root.
- **`app.fileManager.processFrontMatter(file, fm => { ... })`** — the only safe way to mutate frontmatter; Obsidian handles serialisation. Never write raw YAML to update existing notes.
- **`app.vault.getAbstractFileByPath(path)`** — resolves a path string to a `TFile`; check for null before use.
- **`app.workspace.getLeaf('tab').openFile(file)`** — opens a file in a new tab after creation.
- **Frontmatter is built as a raw string** only at creation time (when the file doesn't exist yet). All subsequent mutations use `processFrontMatter`.
- **Aliased wiki-links** — relationships stored as `[[path/without/ext|Human Name]]` so Bases/Dataview renders the name, not the path.
- **Constants at top of file** — `CATEGORIES`, `STATUSES`, `PRIORITIES`, `TASK_TYPES` arrays are defined at the top so options can be changed in one place.
- **`params.abort(message)`** — used to signal a cancelled or aborted macro to QuickAdd.
- **`new Notice(message, ms?)`** — used for all user-facing feedback; available as a global in the Obsidian context.

## Key design decisions

- No Modal Forms plugin — custom Modal gives full control (dynamic search, type switching, live preview).
- `blocks` = reverse index of `depends_on`, auto-synced on task creation and via SyncBlocks macro.
- Flat `Planner/Tasks/` folder — projects and tasks coexist, distinguished by `type` field.
- `Planner/Projects/` is an empty leftover from v1 and can be deleted.

## Installed Plugins

| Plugin | Repo | Purpose |
| ------ | ---- | ------- |
| **ChartsView** | caronchen/obsidian-chartsview-plugin | Chart rendering (AntV) inside notes — bar, line, pie, etc. |
| **Datacore** | blacksmithgu/datacore | Next-gen reactive query engine (successor to Dataview); JS/JSX components, live-updating views |
| **Dataview** | blacksmithgu/obsidian-dataview | SQL-like queries (`TABLE`, `LIST`, `TASK`) over frontmatter; widely supported |
| **Meta Bind** | mProjectsCode/obsidian-meta-bind-plugin | Inline input widgets (buttons, toggles, dropdowns) bound to frontmatter fields |
| **Note Toolbar** | chrisgurney/obsidian-note-toolbar | Per-note or folder-scoped toolbars with buttons/commands |
| **QuickAdd** | chhoumann/quickadd | Macro runner and capture system; used for CreateTask and SyncBlocks scripts |
| **Pomodoro Timer** | eatgrass/obsidian-pomodoro-timer | In-vault Pomodoro sessions, can log to notes |
| **Templater** | SilentVoid13/Templater | Advanced template engine with JS scripting, file/folder hooks, dynamic content |

### Plugin usage notes

- **Datacore vs Dataview** — Datacore is preferred for new views (reactive, faster); Dataview still works and has broader community examples.
- **Meta Bind** — good for adding quick-action buttons (e.g. mark complete, change status) directly on task notes without opening the editor.
- **Templater** — can replace or complement QuickAdd for note creation if more template logic is needed.
- **ChartsView** — available for dashboards/reports if visualising task progress by category, priority, etc.

## What still needs doing

- **TickTick migration** — ~19 Database tasks + non-archive General tasks. TickTick project_id: `aecd485a9bddd323c90911c2`. Options: paste export data or connect TickTick MCP.
- **Validate Tasks.base** — Blocked/Hold dual-status filter may need tweaking after Obsidian reload.
