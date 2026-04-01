# Obsidian Plugin API Reference

Key APIs, patterns, and gotchas for Obsidian plugin development. Sourced from official docs.

## Project structure
- Plugin lives in `.obsidian/plugins/[id]/`. Required: `main.js`, `manifest.json`
- Restart Obsidian after editing `manifest.json`

## Plugin lifecycle
- Extend `Plugin`, implement `onload()` / `onunload()`
- Everything registered via `this.register*()` auto-cleans on unload
- `onUserEnable()` (v1.7.2), `onExternalSettingsChange()` (v1.5.7) available

## Vault API
- `cachedRead(file)` — for display (fast, may be stale)
- `read(file)` — for modify-then-write
- **Prefer `Vault.process()` over `read()` + `modify()`** to avoid data races
- `getAbstractFileByPath()` returns null — always null-check

## FileManager
- `processFrontMatter(file, fn)` — only safe way to mutate frontmatter on existing files
- `renameFile()` — updates all internal links automatically
- `generateMarkdownLink()` — respects user link format preferences

## Views
- Extend `ItemView`, implement `getViewType()`, `getDisplayText()`, `onOpen()`, `onClose()`
- **Never store direct view references** — always re-fetch via `workspace.getLeavesOfType()`
- Call `contentEl.empty()` in `onClose()`

## Modals
- `Modal` — custom, build UI on `contentEl`
- `SuggestModal<T>` — filtered list with custom render
- `FuzzySuggestModal<T>` — easiest fuzzy search
- Always call `contentEl.empty()` in `onClose()`

## Settings
- `PluginSettingTab` + `Setting` class
- `Object.assign()` for merging defaults is shallow — use deep copy for nested settings
- Inputs available: text, textarea, toggle, dropdown, slider, button, color picker, search

## Mobile
- No `addStatusBarItem()` on mobile
- No Node built-ins (`fs`, `path`) — use vault API
- No raw `fetch()` — use `requestUrl()` from `obsidian` instead
- `isDesktopOnly: true` in manifest hides plugin on mobile entirely

## Key imports
```typescript
import {
  App, Plugin, PluginSettingTab, Setting,
  TFile, TFolder, TAbstractFile,
  Vault, Workspace, WorkspaceLeaf,
  ItemView, Modal, SuggestModal, FuzzySuggestModal,
  AbstractInputSuggest,
  Notice, normalizePath, setIcon,
  Menu, Platform, requestUrl, moment,
  MetadataCache, FileManager,
} from 'obsidian';
```

## Patterns
- Use `this.app.workspace.onLayoutReady(() => ...)` before accessing vault on load
- `getFolderByPath()` returns null if folder doesn't exist — check before use
- `getAllLoadedFiles()` returns all TFile + TFolder instances
- `metadataCache.on('changed', (file, data, cache) => ...)` fires after frontmatter is parsed
