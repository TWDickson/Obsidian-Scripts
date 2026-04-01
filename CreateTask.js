module.exports = {
    entry: start,
    settings: {
        name: "Create Planner Task",
        author: "Taylor Dickson"
    }
};

// ── Customizable: edit these arrays to change all dropdown options ─────────────
const TYPES      = ['task', 'project'];
const CATEGORIES = ['', 'database', 'general'];          // '' = No category
const STATUSES   = ['Active', 'Future', 'In Progress', 'Hold', 'Blocked', 'Cancelled'];
const PRIORITIES = ['High', 'Medium', 'Low', 'None'];
const TASK_TYPES = ['', 'feature', 'bug', 'research', 'docs', 'action']; // '' = none

const BLANK_CATEGORY_LABEL  = '— no category —';
const BLANK_TASK_TYPE_LABEL = '— none —';

async function start(params, settings) {
    /** @type {import("./obsidian").App} */
    const app   = params.app;
    const Modal = params.obsidian?.Modal ?? globalThis.Modal;
    const dv    = app.plugins.plugins.dataview?.api;

    if (!Modal) { new Notice('Obsidian Modal not available.', 5000); return; }
    if (!dv)    { new Notice('Dataview plugin not available.', 5000); return; }

    const allNotes = dv.pages('"Planner/Tasks"')
        .where(p => p.name)
        .sort(p => p.name, 'asc')
        .array();

    // ── Modal ──────────────────────────────────────────────────────────────────
    class CreateTaskModal extends Modal {
        constructor(app) {
            super(app);
            this._resolve    = null;
            this._resolved   = false;
            this._parentTask = null;
            this._dependsOn  = [];
            this._type       = 'task';
            this._priority   = 'None';
        }

        onOpen() {
            const { contentEl } = this;
            this.setTitle('New Planner Task');
            contentEl.addClass('ct-modal');

            // Widen the modal
            this.modalEl.style.width    = '560px';
            this.modalEl.style.maxWidth = '92vw';

            contentEl.createEl('style').textContent = `
                .ct-modal .ct-form    { display:flex; flex-direction:column; gap:14px; padding:4px 0 8px; }
                .ct-modal .ct-row     { display:flex; flex-direction:column; gap:5px; }
                .ct-modal .ct-section { display:flex; flex-direction:column; gap:14px; }
                .ct-modal .ct-divider { border:none; border-top:1px solid var(--background-modifier-border); margin:2px 0; }
                .ct-modal label {
                    font-weight:600; font-size:0.75rem; color:var(--text-muted);
                    text-transform:uppercase; letter-spacing:0.06em;
                }
                .ct-modal .ct-hint { font-size:0.78rem; color:var(--text-muted); }
                .ct-modal input, .ct-modal select, .ct-modal textarea {
                    width:100%; box-sizing:border-box; font-size:0.93rem;
                    padding:8px 11px; border-radius:var(--radius-m,6px);
                    border:1px solid var(--background-modifier-border);
                    background:var(--background-primary); color:var(--text-normal);
                    transition: border-color 0.15s, box-shadow 0.15s;
                }
                .ct-modal input:focus, .ct-modal select:focus, .ct-modal textarea:focus {
                    outline:none;
                    border-color:var(--interactive-accent);
                    box-shadow:0 0 0 2px color-mix(in srgb, var(--interactive-accent) 20%, transparent);
                }
                .ct-modal .ct-name-input {
                    font-size:1.1rem !important;
                    font-weight:500 !important;
                    padding:10px 12px !important;
                }
                .ct-modal select { min-height:calc(1.4em + 16px); }
                .ct-modal textarea { min-height:4em; resize:vertical; }

                /* ── Type toggle ── */
                .ct-modal .ct-type-toggle {
                    display:inline-flex; border-radius:var(--radius-m,6px);
                    border:1px solid var(--background-modifier-border); overflow:hidden;
                    align-self:flex-start;
                }
                .ct-modal .ct-type-btn {
                    padding:6px 20px; border:none; background:transparent;
                    color:var(--text-muted); cursor:pointer; font-size:0.88rem;
                    font-weight:600; transition:all 0.15s; white-space:nowrap;
                }
                .ct-modal .ct-type-btn:not(:last-child) { border-right:1px solid var(--background-modifier-border); }
                .ct-modal .ct-type-btn.active { background:var(--interactive-accent); color:var(--text-on-accent); }
                .ct-modal .ct-type-btn:hover:not(.active) { background:var(--background-modifier-hover); color:var(--text-normal); }

                /* ── Priority chips ── */
                .ct-modal .ct-priority-chips { display:flex; gap:6px; flex-wrap:wrap; }
                .ct-modal .ct-pri-chip {
                    padding:5px 13px; border-radius:999px;
                    border:1.5px solid var(--background-modifier-border);
                    cursor:pointer; font-size:0.82rem; font-weight:600;
                    background:var(--background-secondary); color:var(--text-muted);
                    transition:all 0.13s;
                }
                .ct-modal .ct-pri-chip:hover { border-color:var(--text-muted); color:var(--text-normal); }
                .ct-modal .ct-pri-chip:focus { outline:2px solid var(--interactive-accent); outline-offset:2px; }
                .ct-modal .ct-pri-chip.active[data-pri="High"]   { background:#ef4444; color:#fff; border-color:#ef4444; }
                .ct-modal .ct-pri-chip.active[data-pri="Medium"] { background:#f97316; color:#fff; border-color:#f97316; }
                .ct-modal .ct-pri-chip.active[data-pri="Low"]    { background:#3b82f6; color:#fff; border-color:#3b82f6; }
                .ct-modal .ct-pri-chip.active[data-pri="None"]   {
                    background:var(--background-modifier-border);
                    color:var(--text-normal);
                    border-color:var(--background-modifier-border);
                }

                /* ── Quick date row ── */
                .ct-modal .ct-date-row { display:flex; gap:6px; align-items:center; }
                .ct-modal .ct-date-row input { flex:1; }
                .ct-modal .ct-date-btns { display:flex; gap:4px; flex-shrink:0; }
                .ct-modal .ct-date-btn {
                    padding:5px 9px; border-radius:var(--radius-m,6px);
                    border:1px solid var(--background-modifier-border);
                    background:var(--background-secondary); color:var(--text-muted);
                    cursor:pointer; font-size:0.75rem; white-space:nowrap;
                    transition:all 0.12s;
                }
                .ct-modal .ct-date-btn:hover { background:var(--interactive-accent); color:var(--text-on-accent); border-color:transparent; }
                .ct-modal .ct-date-btn:focus { outline:2px solid var(--interactive-accent); outline-offset:1px; }

                /* ── Chips (selected relationships) ── */
                .ct-modal .ct-chip-area { display:flex; flex-wrap:wrap; gap:6px; min-height:24px; }
                .ct-modal .ct-chip {
                    display:inline-flex; align-items:center; gap:4px; padding:3px 9px;
                    border-radius:999px; background:var(--interactive-accent);
                    color:var(--text-on-accent); font-size:0.82rem;
                }
                .ct-modal .ct-chip-x {
                    background:none; border:none; cursor:pointer; color:inherit;
                    padding:0 2px; font-size:0.78rem; line-height:1;
                }
                .ct-modal .ct-chip-x:hover { opacity:0.7; }

                /* ── Search dropdown ── */
                .ct-modal .ct-dropdown-wrap { position:relative; }
                .ct-modal .ct-dropdown {
                    position:absolute; top:calc(100% + 3px); left:0; right:0; z-index:9999;
                    background:var(--background-primary);
                    border:1px solid var(--background-modifier-border);
                    border-radius:var(--radius-m,6px); box-shadow:var(--shadow-l);
                    max-height:210px; overflow-y:auto;
                }
                .ct-modal .ct-dropdown-item {
                    display:flex; justify-content:space-between; align-items:center;
                    padding:8px 12px; cursor:pointer; font-size:0.9rem;
                }
                .ct-modal .ct-dropdown-item:hover,
                .ct-modal .ct-dropdown-item.ct-dd-active { background:var(--background-modifier-hover); }
                .ct-modal .ct-meta { font-size:0.75rem; color:var(--text-muted); }

                /* ── Relationship preview ── */
                .ct-modal .ct-preview {
                    font-family:var(--font-monospace); font-size:0.82rem;
                    color:var(--text-muted); background:var(--background-secondary);
                    border-radius:var(--radius-m,6px); padding:8px 12px;
                    line-height:1.7; white-space:pre;
                }

                /* ── Advanced collapsible ── */
                .ct-modal details.ct-advanced { border-top:1px solid var(--background-modifier-border); padding-top:4px; }
                .ct-modal details.ct-advanced > summary {
                    cursor:pointer; font-size:0.82rem; font-weight:700;
                    color:var(--text-muted); user-select:none; padding:5px 0;
                    list-style:none; text-transform:uppercase; letter-spacing:0.05em;
                }
                .ct-modal details.ct-advanced > summary::before { content:'▶  '; font-size:0.65rem; }
                .ct-modal details.ct-advanced[open] > summary::before { content:'▼  '; }
                .ct-modal details.ct-advanced > .ct-section { padding-top:12px; }

                /* ── Buttons ── */
                .ct-modal .ct-btn-row {
                    display:flex; justify-content:space-between; align-items:center;
                    gap:8px; margin-top:2px;
                }
                .ct-modal .ct-shortcut-hint { font-size:0.75rem; color:var(--text-muted); }
                .ct-modal .ct-btns { display:flex; gap:8px; }
                .ct-modal .ct-btns button {
                    padding:8px 18px; border-radius:var(--radius-m,6px);
                    border:1px solid var(--background-modifier-border);
                    background:transparent; color:var(--text-normal); cursor:pointer;
                    font-size:0.9rem; font-weight:500; transition:all 0.12s;
                }
                .ct-modal .ct-btns button:hover { background:var(--background-modifier-hover); }
                .ct-modal .ct-btns button:focus { outline:2px solid var(--interactive-accent); outline-offset:2px; }
                .ct-modal .ct-primary {
                    background:var(--interactive-accent) !important;
                    color:var(--text-on-accent) !important;
                    border-color:transparent !important;
                }
                .ct-modal .ct-primary:hover { opacity:0.88 !important; }
                .ct-modal .ct-hidden { display:none !important; }
                .ct-modal .ct-inline { display:flex; gap:10px; }
                .ct-modal .ct-inline > .ct-row { flex:1; }
            `;

            const form = contentEl.createDiv({ cls: 'ct-form' });

            // ── Ctrl/Cmd+Enter to save from anywhere ──────────────────────────
            contentEl.addEventListener('keydown', e => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    this.save();
                }
            });

            // ── Helpers ───────────────────────────────────────────────────────
            const mkRow = (parent, label, hint) => {
                const r = parent.createDiv({ cls: 'ct-row' });
                if (label) r.createEl('label', { text: label });
                if (hint) r.createEl('span', { cls: 'ct-hint', text: hint });
                return r;
            };

            const mkSelect = (parent, opts, def, labelFn) => {
                const s = parent.createEl('select');
                opts.forEach(o => {
                    const text = (labelFn ? labelFn(o) : o) || o;
                    const opt = s.createEl('option', { value: o, text });
                    if (o === def) opt.selected = true;
                });
                return s;
            };

            // Date input with Today / +1d / +7d quick-pick buttons
            const mkDateRow = (parent, label) => {
                const r = mkRow(parent, label);
                const wrap = r.createDiv({ cls: 'ct-date-row' });
                const inp = wrap.createEl('input', { type: 'date' });
                const btns = wrap.createDiv({ cls: 'ct-date-btns' });
                [['Today', 0], ['+1d', 1], ['+7d', 7]].forEach(([lbl, days]) => {
                    const b = btns.createEl('button', { text: lbl, cls: 'ct-date-btn' });
                    b.type = 'button';
                    b.addEventListener('click', () => {
                        inp.value = moment().add(days, 'days').format('YYYY-MM-DD');
                    });
                });
                return inp;
            };

            // ── Top section ───────────────────────────────────────────────────
            const top = form.createDiv({ cls: 'ct-section' });

            // Type toggle (Task | Project)
            const typeRow = mkRow(top, 'Type');
            const typeToggle = typeRow.createDiv({ cls: 'ct-type-toggle' });
            TYPES.forEach(t => {
                const btn = typeToggle.createEl('button', {
                    text: t.charAt(0).toUpperCase() + t.slice(1),
                    cls: 'ct-type-btn'
                });
                btn.type = 'button';
                btn.dataset.type = t;
                if (t === this._type) btn.addClass('active');
                btn.addEventListener('click', () => {
                    this._type = t;
                    typeToggle.querySelectorAll('.ct-type-btn').forEach(b => {
                        b.toggleClass('active', b.dataset.type === t);
                    });
                    updateTypeVis();
                    this._updatePreview();
                });
            });

            // Name — hero field
            const nameRow = mkRow(top, 'Name', 'Required');
            this.nameInput = nameRow.createEl('input', { type: 'text' });
            this.nameInput.placeholder = 'What needs to be done?';
            this.nameInput.addClass('ct-name-input');

            // Due Date — always visible
            this.dueDateInput = mkDateRow(top, 'Due Date');

            // Category + Priority inline
            const catPriRow = top.createDiv({ cls: 'ct-inline' });

            const catRow = mkRow(catPriRow, 'Category');
            this.categorySelect = mkSelect(catRow, CATEGORIES, '', o =>
                o === '' ? BLANK_CATEGORY_LABEL : o
            );

            const priRow = mkRow(catPriRow, 'Priority');
            const priChips = priRow.createDiv({ cls: 'ct-priority-chips' });
            PRIORITIES.forEach(p => {
                const chip = priChips.createEl('button', { text: p, cls: 'ct-pri-chip' });
                chip.type = 'button';
                chip.dataset.pri = p;
                if (p === this._priority) chip.addClass('active');
                chip.addEventListener('click', () => {
                    this._priority = p;
                    priChips.querySelectorAll('.ct-pri-chip').forEach(c => {
                        c.toggleClass('active', c.dataset.pri === p);
                    });
                });
            });

            form.createEl('hr', { cls: 'ct-divider' });

            // ── Relationships section ─────────────────────────────────────────
            const relSection = form.createDiv({ cls: 'ct-section' });

            // Parent Task (hidden for project type)
            this._parentRow = mkRow(relSection, 'Parent Task', 'The project or task this belongs to');
            this._parentDisplay = this._parentRow.createDiv({ cls: 'ct-chip-area' });
            const parentWrap = this._parentRow.createDiv({ cls: 'ct-dropdown-wrap' });
            this._parentInput = parentWrap.createEl('input', { type: 'text' });
            this._parentInput.placeholder = 'Search projects and tasks…';
            this._buildDropdown(parentWrap, this._parentInput, (note) => {
                this._parentTask = note;
                this._renderChips(this._parentDisplay, [note], true);
                this._parentInput.value = '';
                this._updatePreview();
            });

            // Depends On
            const depsRow = mkRow(relSection, 'Depends On', 'Must finish before this can start');
            this._depsDisplay = depsRow.createDiv({ cls: 'ct-chip-area' });
            const depsWrap = depsRow.createDiv({ cls: 'ct-dropdown-wrap' });
            this._depsInput = depsWrap.createEl('input', { type: 'text' });
            this._depsInput.placeholder = 'Search tasks…';
            this._buildDropdown(depsWrap, this._depsInput, (note) => {
                if (!this._dependsOn.some(d => d.file.path === note.file.path)) {
                    this._dependsOn.push(note);
                    this._renderChips(this._depsDisplay, this._dependsOn, false);
                }
                this._depsInput.value = '';
                this._updatePreview();
            });

            // Relationship preview (live text tree)
            const previewRow = relSection.createDiv({ cls: 'ct-row' });
            previewRow.createEl('label', { text: 'Position' });
            this._previewEl = previewRow.createDiv({ cls: 'ct-preview' });
            this._previewEl.textContent = '—';

            form.createEl('hr', { cls: 'ct-divider' });

            // ── Advanced collapsible ──────────────────────────────────────────
            const adv = form.createEl('details', { cls: 'ct-advanced' });
            adv.createEl('summary', { text: 'Advanced' });
            const advSection = adv.createDiv({ cls: 'ct-section' });

            // Status
            const statusRow = mkRow(advSection, 'Status');
            this.statusSelect = mkSelect(statusRow, STATUSES, 'Active');

            // Task Type (hidden for project)
            this._taskTypeRow = mkRow(advSection, 'Task Type');
            this.taskTypeSelect = mkSelect(this._taskTypeRow, TASK_TYPES, '', o =>
                o === '' ? BLANK_TASK_TYPE_LABEL : o
            );

            // Start Date (in Advanced)
            this.startDateInput = mkDateRow(advSection, 'Start Date');

            // Estimated Days
            const estRow = mkRow(advSection, 'Estimated Days');
            this.estimatedInput = estRow.createEl('input', { type: 'number' });
            this.estimatedInput.min = '0'; this.estimatedInput.step = '0.5';
            this.estimatedInput.placeholder = 'e.g. 2';

            // Blocked Reason (shown when status = Blocked)
            this._blockedRow = mkRow(advSection, 'Blocked Reason', "Why can't this proceed?");
            this.blockedReasonInput = this._blockedRow.createEl('input', { type: 'text' });
            this.blockedReasonInput.placeholder = 'Waiting on Lee, need access to X…';

            // Assigned To
            const assignedRow = mkRow(advSection, 'Assigned To', 'Person if delegated');
            this.assignedToInput = assignedRow.createEl('input', { type: 'text' });

            // Notes
            const notesRow = mkRow(advSection, 'Notes', 'Body text for the note');
            this.notesInput = notesRow.createEl('textarea');
            this.notesInput.placeholder = 'Context, checklist items, links…';

            // ── Buttons ───────────────────────────────────────────────────────
            const btnRow = form.createDiv({ cls: 'ct-btn-row' });
            btnRow.createEl('span', {
                cls: 'ct-shortcut-hint',
                text: 'Ctrl+↵ to save  ·  Esc to cancel'
            });
            const btnGroup = btnRow.createDiv({ cls: 'ct-btns' });
            const cancelBtn = btnGroup.createEl('button', { text: 'Cancel' });
            cancelBtn.addEventListener('click', () => this.cancel());
            const createBtn = btnGroup.createEl('button', { text: 'Create Task' });
            createBtn.addClass('ct-primary');
            createBtn.addEventListener('click', () => this.save());

            // ── Reactive: visibility + preview ────────────────────────────────
            const updateTypeVis = () => {
                const isProject = this._type === 'project';
                this._taskTypeRow.toggleClass('ct-hidden', isProject);
                this._parentRow.toggleClass('ct-hidden', isProject);
            };
            const updateStatusVis = () => {
                this._blockedRow.toggleClass('ct-hidden', this.statusSelect.value !== 'Blocked');
            };

            this.statusSelect.addEventListener('change', updateStatusVis);
            this.nameInput.addEventListener('input', () => this._updatePreview());

            updateTypeVis();
            updateStatusVis();
            this._updatePreview();

            // Enter on name field moves focus forward (Ctrl+Enter still saves)
            this.nameInput.addEventListener('keydown', e => {
                if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    this.dueDateInput.focus();
                }
            });

            setTimeout(() => this.nameInput.focus(), 80);
        }

        // ── Live relationship preview ────────────────────────────────────────
        _updatePreview() {
            if (!this._previewEl) return;
            const name   = this.nameInput?.value?.trim() || '(name)';
            const isProj = this._type === 'project';
            const parent = this._parentTask;
            const deps   = this._dependsOn;

            const lines = [];
            if (isProj) {
                lines.push(`📁 ${name}`);
            } else {
                if (parent) {
                    lines.push(`📁 ${parent.name}`);
                    lines.push(`   └── ◆ ${name}  ← this task`);
                } else {
                    lines.push(`◆ ${name}  ← this task (no project)`);
                }
                if (deps.length > 0) {
                    lines.push('');
                    lines.push('   Depends on (must finish first):');
                    deps.forEach(d => lines.push(`     • ${d.name}`));
                }
            }
            this._previewEl.textContent = lines.join('\n') || '—';
        }

        // ── Chip rendering ────────────────────────────────────────────────────
        _renderChips(container, items, isSingle) {
            container.empty();
            for (const item of items) {
                const chip = container.createDiv({ cls: 'ct-chip' });
                chip.createEl('span', { text: item.name || item.file.name });
                const x = chip.createEl('button', { text: '✕', cls: 'ct-chip-x' });
                x.addEventListener('click', () => {
                    if (isSingle) {
                        this._parentTask = null;
                        container.empty();
                    } else {
                        this._dependsOn = this._dependsOn.filter(d => d.file.path !== item.file.path);
                        this._renderChips(container, this._dependsOn, false);
                    }
                    this._updatePreview();
                });
            }
        }

        // ── Search dropdown with arrow-key navigation ─────────────────────────
        _buildDropdown(wrapper, inputEl, onSelect) {
            let dd      = null;
            let ddItems = [];
            let ddNotes = [];
            let ddIdx   = -1;

            const highlight = (idx) => {
                ddItems.forEach((el, i) => el.toggleClass('ct-dd-active', i === idx));
                if (ddItems[idx]) ddItems[idx].scrollIntoView({ block: 'nearest' });
            };

            const close = () => {
                if (dd) { dd.remove(); dd = null; ddItems = []; ddNotes = []; ddIdx = -1; }
            };

            const open = (q) => {
                close();
                const lq = (q || '').toLowerCase();
                const hits = allNotes.filter(n => {
                    const nm = (n.name || n.file.name || '').toLowerCase();
                    return !lq || nm.includes(lq);
                }).slice(0, 15);
                if (!hits.length) return;
                dd = wrapper.createDiv({ cls: 'ct-dropdown' });
                ddItems = [];
                ddNotes = [];
                ddIdx   = -1;
                for (const note of hits) {
                    const item = dd.createDiv({ cls: 'ct-dropdown-item' });
                    item.createEl('span', { text: note.name || note.file.name });
                    if (note.type) item.createEl('span', { cls: 'ct-meta', text: note.type });
                    item.addEventListener('mousedown', e => {
                        e.preventDefault();
                        onSelect(note);
                        close();
                    });
                    ddItems.push(item);
                    ddNotes.push(note);
                }
            };

            inputEl.addEventListener('input',  () => open(inputEl.value));
            inputEl.addEventListener('focus',  () => open(inputEl.value));
            inputEl.addEventListener('blur',   () => setTimeout(close, 160));
            inputEl.addEventListener('keydown', e => {
                if (!dd) return;
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    ddIdx = Math.min(ddIdx + 1, ddItems.length - 1);
                    highlight(ddIdx);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    ddIdx = Math.max(ddIdx - 1, 0);
                    highlight(ddIdx);
                } else if (e.key === 'Enter') {
                    if (ddIdx >= 0 && ddNotes[ddIdx]) {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelect(ddNotes[ddIdx]);
                        close();
                    }
                } else if (e.key === 'Escape') {
                    close();
                }
            });
        }

        // ── Save / Cancel ─────────────────────────────────────────────────────
        save() {
            if (this._resolved) return;
            const name = this.nameInput.value.trim();
            if (!name) { new Notice('Name is required.'); this.nameInput.focus(); return; }
            this._resolved = true;
            this._resolve({
                type:           this._type,
                name,
                category:       this.categorySelect.value,
                status:         this.statusSelect.value,
                priority:       this._priority,
                task_type:      this.taskTypeSelect.value,
                parent_task:    this._parentTask,
                depends_on:     this._dependsOn.slice(),
                start_date:     this.startDateInput.value  || null,
                due_date:       this.dueDateInput.value    || null,
                estimated_days: this.estimatedInput.value  ? parseFloat(this.estimatedInput.value) : null,
                blocked_reason: this.blockedReasonInput.value.trim(),
                assigned_to:    this.assignedToInput.value.trim(),
                notes:          this.notesInput.value.trim(),
            });
            this.close();
        }

        cancel() {
            if (this._resolved) return;
            this._resolved = true;
            this._resolve(null);
            this.close();
        }

        onClose() { this.contentEl.empty(); }

        static prompt(app) {
            return new Promise(res => {
                const m = new CreateTaskModal(app);
                m._resolve = res;
                m.open();
            });
        }
    }

    // ── Main logic ─────────────────────────────────────────────────────────────
    try {
        const result = await CreateTaskModal.prompt(app);
        if (!result) { params.abort('Cancelled'); return; }

        // Generate {6-char-hex}-{slug} filename
        const shortId = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
        const slug = result.name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '').trim()
            .replace(/\s+/g, '-').replace(/-{2,}/g, '-')
            .substring(0, 30).replace(/-+$/, '');
        const fileName = `${shortId}-${slug}`;
        const filePath = `Planner/Tasks/${fileName}.md`;

        // Build frontmatter
        const today    = moment().format('YYYY-MM-DD');
        const esc      = s => String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        // Links with alias so Bases renders the human name
        const yamlLink = p => p
            ? `'[[${p.file.path.replace(/\.md$/, '')}|${p.name}]]'`
            : 'null';
        const depsStr = result.depends_on.length
            ? `\n${result.depends_on.map(d => `  - ${yamlLink(d)}`).join('\n')}`
            : ' []';
        const catVal  = result.category  || null;
        const typeVal = result.task_type || null;

        const frontmatter = [
            '---',
            `type: ${result.type}`,
            `name: "${esc(result.name)}"`,
            `cssclasses: [planner-task]`,
            `category: ${catVal ?? 'null'}`,
            `status: ${result.status}`,
            `priority: ${result.priority}`,
            `task_type: ${typeVal ?? 'null'}`,
            `parent_task: ${yamlLink(result.parent_task)}`,
            `depends_on:${depsStr}`,
            `blocks: []`,
            `blocked_reason: "${esc(result.blocked_reason)}"`,
            `assigned_to: "${esc(result.assigned_to)}"`,
            `source: ''`,
            `start_date: ${result.start_date ? `'${result.start_date}'` : 'null'}`,
            `due_date: ${result.due_date ? `'${result.due_date}'` : 'null'}`,
            `estimated_days: ${result.estimated_days ?? 'null'}`,
            `created: '${today}'`,
            `completed: null`,
            '---',
        ].join('\n');

        // Build body (Meta Bind header + optional Mermaid + user notes)
        const mermaid = buildMermaidDiagram(result);
        const bodyParts = [];
        if (mermaid) bodyParts.push(mermaid);
        if (result.notes) bodyParts.push(result.notes);
        const notesSection = bodyParts.length ? bodyParts.join('\n\n') + '\n' : '';
        const body = '\n' + buildMetaBindHeader() + notesSection;

        await app.vault.create(filePath, frontmatter + body);

        // Sync blocks on depends_on targets
        for (const dep of result.depends_on) {
            const depFile = app.vault.getAbstractFileByPath(dep.file.path);
            if (!depFile) continue;
            try {
                const cleanPath = filePath.replace(/\.md$/, '');
                await app.fileManager.processFrontMatter(depFile, (fm) => {
                    const current = Array.isArray(fm.blocks) ? fm.blocks : [];
                    const already = current.some(b => String(b || '').includes(cleanPath));
                    if (!already) fm.blocks = [...current, `[[${cleanPath}|${result.name}]]`];
                });
            } catch (e) {
                console.warn(`CreateTask: could not update blocks on ${dep.file.path}:`, e);
            }
        }

        // Open new file
        const newFile = app.vault.getAbstractFileByPath(filePath);
        if (newFile) {
            const leaf = app.workspace.getLeaf('tab');
            await leaf.openFile(newFile);
        }

        new Notice(`Created: ${result.name}`);

    } catch (error) {
        if (error.name === 'MacroAbortError') { params.abort(error.message); return; }
        console.error('CreateTask:', error);
        new Notice(`Error: ${error.message}`, 5000);
    }
}

// ── Meta Bind GUI header ───────────────────────────────────────────────────────
function buildMetaBindHeader() {
    return [
        '# `VIEW[{name}][text]`',
        '',
        '| Field | |',
        '|:------|:---|',
        '| **Status** | `INPUT[inlineSelect(option(Active), option(Future), option(In Progress), option(Hold), option(Blocked), option(Cancelled)):status]` |',
        '| **Priority** | `INPUT[inlineSelect(option(High), option(Medium), option(Low), option(None)):priority]` |',
        '| **Category** | `INPUT[inlineSelect(option(database), option(general)):category]` |',
        '| **Due Date** | `INPUT[date:due_date]` |',
        '| **Start Date** | `INPUT[date:start_date]` |',
        '| **Task Type** | `INPUT[inlineSelect(option(feature), option(bug), option(research), option(docs), option(action)):task_type]` |',
        '| **Assigned To** | `INPUT[text:assigned_to]` |',
        '| **Est. Days** | `INPUT[number:estimated_days]` |',
        '| **Blocked Reason** | `INPUT[text:blocked_reason]` |',
        '',
        '```meta-bind-button',
        'style: primary',
        'label: ✓ Mark Complete',
        'id: mark-complete',
        'actions:',
        '  - type: updateMetadata',
        '    bindTarget: status',
        '    evaluate: false',
        '    value: Done',
        '```',
        '',
        '---',
        '',
    ].join('\n');
}

// ── Mermaid diagram generator ──────────────────────────────────────────────────
function buildMermaidDiagram(result) {
    const hasParent = !!result.parent_task;
    const hasDeps   = result.depends_on.length > 0;
    if (!hasParent && !hasDeps) return '';

    const sanitize = s => String(s || '').replace(/"/g, "'").replace(/[[\]]/g, '');
    const nodeId   = (path) => 'n' + path.replace(/[^a-zA-Z0-9]/g, '').slice(-8);
    const currId   = 'current';

    const lines = ['```mermaid', 'flowchart TD'];

    if (hasParent) {
        const pid = nodeId(result.parent_task.file.path);
        lines.push(`    ${pid}["📁 ${sanitize(result.parent_task.name)}"]:::proj`);
        lines.push(`    ${pid} --> ${currId}`);
    }

    for (const dep of result.depends_on) {
        const did = nodeId(dep.file.path);
        lines.push(`    ${did}["${sanitize(dep.name)}"]:::dep`);
        lines.push(`    ${did} -.->|before| ${currId}`);
    }

    lines.push(`    ${currId}["◆ ${sanitize(result.name)}"]:::curr`);
    lines.push('    classDef proj fill:#7c3aed,color:#fff,rx:6');
    lines.push('    classDef dep  fill:#4b5563,color:#fff');
    lines.push('    classDef curr fill:#0284c7,color:#fff,stroke:#38bdf8,stroke-width:2px');
    lines.push('```');

    return lines.join('\n');
}
