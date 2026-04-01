module.exports = {
    entry: start,
    settings: {
        name: "Journal Thought Script",
        author: "Taylor Dickson"
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
        const module = { exports: {} };
        const fn = new Function('module', 'exports', source);
        fn(module, module.exports);
        return module.exports || {};
    } catch (e) {}
    return null;
}

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
    const sharedStyles = await loadScriptModule(app, 'SharedQuickAddStyles.js');
    const getJournalThoughtModalCss = sharedStyles?.getJournalThoughtModalCss ?? (() => '');

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
                styleEl.textContent = getJournalThoughtModalCss();

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