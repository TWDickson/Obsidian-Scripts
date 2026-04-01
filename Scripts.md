---
creation date: 2025-11-14 16:30
---
# Scripts Folder

In this folder we have custom JS files from our scripts.

We also have `.d.ts` files pulled from the repos to help define APIs for JS's type hint system as well as our local development `code-workspace` file. This folder may appear empty in Obsidian's explorer.

## ⚠️ Mobile / iOS Constraint — Shared Modules

QuickAdd scripts run inside Obsidian's WKWebView on iOS, which means:

- `require()` is unavailable (no Node.js)
- `new Function()` is blocked by iOS Content Security Policy
- `<script>` tag injection is unreliable

**There is no supported way to load another script file at runtime on iOS.** QuickAdd's official docs only document fully self-contained `module.exports` scripts.

### Rule: every script must be self-sufficient on mobile

Any logic shared via `SharedCheckInData.js`, `SharedCheckInStyles.js`, or `SharedQuickAddStyles.js` **must also exist as an inline fallback function** in each consumer script. The pattern used across all scripts is:

```js
// Try to load shared module (works on desktop)
const sharedStyles = await loadScriptModule(app, 'SharedQuickAddStyles.js');
// Fall back to inline copy when module loading fails (iOS)
const getMyModalCss = sharedStyles?.getMyModalCss ?? getFallbackMyModalCss;
```

When updating a shared module (e.g. `SharedQuickAddStyles.js`, `SharedCheckInStyles.js`, `SharedCheckInData.js`), **always mirror those changes into the corresponding `getFallback*` function in every consumer script** that uses it.
