module.exports = {
    entry: start,
    settings: {
        name: "Journal Thought Script",
        author: "Taylor Dickson"
    }
};

async function start(params, settings) {
    /** @type {import("./Quickadd").quickAddApi} */
    const _quickAddApi = params.quickAddApi;
    /** @type {import("./obsidian").App} */
    const app = params.app;
    const variables = params.variables
    /** @type {import("./modalforms").api} */
    // Prefer QuickAdd-provided Obsidian Modal, fallback to global Modal
    /** type {import("./obsidian").Modal} */
    const Modal = params.obsidian?.Modal ?? globalThis.Modal;
    const dataView = app.plugins.plugins.dataview?.api

    const entryDate = moment();
    const entry_date_iso = entryDate.format(); // For frontmatter
    const entry_date_title = entryDate.format("YYYY-MM-DDTHH-mm-ss"); // For filename/title

    if (!Modal) {
        new Notice("Obsidian Modal is not available.", 5000);
        return;
    }
    if (!dataView) {
        new Notice("Dataview Plugin is not available.", 5000);
    }

    try {
        const dvResults = await dataView.pages('"Personal/Locations"')
            .where(p => p.current === true)
            .groupBy(p => p.location)

        // Custom Modal to match PatternTracking styling and behavior
        // Collect tags from vault (frontmatter and inline tags)
        function collectTags() {
            const files = app.vault.getMarkdownFiles();
            const set = new Set();
            for (const f of files) {
                const cache = app.metadataCache.getFileCache(f);
                if (!cache) continue;
                if (cache.frontmatter && cache.frontmatter.tags) {
                    const t = cache.frontmatter.tags;
                    if (Array.isArray(t)) t.forEach(x => set.add(String(x)));
                    else if (typeof t === 'string') set.add(t);
                }
                if (cache.tags) {
                    cache.tags.forEach(o => { if (o && o.tag) set.add(o.tag); });
                }
            }
            // Normalize: strip leading '#' from tags and trim
            const normalized = Array.from(set).map(s => String(s).trim().replace(/^#/, ''))
                .filter(Boolean);
            return Array.from(new Set(normalized)).sort();
        }

        // Inline tag suggester: prefer Obsidian TextInputSuggest, otherwise fall back to native datalist
        class TagTextSuggest extends (globalThis.TextInputSuggest || class {}) {
            constructor(app, inputEl, items, onChoose) {
                if (globalThis.TextInputSuggest) super(app, inputEl);
                else super();
                this.inputEl = inputEl;
                this.items = items || [];
                this._onChoose = onChoose;
            }
            getSuggestions(inputStr) {
                // Use caret-aware token extraction so suggestions are based
                // on the text the user is currently editing (supports multiple tags)
                try {
                    const el = this.inputEl;
                    const pos = (el && typeof el.selectionStart === 'number') ? el.selectionStart : null;
                    const upto = (pos !== null) ? (el.value.slice(0, pos)) : (inputStr || el.value || '');
                    const token = (upto || '').split(/[,\s]+/).pop().replace(/^#/, '').toLowerCase();
                    if (!token) return this.items.slice(0, 20);
                    return this.items.filter(i => i.toLowerCase().includes(token));
                } catch (e) {
                    const token = (inputStr || '').split(/[,\s]+/).pop().toLowerCase();
                    if (!token) return this.items.slice(0, 20);
                    return this.items.filter(i => i.toLowerCase().includes(token));
                }
            }
            renderSuggestion(item, el) {
                el.createEl('div', { text: item });
            }
            // Obsidian uses `onChooseSuggestion` for Suggest classes
            onChooseSuggestion(item) {
                if (this._onChoose) {
                    this._onChoose(item);
                }
                try { this.close(); } catch (e) {}
            }
            // keep fallback name as well
            selectSuggestion(item) {
                if (this._onChoose) this._onChoose(item);
                try { this.close(); } catch (e) {}
            }
        }

        class JournalThoughtModal extends Modal {
            constructor(app, resolve, dvResults, defaults) {
                super(app);
                this._resolve = resolve;
                this._resolved = false;
                this.dvResults = dvResults;
                this.defaults = defaults || {};
            }

            onOpen() {
                const { contentEl } = this;
                this.setTitle('Journal Thought');
                try { contentEl.classList.add('journal-modal'); } catch (e) {}
                const styleEl = contentEl.createEl('style');
                styleEl.textContent = `
                    /* Layout */
                    .journal-modal { box-sizing: border-box; max-width: var(--modal-max-width); }
                    /* center inner content and constrain to 90% so inputs don't hit the edges */
                    .journal-modal .row { display:flex; flex-direction:column; gap:8px; width:90%; max-width:100%; margin:0 auto; box-sizing:border-box; padding-bottom:12px; }
                    .journal-modal label { font-weight:600; margin-bottom:4px; color: var(--text-normal); }
                    .journal-modal .small { font-size:0.9rem; color:var(--text-muted); }

                    /* Unified input styles (theme-aware) */
                    .journal-modal input[type="text"],
                    .journal-modal input[type="datetime-local"],
                    .journal-modal input[type="number"],
                    .journal-modal select,
                    .journal-modal textarea {
                        width:100%;
                        max-width:100%;
                        min-width:0;
                        box-sizing:border-box;
                        font-size: clamp(0.95rem, 1.5vw, 1rem);
                        padding: 8px 10px;
                        border-radius: var(--border-radius, 6px);
                        border: 1px solid var(--interactive-accent, rgba(0,0,0,0.08));
                        background: var(--background-primary, var(--background-modifier-border, #fff));
                        color: var(--text-normal);
                    }
                    .journal-modal input::placeholder, .journal-modal textarea::placeholder { color: var(--text-muted); }
                    .journal-modal textarea { min-height:8em; resize:vertical; }

                    /* Fix for select text clipping: ensure adequate vertical space and proper line-height */
                    .journal-modal select {
                        box-sizing: border-box;
                        padding-top: 8px;
                        padding-bottom: 8px;
                        padding-right: 36px; /* space for dropdown arrow */
                        line-height: 1.4; /* taller line-height prevents vertical clipping */
                        min-height: calc(1.4em + 16px);
                        height: auto;
                        vertical-align: middle;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        appearance: none;
                        -webkit-appearance: none;
                        -moz-appearance: none;
                        background-repeat: no-repeat;
                        background-position: right 10px center;
                    }
                    .journal-modal select option { line-height: 1.6; }

                    /* Ensure datetime input doesn't exceed other input widths
                        and behaves like other inputs (prevents oversized browser controls) */
                    .journal-modal input[type="datetime-local"] {
                        width: 100%;
                        max-width: 100%;
                        display: block;
                        box-sizing: border-box;
                        padding: 8px 10px;
                        font-size: inherit;
                        min-width: 0; /* prevent intrinsic min-size from expanding on some mobile browsers */
                        -webkit-appearance: none;
                        appearance: none;
                        max-inline-size: 100%;
                    }

                    .journal-modal input:focus, .journal-modal textarea:focus, .journal-modal select:focus {
                        outline: 2px solid var(--interactive-normal, rgba(0,120,212,0.18));
                        outline-offset: 2px;
                        box-shadow: 0 0 0 3px color-mix(in srgb, var(--interactive-normal, rgba(0,120,212,0.12)) 12%, transparent);
                    }

                    /* Buttons */
                    .journal-modal .btn-row { margin-top:12px; display:flex; gap:8px; justify-content:flex-end; align-items:center; overflow: visible; }
                    .journal-modal .btn-row button {
                        padding: 8px 12px;
                        border-radius: var(--border-radius, 6px);
                        border: 1px solid var(--interactive-muted, rgba(0,0,0,0.08));
                        background: transparent;
                        color: var(--text-normal);
                        cursor: pointer;
                        font-size: 0.95rem;
                    }
                    /* Use outline for focus ring (doesn't affect layout) to avoid scrollbars */
                    .journal-modal .btn-row button:focus { outline: 2px solid var(--interactive-accent, rgba(0,120,212,0.18)); outline-offset: 2px; }
                    /* Primary submit button using Obsidian variables */
                    .journal-modal .btn-row .primary {
                        background: var(--interactive-accent, #2ea3f2);
                        color: var(--text-on-accent, #ffffff);
                        border-color: transparent;
                    }
                    .journal-modal .btn-row .primary:hover { filter: brightness(0.98); }

                    /* Tags area */
                    .journal-modal .tags-wrapper { width:100%; max-width:100%; box-sizing:border-box; }
                    .journal-modal .selected-tags { display:flex; flex-wrap:wrap; gap:6px; max-width:100%; overflow:hidden; }
                    .journal-modal .tag-pill { max-width:100%; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; background: var(--interactive-accent, #eee); color: var(--text-on-accent, var(--text-normal)); padding: 4px 8px; border-radius: var(--border-radius, 999px); }

                    /* Ensure elements inside flex containers can shrink on small screens */
                    .journal-modal .tag-suggester-input, .journal-modal .tag-input { min-width:0; }

                    /* Prevent horizontal scrolling within the modal */
                    .journal-modal, .journal-modal * { max-width:100%; box-sizing:border-box; }
                    .journal-modal { overflow-x: hidden; }

                    /* Mobile-safe modal: avoid applying large padding to the modal itself
                       — only add a small safe-area offset to the inner scroll area to
                       prevent giant empty space when the keyboard opens. */
                    .is-phone .modal { margin-bottom: 0; max-width: calc(100vw - 12px); overflow-x:hidden; }
                    .is-phone .modal .modal-content, .is-phone .modal .modal-inner {
                        padding-bottom: calc(var(--safe-area-inset-bottom, 0px) + 8px);
                    }
                    /* Make modal buttons align in a single responsive row on phones */
                    .is-phone .modal .modal-button-container {
                        display: flex;
                        gap: 8px;
                        flex-wrap: nowrap;
                        align-items: center;
                    }
                    .is-phone .modal .modal-button-container button {
                        flex: 1 1 auto;
                        min-width: 0;
                    }
                    /* Narrow-screen tweaks specifically for datetime overflow */
                    @media (max-width: 420px) {
                        .journal-modal .row { width: calc(100vw - 48px); }
                        .journal-modal input[type="datetime-local"] { max-width: calc(100% - 4px); }
                    }
                `;

                const row = contentEl.createDiv({ cls: 'row' });

                // Entry date
                row.createEl('label', { text: 'Entry date' });
                this.entryDateInput = row.createEl('input');
                this.entryDateInput.type = 'datetime-local';
                try { this.entryDateInput.value = moment().format("YYYY-MM-DDTHH:mm"); } catch (e) { this.entryDateInput.value = new Date().toISOString().slice(0,16); }

                // Subject
                row.createEl('label', { text: 'Subject' });
                this.subjectInput = row.createEl('input');
                this.subjectInput.type = 'text';
                this.subjectInput.placeholder = 'Short subject for filename';

                // Location select
                row.createEl('label', { text: 'Location' });
                this.locationSelect = row.createEl('select');
                const emptyOpt = document.createElement('option'); emptyOpt.value = ''; emptyOpt.text = '';
                this.locationSelect.appendChild(emptyOpt);
                if (this.dvResults && this.dvResults.values) {
                    for (let g of this.dvResults.values) {
                        const opt = document.createElement('option');
                        opt.value = g.key;
                        opt.text = g.key;
                        this.locationSelect.appendChild(opt);
                    }
                }

                // Entry textarea
                row.createEl('label', { text: 'Entry' });
                this.entryInput = row.createEl('textarea');
                this.entryInput.placeholder = 'What is on your mind?';

                // Tags: selected list + suggester input
                row.createEl('label', { text: 'Tags' });
                const tagsWrapper = row.createDiv({ cls: 'tags-wrapper' });
                tagsWrapper.style.display = 'flex';
                tagsWrapper.style.flexDirection = 'column';
                tagsWrapper.style.gap = '6px';

                // Selected tags area
                this.selectedTagsContainer = tagsWrapper.createDiv({ cls: 'selected-tags' });
                this.selectedTagsContainer.style.display = 'flex';
                this.selectedTagsContainer.style.flexWrap = 'wrap';
                this.selectedTagsContainer.style.gap = '6px';

                // Suggester input
                this.suggesterInput = tagsWrapper.createEl('input');
                this.suggesterInput.type = 'text';
                this.suggesterInput.className = 'tag-suggester-input';
                this.suggesterInput.placeholder = 'Type to search tags, press Enter to add';

                // selectedTags state
                this.selectedTags = [];

                const tags = collectTags();
                // helper to render a tag pill
                const renderTag = (tag) => {
                    const pill = this.selectedTagsContainer.createDiv({ cls: 'tag-pill' });
                    pill.style.display = 'inline-flex';
                    pill.style.alignItems = 'center';
                    pill.style.padding = '4px 8px';
                    pill.style.borderRadius = '999px';
                    pill.style.background = 'var(--interactive-accent, #eee)';
                    pill.style.color = 'var(--text-on-accent, #000)';
                    pill.createEl('span', { text: `#${tag}` });
                    const x = pill.createEl('button', { text: '✕' });
                    x.style.marginLeft = '8px';
                    x.addEventListener('click', () => {
                        this.selectedTags = this.selectedTags.filter(t => t !== tag);
                        pill.remove();
                    });
                };

                const addTag = (raw) => {
                    if (!raw) return;
                    const tag = String(raw).trim().replace(/^#/, '');
                    if (!tag) return;
                    if (this.selectedTags.includes(tag)) return;
                    this.selectedTags.push(tag);
                    renderTag(tag);
                    this.suggesterInput.value = '';
                    // close TextInputSuggest if present
                    try { if (this._tagSuggest && typeof this._tagSuggest.close === 'function') this._tagSuggest.close(); } catch (e) {}
                    // blur+refocus to hide native datalist dropdown in some browsers
                    try { this.suggesterInput.blur(); setTimeout(() => { try { this.suggesterInput.focus(); } catch (e) {} }, 10); } catch (e) {}
                    this.suggesterInput.focus();
                };

                // Attach inline suggestions: use TextInputSuggest if available, else native datalist
                if (typeof globalThis.TextInputSuggest !== 'undefined') {
                    this._tagSuggest = new TagTextSuggest(app, this.suggesterInput, tags, addTag);
                } else {
                    const dlId = `journal-tags-datalist-${Date.now()}`;
                    const dl = contentEl.createEl('datalist');
                    dl.id = dlId;
                    // initial options
                    tags.forEach(t => dl.createEl('option', { value: t }));
                    this.suggesterInput.setAttribute('list', dlId);
                    // update datalist options based on last token on input
                    this.suggesterInput.addEventListener('input', () => {
                        const val = this.suggesterInput.value || '';
                        const token = val.split(/[,\s]+/).pop().toLowerCase();
                        const filtered = token ? tags.filter(t => t.toLowerCase().includes(token)) : tags.slice(0, 50);
                        dl.empty();
                        filtered.forEach(t => dl.createEl('option', { value: t }));
                    });
                    // when user selects/clicks an option in the datalist, `change` fires in many browsers
                    this.suggesterInput.addEventListener('change', () => {
                        const v = (this.suggesterInput.value || '').trim();
                        if (!v) return;
                        addTag(v.replace(/^#/, ''));
                    });
                }

                // handle Enter, comma to add tag from suggesterInput
                this.suggesterInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const val = this.suggesterInput.value || '';
                        const token = val.split(/[,\s]+/).pop();
                        if (token) addTag(token);
                    }
                });

                // Buttons (placed inside the same `.row` as the inputs so they align)
                const btnRow = row.createDiv({ cls: 'btn-row' });
                // Cancel on the left, Save (primary) on the right
                const cancelBtn = btnRow.createEl('button', { text: 'Cancel' });
                cancelBtn.addEventListener('click', () => this.cancel());
                const saveBtn = btnRow.createEl('button', { text: 'Save' });
                saveBtn.classList.add('primary');
                saveBtn.addEventListener('click', () => this.save());
            }

            save() {
                if (this._resolved) return;
                const data = {
                    entry_date: this.entryDateInput?.value || '',
                    subject: this.subjectInput?.value || '',
                    location: this.locationSelect?.value || '',
                    entry: this.entryInput?.value || '',
                    tags: (this.selectedTags || []).slice()
                };

                // If location matches a dv group, convert to file link markdown
                if (this.dvResults && this.dvResults.values && data.location) {
                    const match = this.dvResults.values.find(g => g.key === data.location);
                    if (match) {
                        const link = match.rows[0].file.link;
                        link.display = match.key;
                        data.location = link.markdown();
                    }
                }

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

            static prompt(app, dvResults, defaults) {
                return new Promise((resolve) => { const m = new JournalThoughtModal(app, resolve, dvResults, defaults); m.open(); });
            }
        }

        // Launch modal
        const result = await JournalThoughtModal.prompt(app, dvResults);
        if (!result) {
            params.abort('Cancelled');
            return;
        }

        // Map returned values into QuickAdd variables
        // Preserve original naming used in templates
        variables.entry_date = result.entry_date || entry_date_iso;
        variables.subject = result.subject || '';
        variables.entry = result.entry || '';
        variables.location = result.location || '';

        // Normalize tags: accept input with or without leading '#', store as array
        const rawTags = (result.tags || []);
        // `result.tags` should be an array (from selectedTags) but accept string as well
        const parsed = Array.isArray(rawTags) ? rawTags.slice() : String(rawTags).split(/[,\s]+/);
        const cleaned = parsed.map(t => String(t).trim().replace(/^#/, '')).filter(Boolean);
        const uniq = Array.from(new Set(cleaned));
        variables.tags = uniq; // array of tag strings (no leading '#')
        variables.tags_inline = uniq.map(t => `#${t}`); // array with leading '#'
        variables.tags_yaml = uniq.length ? uniq.map(t => `- ${t}`).join('\n') : '';

        variables.fileName =
            entry_date_title +
            replaceIllegalFileNameCharactersInString(variables.subject);

        // Ensure basic fields exist; `tags` default is empty array
        if (!('subject' in variables)) variables.subject = '';
        if (!('location' in variables)) variables.location = '';
        if (!('entry' in variables)) variables.entry = '';
        if (!('tags' in variables)) variables.tags = [];
        if (!('tags_inline' in variables)) variables.tags_inline = [];
        if (!('tags_yaml' in variables)) variables.tags_yaml = '';

        return;
    } catch (error) {
        // Catch Abort status as abort() triggers an exception which we don't want to catch
        if (error.name === 'MacroAbortError') {
            params.abort(error.message);
            return;
        }
        console.error("Journal Thought Script:", error);
        new Notice(`Error: ${error.message}`, 5000);
    }
}

function replaceIllegalFileNameCharactersInString(input) {
    if (!input) return "";
    return `_${input
        .replace(/[\\,#%&\{\}\/*<>$'\":@]/g, '')
        .trim()
        .replace(/ /g, '_')}`;
}