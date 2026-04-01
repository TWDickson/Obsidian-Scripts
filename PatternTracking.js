module.exports = {
    entry: start,
    settings: {
        name: "Pattern Tracking Script",
        author: "Taylor Dickson",
        description: `
        Template:
            ---
            entry_date: {{VALUE:entry_date}}
            pattern_tracking: {{VALUE:trigger}}
            pattern_tracking_did_pause: {{VALUE:did_pause}}
            pattern_tracking_body_signals: {{VALUE:body_signals}}
            pattern_tracking_what_i_did: {{VALUE:what_i_did}}
            pattern_tracking_discomfort_felt: {{VALUE:discomfort_felt}}
            pattern_tracking_discomfort_duration_minutes: {{VALUE:discomfort_duration}}
            pattern_tracking_discomfort_outcome: {{VALUE:discomfort_happened}}
            ---

            ## Pattern Tracking — {{VALUE:entry_date_title}}

            **Trigger**
            {{VALUE:trigger}}

            **Body signals**
            {{VALUE:body_signals}}

            **Did I pause?** {{VALUE:did_pause}}

            **What I did**
            {{VALUE:what_i_did}}

            **What I actually wanted**
            {{VALUE:wanted}}

            **Discomfort**
            - felt: {{VALUE:discomfort_felt}}
            - duration_minutes: {{VALUE:discomfort_duration}}
            - outcome: {{VALUE:discomfort_happened}}

        URI Setup: Note this is human readable and must be url encoded when used.
        obsidian://quickadd?choice=Pattern Tracking
                &value-entry_date=2025-12-23T10:00
                &value-trigger=Conversation%20with%20therapist
                &value-body_signals=["Heart racing/chest tight","Stomach knots"]
                &value-what_i_did=["Stayed silent","Other"]
                &value-did_pause=Yes
                &value-wanted=To%20ask%20for%20help
                &value-discomfort_felt=Hot%20flush%20and%20shakiness
                &value-discomfort_duration=5
                &value-discomfort_happened=Nothing%20bad%20happened
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
    /** @type {import("./Quickadd").quickAddApi} */
    const _quickAddApi = params.quickAddApi;
    /** @type {import("./obsidian").App} */
    const app = params.app;
    // Use Modal passed in via QuickAdd params if available (fixes previous typo `obsidan`).
    /** type {import("./obsidian").Modal} */
	const Modal = params.obsidian?.Modal ?? globalThis.Modal;
    const variables = params.variables
    /** @type {import("./modalforms").api} */
    const modalForms = app.plugins.plugins.modalforms?.api
    const sharedStyles = await loadScriptModule(app, 'SharedQuickAddStyles.js');
    const getPatternModalCss = sharedStyles?.getPatternModalCss ?? getFallbackPatternModalCss;

	const entryDate = moment();
    const entry_date_iso = entryDate.format(); // For frontmatter
    const entry_date_title = entryDate.format("YYYY-MM-DDTHH-mm"); // For filename/title (no seconds)

    // Feature flags: set these for your phased rollout
    // Weeks 1-2: Observation Only -> TRACK_PAUSE = false, TRACK_DISCOMFORT = false
    // Weeks 3-4: Add the Pause -> TRACK_PAUSE = true, TRACK_DISCOMFORT = false
    // Weeks 5+: Full Form -> TRACK_PAUSE = true, TRACK_DISCOMFORT = true
    // Set them to true/false as needed before running the script.
    const TRACK_PAUSE = false;
    const TRACK_DISCOMFORT = false;

    // Pattern Tracking modal: returns structured data via Promise
    class PatternModal extends Modal {
        constructor(app, resolve) {
            super(app);
            this._resolve = resolve;
            this._resolved = false;
            this.bodySignals = [
                'Heart racing/chest tight',
                'Stomach knots',
                'Muscles tensing',
                'Urge to shrink/disappear',
                'Jaw clenching',
                'Throat tight/pressure',
                'Scared/anxious wave',
                'Bracing/scanning',
                'Other'
            ];
            this.actionOptions = [
                'Apologized',
                'Took on task',
                'Minimized my need',
                'Justified/explained',
                'Stayed silent',
                'Used new script',
                'Other'
            ];
        }

        onOpen() {
            const { contentEl } = this;
            this.setTitle('Pattern Tracking');

            // Add a scoped class and minimal, theme-safe styles for spacing/layout
            try {
                contentEl.classList.add('pattern-modal');
            } catch (e) {}
            const styleEl = contentEl.createEl('style');
            styleEl.textContent = getPatternModalCss();

            // Helper to create a label with parenthetical text wrapped in <span class="paren">
            const createLabelWithParen = (container, text) => {
                const el = container.createEl('label');
                el.innerHTML = String(text).replace(/\(([^)]+)\)/g, ' <span class="paren">($1)</span>');
                return el;
            };
            const createHeadingWithParen = (container, text) => {
                const el = container.createEl('h4');
                el.innerHTML = String(text).replace(/\(([^)]+)\)/g, ' <span class="paren">($1)</span>');
                return el;
            };

            const row = contentEl.createDiv({ cls: 'pattern-row' });

            // Entry date (editable when modal shown)
            row.createEl('label', { text: 'Entry date' });
            this.entryDateInput = row.createEl('input');
            this.entryDateInput.type = 'datetime-local';
            // default to the script-generated timestamp (local portion)
            try {
                this.entryDateInput.value = entryDate.format("YYYY-MM-DDTHH:mm");
            } catch (e) {
                this.entryDateInput.value = new Date().toISOString().slice(0,16);
            }

            // Trigger
                createLabelWithParen(row, 'Trigger');
            this.triggerInput = row.createEl('input');
            this.triggerInput.className = 'pattern-trigger-input';
            this.triggerInput.type = 'text';
            this.triggerInput.placeholder = 'What happened to trigger the pattern?';
            this.triggerInput.style.width = '100%';

            // Body Signals (checkboxes)
                createLabelWithParen(row, 'Body Signals (what I noticed in my body)');
            this.bodySignalInputs = {};
            this.bodySignalOther = {};
            const bsContainer = row.createDiv({ cls: 'pattern-section' });
            this.bodySignals.forEach((sig) => {
                const id = 'bs_' + sig.replace(/[^a-z0-9]+/gi,'_');
                // Use a label wrapper so clicking the row toggles the checkbox natively
                const wrapper = bsContainer.createEl('label', { cls: 'pattern-checkbox' });
                const input = wrapper.createEl('input', { type: 'checkbox' });
                input.id = id;
                const span = wrapper.createEl('span', { text: sig });
                this.bodySignalInputs[sig] = input;

                // If this option is Other, add a text input that will be shown via CSS when checked
                if (sig === 'Other') {
                    const otherInput = wrapper.createEl('input');
                    otherInput.type = 'text';
                    otherInput.placeholder = 'Describe other...';
                    otherInput.className = 'other-input';
                    this.bodySignalOther[sig] = otherInput;
                    // Autofocus the other input when the checkbox is checked
                    input.addEventListener('change', () => {
                        if (input.checked) {
                            // allow CSS to reveal input first
                            setTimeout(() => { try { otherInput.focus(); } catch (e) {} }, 0);
                        } else {
                            otherInput.value = '';
                        }
                    });
                }
            });

            // visual separator
            contentEl.createEl('div', { cls: 'pattern-sep' });

            // Did I Pause? dropdown (conditionally shown based on TRACK_PAUSE)
            if (TRACK_PAUSE) {
                row.createEl('label', { text: 'Did I Pause?' });
                this.didPauseSelect = row.createEl('select');
                ['Yes','No','Partially'].forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = v;
                    opt.text = v;
                    this.didPauseSelect.appendChild(opt);
                });
            } else {
                this.didPauseSelect = null;
            }

            // What I Did (checkboxes)
            row.createEl('label', { text: 'What I Did' });
            this.actionInputs = {};
            this.actionOther = {};
            const actContainer = row.createDiv({ cls: 'pattern-section' });
            this.actionOptions.forEach((act) => {
                const id = 'act_' + act.replace(/[^a-z0-9]+/gi,'_');
                const wrapper = actContainer.createEl('label', { cls: 'pattern-checkbox' });
                const input = wrapper.createEl('input', { type: 'checkbox' });
                input.id = id;
                const span = wrapper.createEl('span', { text: act });
                this.actionInputs[act] = input;

                if (act === 'Other') {
                    const otherInput = wrapper.createEl('input');
                    otherInput.type = 'text';
                    otherInput.placeholder = 'Describe other...';
                    otherInput.className = 'other-input';
                    this.actionOther[act] = otherInput;
                    // Autofocus when checked
                    input.addEventListener('change', () => {
                        if (input.checked) {
                            setTimeout(() => { try { otherInput.focus(); } catch (e) {} }, 0);
                        } else {
                            otherInput.value = '';
                        }
                    });
                }
            });

            // visual separator
            contentEl.createEl('div', { cls: 'pattern-sep' });

            // What I Actually Needed/Wanted
            row.createEl('label', { text: 'What I Actually Needed/Wanted' });
            this.wantedInput = row.createEl('textarea');
            this.wantedInput.style.width = '100%';
            this.wantedInput.style.minHeight = '4em';

            // Discomfort Note (conditionally shown based on TRACK_DISCOMFORT)
            if (TRACK_DISCOMFORT) {
                createHeadingWithParen(row, 'Discomfort Note (when you paused or tried something new)');
                row.createEl('label', { text: 'What the discomfort felt like' });
                this.discomfortFelt = row.createEl('textarea');
                this.discomfortFelt.style.width = '100%';

                createLabelWithParen(row, 'How long it lasted? (minutes)');
                this.discomfortDuration = row.createEl('input');
                this.discomfortDuration.type = 'number';
                this.discomfortDuration.min = '0';
                this.discomfortDuration.step = '1';
                this.discomfortDuration.inputMode = 'numeric';
                this.discomfortDuration.placeholder = 'minutes';

                createLabelWithParen(row, 'What actually happened (feared outcome vs. reality)');
                this.discomfortHappened = row.createEl('textarea');
                this.discomfortHappened.style.width = '100%';
            } else {
                this.discomfortFelt = null;
                this.discomfortDuration = null;
                this.discomfortHappened = null;
            }

            // Buttons
            const btnRow = contentEl.createDiv({ cls: 'pattern-btn-row' });
            const saveBtn = btnRow.createEl('button', { text: 'Save' });
            saveBtn.addEventListener('click', () => this.save());
            const cancelBtn = btnRow.createEl('button', { text: 'Cancel' });
            cancelBtn.addEventListener('click', () => this.cancel());
        }

        save() {
            if (this._resolved) return;
            const bodySignals = Object.entries(this.bodySignalInputs)
                .filter(([,el]) => el.checked)
                .map(([k]) => k);
            const actions = Object.entries(this.actionInputs)
                .filter(([,el]) => el.checked)
                .map(([k]) => k);

            // Compact normalization: replace 'Other' with provided text when present
            const normalizeWithOther = (items, otherMap) =>
                items.map((it) => (it === 'Other' && otherMap['Other'] && otherMap['Other'].value.trim()) ? otherMap['Other'].value.trim() : it);

            const normalizedBodySignals = normalizeWithOther(bodySignals, this.bodySignalOther);
            const normalizedActions = normalizeWithOther(actions, this.actionOther);

            const data = {
                entry_date: this.entryDateInput ? this.entryDateInput.value : entry_date_iso,
                trigger: this.triggerInput.value.trim(),
                body_signals: normalizedBodySignals,
                did_pause: this.didPauseSelect ? this.didPauseSelect.value : '',
                what_i_did: normalizedActions,
                wanted: this.wantedInput.value.trim(),
                discomfort: (function(){
                    if (!TRACK_DISCOMFORT) return { felt: '', duration: '', happened: '' };
                    const felt = this.discomfortFelt ? this.discomfortFelt.value.trim() : '';
                    const rawDur = (this.discomfortDuration && this.discomfortDuration.value !== undefined) ? this.discomfortDuration.value : '';
                    let duration = '';
                    if (rawDur !== '') {
                        const n = Number(rawDur);
                        duration = Number.isFinite(n) ? n : rawDur;
                    }
                    const happened = this.discomfortHappened ? this.discomfortHappened.value.trim() : '';
                    return { felt, duration, happened };
                }).call(this)
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

        onClose() {
            this.contentEl.empty();
        }

        static prompt(app) {
            return new Promise((resolve) => {
                const m = new PatternModal(app, resolve);
                m.open();
            });
        }
    }

	if (!modalForms) {
        new Notice("Modal Forms plugin is not available.", 5000);
        return;
    }

    // Helper to parse incoming variables that may be strings or JSON
    function parseArrayVar(v) {
        if (!v) return [];
        if (Array.isArray(v)) return v;
        if (typeof v === 'string') {
            // try JSON
            try { const parsed = JSON.parse(v); if (Array.isArray(parsed)) return parsed; } catch (e) {}
            // comma or pipe separated
            if (v.includes(',')) return v.split(',').map(s => s.trim()).filter(Boolean);
            if (v.includes('|')) return v.split('|').map(s => s.trim()).filter(Boolean);
            return [v.trim()];
        }
        return [];
    }

    function parseDiscomfort(v) {
        if (!v) return { felt: '', duration: '', happened: '' };
        if (typeof v === 'string') {
            try { const parsed = JSON.parse(v); return parsed; } catch (e) {}
            return { felt: v, duration: '', happened: '' };
        }
        return v;
    }

    // Helper to convert JS arrays into YAML list strings suitable for frontmatter
    function toYamlList(arr) {
        if (!arr || !arr.length) return '';
        return arr.map(item => `- ${String(item).replace(/\n/g,' ').replace(/"/g,'\"')}`).join('\n');
    }

    // If QuickAdd URI or caller pre-populated variables, use them and skip the modal.
    const hasPrepop = variables && (
        variables.entry_date !== undefined ||
        variables.trigger !== undefined ||
        variables.body_signals !== undefined ||
        variables.did_pause !== undefined ||
        variables.what_i_did !== undefined ||
        variables.wanted !== undefined ||
        variables.discomfort !== undefined
    );

    let result;
    if (hasPrepop) {
        // Normalize incoming values
        result = {
            entry_date: variables.entry_date || variables.entry_date_iso || entry_date_iso,
            trigger: variables.trigger || '',
            body_signals: parseArrayVar(variables.body_signals),
            did_pause: variables.did_pause || 'No',
            what_i_did: parseArrayVar(variables.what_i_did),
            wanted: variables.wanted || '',
            discomfort: parseDiscomfort(variables.discomfort)
        };
        console.log('Using prepopulated QuickAdd variables for PatternTracking:', result);
    } else {
        // Open the Pattern Tracking modal and await the user's input
        result = await PatternModal.prompt(app);
    }
    if (!result) {
        console.log('Modal cancelled');
        params.abort('Cancelled');
        return;
    }
	// Use the returned values (set QuickAdd variables or handle them here)
	console.log('Modal result:', result);
    // Map returned structure into QuickAdd variables for template use
    // Ensure `entry_date` is available (from result or generated)
    variables.entry_date = result.entry_date || entry_date_iso;
    variables.trigger = result.trigger;
    // Keep these as native arrays so QuickAdd can format them as proper YAML lists
    variables.body_signals = result.body_signals;
    variables.did_pause = result.did_pause;
    variables.what_i_did = result.what_i_did;
    variables.wanted = result.wanted;

    // Flatten discomfort into individual top-level variables (avoid nested objects)
    const _discomfort = result.discomfort || { felt: '', duration: '', happened: '' };
    variables.discomfort_felt = _discomfort.felt || '';
    variables.discomfort_duration = (_discomfort.duration !== undefined) ? _discomfort.duration : '';
    variables.discomfort_happened = _discomfort.happened || '';

    // Provide YAML-ready list strings for templates (if needed)
    variables.body_signals_yaml = toYamlList(variables.body_signals);
    variables.what_i_did_yaml = toYamlList(variables.what_i_did);

    // Always expose an entry_date_title for filenames; `entry_date` above may be overridden by result
    variables.entry_date_title = entry_date_title;

    // Generate a fileName using the entry_date (if provided) and a short UUID suffix
    let fileDateTitle;
    try {
        if (variables.entry_date) {
            fileDateTitle = moment(variables.entry_date).format("YYYY-MM-DDTHH-mm");
        } else {
            fileDateTitle = entry_date_title;
        }
    } catch (e) {
        fileDateTitle = entry_date_title;
    }
    const shortId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID().split('-')[0] : Math.random().toString(36).slice(2,8);
    variables.fileName = `${fileDateTitle}_${shortId}`;
}