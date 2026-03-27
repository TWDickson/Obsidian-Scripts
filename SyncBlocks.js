module.exports = {
    entry: start,
    settings: {
        name: "Sync Planner Blocks",
        author: "Taylor Dickson"
    }
};

/**
 * SyncBlocks — scans all Planner/Tasks notes and ensures the `blocks` field
 * on each note is up-to-date with the reverse of `depends_on` relationships.
 *
 * If TaskA.depends_on = [TaskB], then TaskB.blocks should contain TaskA.
 * This script enforces that without removing any manually-added entries.
 */
async function start(params, settings) {
    /** @type {import("./obsidian").App} */
    const app = params.app;
    const dv  = app.plugins.plugins.dataview?.api;

    if (!dv) { new Notice('Dataview plugin not available.', 5000); return; }

    new Notice('Syncing blocks…');

    const pages = dv.pages('"Planner/Tasks"').array();

    // Build map: targetFilePath → Set of filePaths that depend on it
    const blocksMap = new Map();
    for (const p of pages) {
        const deps = p.depends_on;
        if (!deps) continue;
        const depArray = Array.isArray(deps) ? deps : [deps];
        for (const dep of depArray) {
            if (!dep || !dep.path) continue;
            if (!blocksMap.has(dep.path)) blocksMap.set(dep.path, new Set());
            blocksMap.get(dep.path).add(p.file.path);
        }
    }

    let updates = 0;
    const errors = [];

    for (const p of pages) {
        const expectedBlockers = blocksMap.get(p.file.path) || new Set();
        if (expectedBlockers.size === 0) continue;

        const file = app.vault.getAbstractFileByPath(p.file.path);
        if (!file) continue;

        try {
            let changed = false;
            await app.fileManager.processFrontMatter(file, (fm) => {
                const current = Array.isArray(fm.blocks) ? fm.blocks : [];

                // Parse existing block link paths (handle both raw strings and link objects)
                const currentPaths = new Set(
                    current.map(b => {
                        if (!b) return null;
                        const s = String(b);
                        const m = s.match(/\[\[([^\]|]+)/);
                        return m ? m[1].trim() : null;
                    }).filter(Boolean)
                );

                // Add any missing expected blockers
                const toAdd = [];
                for (const bp of expectedBlockers) {
                    const cleanPath = bp.replace(/\.md$/, '');
                    if (!currentPaths.has(cleanPath)) {
                        toAdd.push(`[[${cleanPath}]]`);
                    }
                }

                if (toAdd.length > 0) {
                    fm.blocks = [...current, ...toAdd];
                    changed = true;
                }
            });
            if (changed) updates++;
        } catch (e) {
            errors.push(`${p.file.name}: ${e.message}`);
            console.warn('SyncBlocks error on', p.file.name, e);
        }
    }

    const summary = updates === 0
        ? 'Planner blocks already in sync — no changes needed.'
        : `Synced blocks on ${updates} note${updates === 1 ? '' : 's'}.`;

    new Notice(errors.length
        ? `${summary} (${errors.length} error${errors.length === 1 ? '' : 's'} — see console)`
        : summary);

    if (errors.length) console.error('SyncBlocks errors:', errors);
}
