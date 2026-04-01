module.exports = {
    entry: start,
    settings: {
        name: "Pet Weight Log",
        author: "Taylor Dickson",
        description: `
        Template:
            ---
            creation date: {{VALUE:creation_date}}
            time_recorded: {{VALUE:time_recorded}}
            for_pet: {{VALUE:for_pet}}
            weight: {{VALUE:weight}}
            weight_unit: {{VALUE:weight_unit}}
            hunger_scale: {{VALUE:hunger_scale}}
            ---

            ## Pet weight — {{VALUE:time_recorded}}

            **Pet**
            {{VALUE:for_pet}}

            **Weight**
            {{VALUE:weight}} {{VALUE:weight_unit}}

            **Hunger (1-5)**
            {{VALUE:hunger_scale}}

        URI example (URL-encode JSON/values when used):
        obsidian://quickadd?choice=Pet%20Weight%20Log
                &value-time_recorded=2025-08-22T09:00
                &value-for_pet=%5B%22Personal%2FPets%2FPet%20Identities%2FApollo.md%7CApollo%22%5D
                &value-weight=8.1
                &value-weight_unit=kg
                &value-hunger_scale=1
        `
    }
};

async function loadScriptModule(app, moduleFileName) {
    try { return require(`./${moduleFileName}`); } catch (e) {}
    try { return require(`Scripts/${moduleFileName}`); } catch (e) {}
    try {
        const basePath = app?.vault?.adapter?.basePath;
        if (basePath) return require(`${basePath}/Scripts/${moduleFileName}`);
    } catch (e) {}
    try {
        const source = await app.vault.adapter.read(`Scripts/${moduleFileName}`);
        if (typeof document !== 'undefined' && document.head) {
            const key = `__qaSharedModule_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const script = document.createElement('script');
            script.textContent = `window[${JSON.stringify(key)}] = (function(){ var module = { exports: {} }; var exports = module.exports; ${source}\n; return module.exports; })();`;
            document.head.appendChild(script);
            const loaded = globalThis[key] || null;
            script.remove();
            try { delete globalThis[key]; } catch (e) {}
            if (loaded) return loaded;
        }
    } catch (e) {}
    return null;
}

function getFallbackPatternModalCss(extraCss = '') {
    return `
        /* Section spacing using responsive units */
        .pattern-modal .pattern-row { display:flex; flex-direction:column; gap: clamp(8px, 2.5vw, 12px); width:100%; }
        .pattern-modal .pattern-section { margin: clamp(6px, 1.8vw, 10px) 0; padding: 2px 0; margin-top:0px; }
        /* Question titles: bold, with small gap to options */
        .pattern-modal .pattern-row > label, .pattern-modal .pattern-row > h4 { margin-bottom:2px; display:block; font-weight:600; }
        /* Checkbox rows should use normal weight */
        .pattern-modal .pattern-checkbox { font-weight:400; }
        /* Parenthetical text italicized */
        .pattern-modal .paren { font-style:italic; font-weight:400; }
        /* Slight indent for checkboxes and tighter vertical spacing */
        .pattern-modal .pattern-checkbox { display:flex; align-items:center; gap: clamp(3px, 1vw, 5px); margin: 0 0 clamp(4px, 1.2vw, 6px) 0; padding-left: clamp(8px, 2vw, 12px); cursor: pointer; }
        /* Compact inputs and type sizes */
        .pattern-modal input[type="text"], .pattern-modal input[type="datetime-local"], .pattern-modal select, .pattern-modal textarea { max-width:100%; box-sizing:border-box; font-size: clamp(0.95rem, 1.5vw, 1rem); }
        .pattern-modal .pattern-sep { height:1px; background: var(--background-modifier-border); margin: clamp(8px, 2vw, 10px) 0; }
        .pattern-modal button { margin-top:6px; }
        .pattern-modal .pattern-btn-row { margin-top: 10px; display: flex; gap: 8px; }

        /* Add a heavier down-arrow indicator to select boxes (theme-aware via currentColor) */
        .pattern-modal select {
            background-repeat: no-repeat;
            background-position: right 10px center;
            background-size: 14px 14px;
            padding-right: clamp(26px, 6vw, 30px);
            background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='currentColor' stroke='currentColor' stroke-width='1.2' d='M7 10l5 5 5-5z'/></svg>");
        }

        /* Trigger placeholder: lighter and italic */
        .pattern-modal .pattern-trigger-input::placeholder { font-style: italic; color: var(--text-muted); }

        /* Keep native checkbox appearance via theme; only adjust spacing */
        .pattern-modal .pattern-checkbox input[type="checkbox"] { margin-left: clamp(4px, 1.2vw, 6px); margin-top: 0; align-self: center; vertical-align: middle; transform: translateY(-1px); }
        .pattern-modal .pattern-checkbox span { display:inline-flex; align-items:center; line-height:1.1; padding: 0 clamp(3px, 1vw, 4px); }

        /* 'Other' text input hidden by default; shown when the checkbox is checked (CSS-only) */
        .pattern-modal .pattern-checkbox .other-input { display:none; margin-left:8px; }
        .pattern-modal .pattern-checkbox input[type="checkbox"]:checked ~ .other-input { display:inline-block; }

        /* Mobile-safe modal container to avoid keyboard overlap (uses safe area inset) */
        .is-phone .pattern-modal {
            padding-bottom: var(--safe-area-inset-bottom);
            margin-bottom: 0;
            overflow-x: hidden;
        }

        /* Make modal buttons align in a single responsive row on phones */
        .is-phone .pattern-modal .pattern-btn-row {
            display: flex;
            gap: 8px;
            flex-wrap: nowrap;
            align-items: center;
        }
        .is-phone .pattern-modal .pattern-btn-row button {
            flex: 1 1 auto;
            min-width: 0;
        }

        ${extraCss}
    `;
}

async function start(params, settings) {
    const app = params.app;
    const variables = params.variables = params.variables || {};
    const Modal = params.obsidian?.Modal ?? globalThis.Modal;
    const dataView = app.plugins.plugins.dataview?.api;
    const sharedStyles = await loadScriptModule(app, 'SharedQuickAddStyles.js');
    const getPatternModalCss = sharedStyles?.getPatternModalCss ?? getFallbackPatternModalCss;

    const now = moment();
    // include seconds in the default ISO-like timestamp so filenames and parsing
    // can always rely on seconds being present (e.g. 2025-12-29T11:04:00)
    const default_time_iso = now.format("YYYY-MM-DDTHH:mm:ss");

    // Helper to coerce numbers
    function toNumber(v) {
        if (v === undefined || v === null || v === '') return '';
        const n = Number(v);
        return Number.isFinite(n) ? n : v;
    }

    // Normalize incoming QuickAdd variables which may be strings, JSON-encoded
    // arrays, or actual arrays (Shortcuts sometimes sends JSON arrays).
    function normalizeIncoming(v) {
        if (v === undefined || v === null || v === '') return v;
        // If it's already an array, take the first element
        if (Array.isArray(v)) return v[0];
        // If it's a string, try to parse JSON (common when Shortcuts encodes values)
        if (typeof v === 'string') {
            try {
                const parsed = JSON.parse(v);
                if (Array.isArray(parsed)) return parsed[0];
                return parsed;
            } catch (e) {
                // not JSON — return the raw string
                return v;
            }
        }
        return v;
    }

    const hasPrepop = variables.time_recorded !== undefined ||
        variables.for_pet !== undefined ||
        variables.weight !== undefined ||
        variables.weight_unit !== undefined ||
        variables.hunger_scale !== undefined;

    // If `for_pet` is provided via variables, we'll try to resolve it to a wiki link using Dataview pages.

    // Fetch pet options from Dataview (if available)
    let dvPetPages = [];
    if (dataView) {
        try {
            dvPetPages = (await dataView.pages('"Personal/Pets/Pet Identities"').array()) || [];
        } catch (e) {
            // fallback: try a broader query
            try { dvPetPages = (await dataView.pages('"Personal/Pets"').where(p=>p.file && p.file.path && p.file.path.includes('Pets')).array()) || []; } catch (e) { dvPetPages = []; }
        }
    }
    // Helper: find a pet page from dataview by name or path and return a wiki link string
    function resolvePetLink(input, dvPages) {
        if (!input) return '';
        // If it's already a wiki-link or contains '[[', return as-is
        if (String(input).includes('[[') || String(input).includes('|')) return String(input);
        const s = String(input).trim();
        if (!dvPages || !dvPages.length) return s;
        // try to match by file name (case-insensitive) or path contains
        const found = dvPages.find(p => (p.file && p.file.name && String(p.file.name).toLowerCase() === s.toLowerCase())
            || (p.file && p.file.path && String(p.file.path).toLowerCase().includes(s.toLowerCase())));
        if (found && found.file && found.file.path) {
            const display = found.file.name || found.file.path.split('/').pop();
            return `[[${found.file.path}|${display}]]`;
        }
        return s;
    }

    // When Dataview didn't return pages, still accept plain paths like
    // "Personal/Pets/Pet Identities/Apollo.md" and convert to wiki links.
    // This helper wraps the above behavior to return a wiki link when the
    // input looks like a path or ends with .md.
    function resolvePetLinkOrPath(input, dvPages) {
        if (!input) return '';
        const s = String(input).trim();
        // If already a wiki link or contains a pipe, return as-is
        if (s.includes('[[') || s.includes('|')) return s;
        // If dataview pages exist, prefer the normal resolver which will
        // match by name or path and return a wiki link when found.
        if (dvPages && dvPages.length) return resolvePetLink(s, dvPages);
        // Try to find a matching file in the vault (fallback when Dataview
        // isn't available or didn't return pages). This handles shortcuts
        // that only send a plain name like "Apollo".
        try {
            if (app && app.vault && typeof app.vault.getFiles === 'function') {
                const nameLower = s.toLowerCase();
                const files = app.vault.getFiles();
                // Prefer files under Personal/Pets
                const preferred = files.find(f => {
                    const p = String(f.path || '').toLowerCase();
                    const fileName = String(f.name || '').toLowerCase();
                    return (p.includes('personal/pets') || p.includes('pets')) && (fileName === nameLower || p.endsWith(`/${nameLower}.md`) || p.includes(`/${nameLower}.md`));
                });
                const anyMatch = preferred || files.find(f => {
                    const p = String(f.path || '').toLowerCase();
                    const fileName = String(f.name || '').toLowerCase();
                    return fileName === nameLower || p.includes(`/${nameLower}.md`) || p.includes(nameLower);
                });
                if (anyMatch) {
                    const display = anyMatch.name || anyMatch.path.split('/').pop();
                    return `[[${anyMatch.path}|${display}]]`;
                }
            }
        } catch (e) {
            // ignore vault lookup errors and fall through
        }
        // No dataview results: if the string looks like a path or ends with
        // .md, format it as a wiki link with the filename (without .md)
        if (s.includes('/') || s.toLowerCase().endsWith('.md')) {
            const path = s.replace(/^\.\/?/, '');
            let display = path.split('/').pop();
            if (display.toLowerCase().endsWith('.md')) display = display.slice(0, -3);
            return `[[${path}|${display}]]`;
        }
        return s;
    }
    // Lightweight modal for manual entry (single modal) — always shown during development
    class WeightModal extends Modal {
        constructor(app, resolve, defaultTime) {
            super(app);
            this._resolve = resolve;
            this._resolved = false;
            this.defaultTime = defaultTime;
        }
        onOpen() {
            const { contentEl } = this;
            this.setTitle('Pet Weight Log');

            // Add pattern-modal class and styles to match PatternTracking modal
            try { contentEl.classList.add('pattern-modal'); } catch (e) {}
            const styleEl = contentEl.createEl('style');
            styleEl.textContent = getPatternModalCss(`
                .pattern-modal .pw-error { color: var(--interactive-danger, #c0392b); margin-bottom:6px; font-weight:600; }
            `);

            const row = contentEl.createDiv({ cls: 'pattern-row' });

            // Error element (hidden until validation fails)
            this.errorEl = contentEl.createDiv({ cls: 'pw-error' });
            this.errorEl.style.display = 'none';

            row.createEl('label', { text: 'Time recorded' });
            this.timeInput = row.createEl('input');
            this.timeInput.type = 'datetime-local';
            try { this.timeInput.value = this.defaultTime; } catch (e) { this.timeInput.value = new Date().toISOString().slice(0,16); }

            row.createEl('label', { text: 'For pet' });
            if (dvPetPages && dvPetPages.length) {
                this.petSelect = row.createEl('select');
                const emptyOpt = document.createElement('option');
                emptyOpt.value = '';
                emptyOpt.text = '-- Select pet --';
                this.petSelect.appendChild(emptyOpt);
                dvPetPages.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = `[[${p.file.path}|${p.file.name}]]`;
                    opt.text = p.file.name || p.file.path.split('/').pop();
                    this.petSelect.appendChild(opt);
                });
                const otherOpt = document.createElement('option'); otherOpt.value = 'Other'; otherOpt.text = 'Other (enter manually)'; this.petSelect.appendChild(otherOpt);
                // Prefill selection if variables.for_pet matches an option value exactly
                try {
                    const pref = normalizeIncoming(variables.for_pet);
                    if (pref) {
                        for (let i=0;i<this.petSelect.options.length;i++) {
                            if (this.petSelect.options[i].value === pref) { this.petSelect.selectedIndex = i; break; }
                        }
                        if (this.petSelect.value === 'Other') {
                            // show manual input below
                        }
                    }
                } catch(e) {}
                // Other input (hidden by default)
                this.petOtherInput = row.createEl('input');
                this.petOtherInput.type = 'text';
                this.petOtherInput.placeholder = 'Enter pet link or name';
                this.petOtherInput.style.display = 'none';
                this.petSelect.addEventListener('change', () => {
                    try {
                        if (this.petSelect.value === 'Other') { this.petOtherInput.style.display = 'block'; this.petOtherInput.focus(); }
                        else { this.petOtherInput.style.display = 'none'; this.petOtherInput.value = ''; }
                    } catch (e) {}
                });
            } else {
                this.petInput = row.createEl('input');
                this.petInput.type = 'text';
                this.petInput.placeholder = 'e.g. [[Personal/Pets/Pet Identities/Apollo.md|Apollo]] or Apollo';
                this.petInput.style.width = '100%';
                try { this.petInput.value = variables.for_pet || ''; } catch (e) {}
            }

            row.createEl('label', { text: 'Weight' });
            this.weightInput = row.createEl('input');
            this.weightInput.type = 'number';
            this.weightInput.step = '0.1';
            this.weightInput.placeholder = 'e.g. 8.1';
            try { if (variables.weight) this.weightInput.value = variables.weight; } catch(e){}

            // Clear error when user edits weight
            this.weightInput.addEventListener('input', () => { try { this.errorEl.style.display = 'none'; this.errorEl.setText(''); } catch(e){} });

            row.createEl('label', { text: 'Unit' });
            this.unitSelect = row.createEl('select');
            ['kg','lb'].forEach(u => { const opt = document.createElement('option'); opt.value = u; opt.text = u; this.unitSelect.appendChild(opt); });

            row.createEl('label', { text: 'Hunger (1-5)' });
            this.hungerInput = row.createEl('input');
            this.hungerInput.type = 'number';
            this.hungerInput.min = '1';
            this.hungerInput.max = '5';
            this.hungerInput.step = '1';
            try { this.hungerInput.value = (variables.hunger_scale !== undefined && variables.hunger_scale !== '') ? variables.hunger_scale : '1'; } catch(e){}
            this.hungerInput.addEventListener('input', () => { try { this.errorEl.style.display = 'none'; this.errorEl.setText(''); } catch(e){} });

            const btnRow = contentEl.createDiv({ cls: 'pattern-btn-row' });
            const saveBtn = btnRow.createEl('button', { text: 'Save' });
            saveBtn.addEventListener('click', () => this.save());
            const cancelBtn = btnRow.createEl('button', { text: 'Cancel' });
            cancelBtn.addEventListener('click', () => this.cancel());
        }

        save() {
            if (this._resolved) return;
            // Inline validation: pet required, weight required > 0, hunger must be integer 1-5
            const rawPetVal = (this.petSelect ? (this.petSelect.value === 'Other' ? (this.petOtherInput ? this.petOtherInput.value.trim() : '') : this.petSelect.value) : (this.petInput ? this.petInput.value.trim() : (variables.for_pet || '')));
            const petVal = resolvePetLinkOrPath(rawPetVal, dvPetPages);
            if (!petVal || String(petVal).trim() === '') {
                try { this.errorEl.setText('Please select or enter a pet.'); this.errorEl.style.display = 'block'; } catch(e){}
                return;
            }

            const weightRaw = this.weightInput ? this.weightInput.value : '';
            const weightVal = weightRaw === '' ? '' : Number(weightRaw);
            const hungerRaw = this.hungerInput ? this.hungerInput.value : '';
            const hungerVal = hungerRaw === '' ? 1 : Number(hungerRaw);
            if (weightVal === '' || !Number.isFinite(weightVal) || weightVal <= 0) {
                try { this.errorEl.setText('Please enter a valid weight greater than 0.'); this.errorEl.style.display = 'block'; } catch(e){}
                return;
            }
            if (hungerVal === '' || !Number.isFinite(hungerVal) || !Number.isInteger(hungerVal) || hungerVal < 1 || hungerVal > 5) {
                try { this.errorEl.setText('Hunger must be an integer between 1 and 5.'); this.errorEl.style.display = 'block'; } catch(e){}
                return;
            }

                const data = {
                    // normalize modal time to include seconds
                    time_recorded: this.timeInput ? moment(this.timeInput.value).format('YYYY-MM-DDTHH:mm:ss') : default_time_iso,
                    for_pet: petVal,
                    weight: weightVal,
                    weight_unit: this.unitSelect ? this.unitSelect.value : 'kg',
                    hunger_scale: hungerVal
                };
            this._resolved = true;
            this._resolve(data);
            this.close();
        }
        cancel() {
            if (this._resolved) return;
            this._resolved = true;
            this._resolve(null);
            this.close();
        }
        onClose() { this.contentEl.empty(); }
        static prompt(app, defaultTime) {
            return new Promise((resolve) => { const m = new WeightModal(app, resolve, defaultTime); m.open(); });
        }
    }

    let result;
    if (hasPrepop) {
        // Normalize possible array/JSON values before using
        const raw_for_pet = normalizeIncoming(variables.for_pet);
        const raw_weight = normalizeIncoming(variables.weight);
        const raw_hunger = normalizeIncoming(variables.hunger_scale);
        // normalize time and ensure seconds are present
        const raw_time = normalizeIncoming(variables.time_recorded) || default_time_iso;
        const normalized_time = moment(raw_time).format('YYYY-MM-DDTHH:mm:ss');
        result = {
            time_recorded: normalized_time,
            for_pet: raw_for_pet || '',
            weight: toNumber(raw_weight),
            weight_unit: normalizeIncoming(variables.weight_unit) || 'kg',
            hunger_scale: (raw_hunger === undefined || raw_hunger === '') ? 1 : toNumber(raw_hunger)
        };
        // If for_pet was provided as a plain name, try to resolve via Dataview
        try { result.for_pet = resolvePetLink(result.for_pet, dvPetPages); } catch (e) {}
        console.log('Using prepopulated PetWeight variables:', result);
        // Validate prepopulated values: pet present, weight > 0, hunger 1-5
        const pw = result.weight;
        const hg = result.hunger_scale;
        const petProvided = result.for_pet && String(result.for_pet).trim() !== '';
        const invalidWeight = (pw === '' || pw === undefined || !Number.isFinite(Number(pw)) || Number(pw) <= 0);
        const invalidHunger = (hg === '' || hg === undefined || !Number.isFinite(Number(hg)) || !Number.isInteger(Number(hg)) || Number(hg) < 1 || Number(hg) > 5);
        if (!petProvided || invalidWeight || invalidHunger) {
            try { new Notice('Prepopulated values invalid: please provide pet, weight (>0) and hunger (1-5)', 6000); } catch (e) {}
            if (params.abort) params.abort('Invalid prepopulated values');
            return;
        }
    } else {
        result = await WeightModal.prompt(app, default_time_iso);
    }

    if (!result) {
        console.log('PetWeight cancelled');
        if (params.abort) params.abort('Cancelled');
        return;
    }

    // Map into QuickAdd variables for template use
    variables.creation_date = moment().format('YYYY-MM-DD HH:mm');
    variables.time_recorded = result.time_recorded;
    variables.for_pet = result.for_pet;
    variables.weight = result.weight;
    variables.weight_unit = result.weight_unit || 'kg';
    variables.hunger_scale = result.hunger_scale !== undefined ? result.hunger_scale : 1;

    // filename using recorded time (or now) in the format: 2025-08-22T09-00-00_pet_weight
    const fileDateTitle = (() => {
        try {
            // Use the recorded time when available; moment will fill seconds as 00 if missing
            const t = variables.time_recorded || moment();
            return moment(t).format('YYYY-MM-DDTHH-mm-ss');
        } catch (e) {
            return moment().format('YYYY-MM-DDTHH-mm-ss');
        }
    })();
    variables.fileName = `${fileDateTitle}_pet_weight`;

    try {
        console.log('Pet weight variables set:', JSON.parse(JSON.stringify(variables)));
    } catch (e) {
        // Fallback to original proxy log if stringify fails
        console.log('Pet weight variables set (raw):', variables);
    }
}
