module.exports = {
    entry: start,
    settings: {
        name: "Attachment Pole Check-In Script",
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
    const variables = params.variables;
    const Modal = params.obsidian?.Modal ?? globalThis.Modal;
    const Notice = params.obsidian?.Notice ?? globalThis.Notice;

    const entryDate = moment();
    const entry_date_display = entryDate.format("YYYY-MM-DDTHH:mm");

    if (!Modal) {
        new Notice("Obsidian Modal is not available.", 5000);
        return;
    }

    const sharedStyles = await loadScriptModule(app, 'SharedCheckInStyles.js');
    const sharedData = await loadScriptModule(app, 'SharedCheckInData.js');
    if (!sharedStyles || !sharedData) {
        new Notice("Missing shared check-in modules. Ensure Scripts/SharedCheckInStyles.js and Scripts/SharedCheckInData.js exist.", 7000);
        return;
    }

    const getPoleCheckInCss = sharedStyles.getPoleCheckInCss ?? (() => '');
    const {
        BODY_ZONES,
        SENSATION_COLOURS,
        SENSATION_TYPES,
        ZONE_LABEL_POS,
        lightenHex
    } = sharedData;

    // ─── CSS ────────────────────────────────────────────────────────────────────
    const CSS = getPoleCheckInCss();

    // ─── Modal ──────────────────────────────────────────────────────────────────
    class PoleCheckInModal extends Modal {
        constructor(app, resolve) {
            super(app);
            this._resolve = resolve;
            this._resolved = false;

            this.pole = null;
            this.intensity = null;
            this.bodySelections = [];
            this.noneSelected = false;
            this._activePopup = null;
            this._zonePaths = {};
        }

        onOpen() {
            const { contentEl } = this;
            this.setTitle('Attachment Pole Check-In');
            contentEl.classList.add('pole-modal');

            const styleEl = contentEl.createEl('style');
            styleEl.textContent = CSS;

            const form = contentEl.createDiv({ cls: 'form-body' });

            // ── Pole selector ───────────────────────────────────────────────
            const poleGroup = form.createDiv({ cls: 'field-group' });
            poleGroup.createEl('h3', { text: 'Which pole?' });
            const poleRow = poleGroup.createDiv({ cls: 'pole-selector' });
            const anxBtn = poleRow.createEl('button', { cls: 'pole-btn anxious' });
            anxBtn.innerHTML = '\uD83D\uDD34 Anxious';
            const avBtn = poleRow.createEl('button', { cls: 'pole-btn avoidant' });
            avBtn.innerHTML = '\uD83D\uDD35 Avoidant';
            anxBtn.addEventListener('click', () => {
                this.pole = 'Anxious';
                anxBtn.classList.add('selected');
                avBtn.classList.remove('selected');
            });
            avBtn.addEventListener('click', () => {
                this.pole = 'Avoidant';
                avBtn.classList.add('selected');
                anxBtn.classList.remove('selected');
            });

            // ── Intensity ───────────────────────────────────────────────────
            const intGroup = form.createDiv({ cls: 'field-group' });
            intGroup.createEl('h3', { text: 'Intensity' });
            const intRow = intGroup.createDiv({ cls: 'intensity-row' });
            const intCircles = [];
            for (let i = 1; i <= 5; i++) {
                const circle = intRow.createDiv({ cls: 'intensity-circle' });
                circle.textContent = String(i);
                circle.addEventListener('click', () => {
                    this.intensity = i;
                    intCircles.forEach(c => c.classList.remove('selected'));
                    circle.classList.add('selected');
                });
                intCircles.push(circle);
            }

            // ── Body signal (zone picker) ────────────────────────────────────
            const bodyGroup = form.createDiv({ cls: 'field-group' });
            bodyGroup.createEl('h3', { text: 'Body signal' });
            bodyGroup.createEl('p', { text: 'Tap a region, then choose a sensation.', cls: 'hint' });
            this._buildBodyZonePicker(bodyGroup);

            // ── Behavioral cue ──────────────────────────────────────────────
            const cueGroup = form.createDiv({ cls: 'field-group' });
            cueGroup.createEl('h3', { text: 'Behavioral cue' });
            this._cueInput = cueGroup.createEl('input');
            this._cueInput.type = 'text';
            this._cueInput.placeholder = 'What tipped you off? (e.g. over-explaining, pulling away)';

            // ── Context ─────────────────────────────────────────────────────
            const ctxGroup = form.createDiv({ cls: 'field-group' });
            ctxGroup.createEl('h3', { text: 'Context' });
            this._ctxInput = ctxGroup.createEl('input');
            this._ctxInput.type = 'text';
            this._ctxInput.placeholder = 'Anything else? (optional)';
            this._ctxInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); this._save(); }
            });

            // ── Buttons ─────────────────────────────────────────────────────
            const btnRow = form.createDiv({ cls: 'btn-row' });
            const cancelBtn = btnRow.createEl('button', { text: 'Cancel' });
            cancelBtn.addEventListener('click', () => this.cancel());
            const saveBtn = btnRow.createEl('button', { text: 'Save' });
            saveBtn.classList.add('primary');
            saveBtn.addEventListener('click', () => this._save());
        }

        // ── Body zone picker ────────────────────────────────────────────────
        _buildBodyZonePicker(parent) {
            const bodyWrap = parent.createDiv({ cls: 'body-zone-wrap' });
            const svgNS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(svgNS, 'svg');
            svg.setAttribute('viewBox', '0 0 200 440');
            svg.setAttribute('xmlns', svgNS);
            svg.style.width = '100%';
            svg.style.height = 'auto';

            BODY_ZONES.forEach(zone => {
                const path = document.createElementNS(svgNS, 'path');
                path.setAttribute('d', zone.path);
                path.classList.add('zone-path');
                path.dataset.zone = zone.id;
                if (zone.opacity) { path.style.opacity = zone.opacity; }

                path.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._closePopup();
                    this._clearNone();
                    this._showZoneSensationPopup(zone.id, e);
                });
                path.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this._closePopup();
                    this._clearNone();
                    const touch = e.changedTouches[0];
                    this._showZoneSensationPopup(zone.id, { clientX: touch.clientX, clientY: touch.clientY });
                });

                svg.appendChild(path);
                this._zonePaths[zone.id] = path;

                const pos = ZONE_LABEL_POS[zone.id];
                if (pos) {
                    if (pos.lx1 !== undefined) {
                        const line = document.createElementNS(svgNS, 'line');
                        line.setAttribute('x1', pos.lx1);
                        line.setAttribute('y1', pos.ly1);
                        line.setAttribute('x2', pos.lx2);
                        line.setAttribute('y2', pos.ly2);
                        line.setAttribute('stroke', 'var(--text-faint)');
                        line.setAttribute('stroke-width', '0.75');
                        line.style.pointerEvents = 'none';
                        svg.appendChild(line);
                    }
                    const text = document.createElementNS(svgNS, 'text');
                    text.classList.add('zone-label');
                    text.setAttribute('x', pos.x);
                    text.setAttribute('y', pos.y);
                    text.setAttribute('text-anchor', pos.anchor);
                    if (pos.rotate !== undefined) {
                        text.setAttribute('transform', `rotate(${pos.rotate}, ${pos.x}, ${pos.y})`);
                    }
                    if (pos.lines) {
                        pos.lines.forEach((line, i) => {
                            const tspan = document.createElementNS(svgNS, 'tspan');
                            tspan.setAttribute('x', pos.x);
                            tspan.setAttribute('dy', i === 0 ? '0' : '1.2em');
                            tspan.textContent = line;
                            text.appendChild(tspan);
                        });
                    } else {
                        text.textContent = zone.label;
                    }
                    text.addEventListener('mouseenter', () => {
                        const p = this._zonePaths[zone.id];
                        if (p) p.classList.add('label-hover');
                    });
                    text.addEventListener('mouseleave', () => {
                        const p = this._zonePaths[zone.id];
                        if (p) p.classList.remove('label-hover');
                    });
                    text.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this._closePopup();
                        this._clearNone();
                        this._showZoneSensationPopup(zone.id, e);
                    });
                    text.addEventListener('touchend', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this._closePopup();
                        this._clearNone();
                        const touch = e.changedTouches[0];
                        this._showZoneSensationPopup(zone.id, { clientX: touch.clientX, clientY: touch.clientY });
                    });
                    svg.appendChild(text);
                }
            });

            bodyWrap.appendChild(svg);

            const noneBtn = parent.createEl('button', { text: 'No body sensation', cls: 'none-btn' });
            this._noneBtn = noneBtn;
            noneBtn.addEventListener('click', () => {
                this._closePopup();
                this.noneSelected = !this.noneSelected;
                noneBtn.classList.toggle('active', this.noneSelected);
                if (this.noneSelected) {
                    this.bodySelections = [];
                    this._updateZoneHighlights();
                    this._updateZonePills();
                }
            });

            this._zonePillsEl = parent.createDiv({ cls: 'zone-pills' });
            this._updateZonePills();
        }

        _showZoneSensationPopup(zoneId, event) {
            const popup = document.createElement('div');
            popup.classList.add('sensation-popup');
            this.contentEl.appendChild(popup);
            this._activePopup = popup;

            const x = event.clientX || 0;
            const y = event.clientY || 0;
            popup.style.left = `${x + 8}px`;
            popup.style.top = `${y - 10}px`;

            requestAnimationFrame(() => {
                const rect = popup.getBoundingClientRect();
                if (rect.right > window.innerWidth) popup.style.left = `${x - rect.width - 8}px`;
                if (rect.bottom > window.innerHeight) popup.style.top = `${y - rect.height}px`;
            });

            SENSATION_TYPES.forEach(type => {
                const btn = document.createElement('button');
                btn.textContent = type;
                btn.style.borderLeft = `3px solid ${SENSATION_COLOURS[type]}`;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._addBodySelection(zoneId, type);
                    this._closePopup();
                });
                popup.appendChild(btn);
            });

            const cancel = document.createElement('button');
            cancel.textContent = '\u2715 cancel';
            cancel.style.width = '100%';
            cancel.style.flex = '1 1 100%';
            cancel.style.color = 'var(--text-muted)';
            cancel.addEventListener('click', (e) => {
                e.stopPropagation();
                this._closePopup();
            });
            popup.appendChild(cancel);

            const outsideHandler = (e) => {
                if (!popup.contains(e.target)) {
                    this._closePopup();
                    document.removeEventListener('click', outsideHandler, true);
                }
            };
            setTimeout(() => document.addEventListener('click', outsideHandler, true), 50);
        }

        _closePopup() {
            if (this._activePopup) {
                try { this._activePopup.remove(); } catch (e) {}
                this._activePopup = null;
            }
        }

        _clearNone() {
            if (this.noneSelected) {
                this.noneSelected = false;
                this._noneBtn.classList.remove('active');
                this._updateZonePills();
            }
        }

        _addBodySelection(zoneId, sensation) {
            const existing = this.bodySelections.findIndex(s => s.zone === zoneId);
            if (existing >= 0) {
                this.bodySelections[existing].sensation = sensation;
            } else {
                this.bodySelections.push({ zone: zoneId, sensation });
            }
            this.noneSelected = false;
            this._noneBtn.classList.remove('active');
            this._updateZoneHighlights();
            this._updateZonePills();
        }

        _removeBodySelection(zoneId) {
            this.bodySelections = this.bodySelections.filter(s => s.zone !== zoneId);
            this._updateZoneHighlights();
            this._updateZonePills();
        }

        _updateZoneHighlights() {
            const selMap = new Map(this.bodySelections.map(s => [s.zone, s.sensation]));
            Object.entries(this._zonePaths).forEach(([id, path]) => {
                const sensation = selMap.get(id);
                if (sensation) {
                    const hex = SENSATION_COLOURS[sensation] || '#2ea3f2';
                    path.classList.add('selected');
                    path.style.fill = lightenHex(hex, 22);
                    path.style.stroke = hex;
                    path.style.strokeWidth = '2';
                } else {
                    path.classList.remove('selected');
                    path.style.fill = '';
                    path.style.stroke = '';
                    path.style.strokeWidth = '';
                }
            });
        }

        _updateZonePills() {
            if (!this._zonePillsEl) return;
            this._zonePillsEl.empty();
            if (this.bodySelections.length === 0 && !this.noneSelected) {
                this._zonePillsEl.createEl('span', { text: 'No regions selected yet.', cls: 'hint' });
                return;
            }
            if (this.noneSelected) {
                this._zonePillsEl.createEl('span', { text: 'None (no body sensation)', cls: 'hint' });
                return;
            }
            this.bodySelections.forEach(sel => {
                const pill = this._zonePillsEl.createDiv({ cls: 'zone-pill' });
                const dot = pill.createDiv({ cls: 'pill-dot' });
                dot.style.background = SENSATION_COLOURS[sel.sensation];
                pill.createEl('span', { text: `${sel.zone}(${sel.sensation})` });
                pill.createEl('span', { text: '\u2715', cls: 'pill-x' });
                pill.addEventListener('click', () => this._removeBodySelection(sel.zone));
            });
        }

        // ── Save ────────────────────────────────────────────────────────────
        _save() {
            if (this._resolved) return;
            if (!this.pole) {
                new Notice('Please select a pole first.', 3000);
                return;
            }
            this._closePopup();

            let bodySignal;
            if (this.noneSelected) {
                bodySignal = 'none';
            } else if (this.bodySelections.length > 0) {
                bodySignal = this.bodySelections.map(s => `${s.zone}(${s.sensation})`).join(', ');
            } else {
                bodySignal = '';
            }

            this._resolved = true;
            this._resolve({
                date_display: entry_date_display,
                pole: this.pole,
                intensity: this.intensity,
                bodySignal,
                behavioralCue: this._cueInput?.value?.trim() || '',
                context: this._ctxInput?.value?.trim() || '',
            });
            this.close();
        }

        cancel() {
            if (this._resolved) return;
            this._closePopup();
            this._resolved = true;
            this._resolve(null);
            this.close();
        }

        onClose() {
            this._closePopup();
            this.contentEl.empty();
        }

        static prompt(app) {
            return new Promise((resolve) => {
                new PoleCheckInModal(app, resolve).open();
            });
        }
    }

    // ─── Launch modal ───────────────────────────────────────────────────────────
    try {
        const result = await PoleCheckInModal.prompt(app);
        if (!result) {
            params.abort('Cancelled');
            return;
        }

        variables.timestamp = result.date_display;
        variables.pole = result.pole;
        variables.intensity = result.intensity !== null ? result.intensity : '';
        variables.body_signal = result.bodySignal;
        variables.behavioral_cue = result.behavioralCue;
        variables.context = result.context;

        // Gate future pole prompts if done manually
        try {
            await fetch('https://ha.twdickson.com/api/webhook/pole_checkin_completed', { method: 'POST' });
        } catch (e) { /* ignore network errors */ }

    } catch (error) {
        if (error.name === 'MacroAbortError') {
            params.abort(error.message);
            return;
        }
        console.error("Pole Check-In Script:", error);
        new Notice(`Error: ${error.message}`, 5000);
    }
}
