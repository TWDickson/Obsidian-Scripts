module.exports = {
    entry: start,
    settings: {
        name: "Emotion Check-In Script",
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

    const getEmotionCheckInCss = sharedStyles.getEmotionCheckInCss ?? (() => '');
    const {
        BODY_ZONES,
        SENSATION_COLOURS,
        SENSATION_TYPES,
        ZONE_LABEL_POS,
        lightenHex
    } = sharedData;

    // ─── CSS ────────────────────────────────────────────────────────────────────
    const SHARED_CSS = getEmotionCheckInCss();

    // ─── Modal ──────────────────────────────────────────────────────────────────
    class EmotionCheckInModal extends Modal {
        constructor(app, resolve) {
            super(app);
            this._resolve = resolve;
            this._resolved = false;

            this.valence = null;
            this.arousal = null;
            this.bodySelections = []; // [{zone, sensation}]
            this.noneSelected = false;
            this.triggerNote = '';
            this.currentStep = 0;
            this._activePopup = null;
        }

        onOpen() {
            const { contentEl } = this;
            this.setTitle('Emotion Check-In');
            contentEl.classList.add('emotion-modal');

            const styleEl = contentEl.createEl('style');
            styleEl.textContent = SHARED_CSS;

            // Step indicators
            const indicators = contentEl.createDiv({ cls: 'step-indicators' });
            this._stepDots = [0, 1, 2].map(i => {
                return indicators.createDiv({ cls: 'step-dot' + (i === 0 ? ' active' : '') });
            });

            // Steps
            this._steps = [
                this._buildCircumplexStep(contentEl),
                this._buildBodyStep(contentEl),
                this._buildTriggerStep(contentEl),
            ];

            // Nav buttons
            const btnRow = contentEl.createDiv({ cls: 'btn-row' });
            this._skipBtn = btnRow.createEl('span', { text: 'Skip', cls: 'skip-link' });
            this._skipBtn.addEventListener('click', () => this._nextStep(true));
            this._backBtn = btnRow.createEl('button', { text: '\u2190 Back' });
            this._backBtn.style.display = 'none';
            this._backBtn.addEventListener('click', () => this._prevStep());
            this._nextBtn = btnRow.createEl('button', { text: 'Next \u2192' });
            this._nextBtn.classList.add('primary');
            this._nextBtn.addEventListener('click', () => this._nextStep(false));

            this._updateStepUI();
        }

        // ── Step 0: Circumplex ──────────────────────────────────────────────
        _buildCircumplexStep(parent) {
            const step = parent.createDiv({ cls: 'step active' });
            step.createEl('h3', { text: 'How are you feeling?' });
            step.createEl('p', { text: 'Tap to place your emotional state on the grid.', cls: 'hint' });

            const wrap = step.createDiv({ cls: 'canvas-wrap' });
            const canvas = wrap.createEl('canvas');
            const dpr = window.devicePixelRatio || 1;
            canvas.width = 400 * dpr;
            canvas.height = 400 * dpr;
            this._canvas = canvas;
            this._ctx = canvas.getContext('2d');
            this._ctx.scale(dpr, dpr);

            // Quadrant labels
            const labels = [
                { text: 'Tense / Anxious',   top: '6px',    left: '8px' },
                { text: 'Excited / Alert',    top: '6px',    right: '8px' },
                { text: 'Sad / Depressed',    bottom: '6px', left: '8px' },
                { text: 'Calm / Relaxed',     bottom: '6px', right: '8px' },
            ];
            labels.forEach(l => {
                const el = wrap.createDiv({ cls: 'circumplex-label' });
                el.textContent = l.text;
                if (l.top) el.style.top = l.top;
                if (l.bottom) el.style.bottom = l.bottom;
                if (l.left) el.style.left = l.left;
                if (l.right) { el.style.right = l.right; el.style.textAlign = 'right'; }
            });

            // Coordinate readout
            this._coordReadout = step.createDiv({ cls: 'coord-readout' });
            this._coordReadout.textContent = 'Tap the grid above';

            this._drawCircumplex();

            const onTap = (e) => {
                e.preventDefault();
                const rect = canvas.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                // Map to logical 400×400 space (independent of dpr or display size)
                const cx = (clientX - rect.left) * (400 / rect.width);
                const cy = (clientY - rect.top) * (400 / rect.height);

                // Convert to -5..+5
                const rawV = ((cx / 400) * 10) - 5;
                const rawA = -(((cy / 400) * 10) - 5);
                this.valence = Math.round(rawV); // snap to integer
                this.arousal = Math.round(rawA);
                // Clamp
                this.valence = Math.max(-5, Math.min(5, this.valence));
                this.arousal = Math.max(-5, Math.min(5, this.arousal));

                this._drawCircumplex(cx, cy);
                this._coordReadout.textContent = `Valence: ${this.valence >= 0 ? '+' : ''}${this.valence}  |  Arousal: ${this.arousal >= 0 ? '+' : ''}${this.arousal}`;
            };

            canvas.addEventListener('click', onTap);
            canvas.addEventListener('touchstart', onTap, { passive: false });

            return step;
        }

        _drawCircumplex(dotX, dotY) {
            const ctx = this._ctx;
            const w = 400; // logical size; canvas backing store is scaled by dpr
            const h = 400;
            ctx.clearRect(0, 0, w, h);

            // Quadrant backgrounds
            const quads = [
                { x: 0,   y: 0,   color: 'rgba(220,80,80,0.08)'  },
                { x: w/2, y: 0,   color: 'rgba(80,180,100,0.08)' },
                { x: 0,   y: h/2, color: 'rgba(80,100,200,0.08)' },
                { x: w/2, y: h/2, color: 'rgba(100,200,180,0.08)'},
            ];
            quads.forEach(q => {
                ctx.fillStyle = q.color;
                ctx.fillRect(q.x, q.y, w/2, h/2);
            });

            // Grid lines at integer values
            ctx.strokeStyle = 'rgba(150,150,150,0.15)';
            ctx.lineWidth = 0.5;
            for (let i = -4; i <= 4; i++) {
                if (i === 0) continue;
                const px = ((i + 5) / 10) * w;
                const py = ((5 - i) / 10) * h;
                ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
            }

            // Center axes (thicker, dashed)
            ctx.strokeStyle = 'rgba(150,150,150,0.4)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(w/2, 0); ctx.lineTo(w/2, h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, h/2); ctx.lineTo(w, h/2); ctx.stroke();
            ctx.setLineDash([]);

            // Axis labels
            ctx.fillStyle = 'rgba(60,60,60,1)';
            ctx.font = '11px var(--font-interface, sans-serif)';
            ctx.textAlign = 'center';
            ctx.fillText('High Energy (+5)', w/2, 14);
            ctx.fillText('Low Energy (-5)', w/2, h - 4);
            ctx.save();
            ctx.translate(12, h/2);
            ctx.rotate(-Math.PI/2);
            ctx.fillText('Unpleasant (-5)', 0, 0);
            ctx.restore();
            ctx.save();
            ctx.translate(w - 12, h/2);
            ctx.rotate(Math.PI/2);
            ctx.fillText('Pleasant (+5)', 0, 0);
            ctx.restore();

            // Scale numbers along edges
            ctx.font = '9px var(--font-interface, sans-serif)';
            ctx.fillStyle = 'rgba(60,60,60,1)';
            for (let i = -4; i <= 4; i += 2) {
                if (i === 0) continue;
                const px = ((i + 5) / 10) * w;
                ctx.textAlign = 'center';
                ctx.fillText(String(i), px, h/2 + 12);
                const py = ((5 - i) / 10) * h;
                ctx.textAlign = 'right';
                ctx.fillText(String(i), w/2 - 4, py + 3);
            }

            // Dot
            if (dotX !== undefined && dotY !== undefined) {
                const grad = ctx.createRadialGradient(dotX, dotY, 2, dotX, dotY, 18);
                grad.addColorStop(0, 'rgba(46,163,242, 0.35)');
                grad.addColorStop(1, 'rgba(46,163,242, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(dotX, dotY, 18, 0, Math.PI*2); ctx.fill();

                ctx.fillStyle = 'var(--interactive-accent, #2ea3f2)';
                ctx.beginPath(); ctx.arc(dotX, dotY, 8, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }

        // ── Step 1: Body zones ──────────────────────────────────────────────
        _buildBodyStep(parent) {
            const step = parent.createDiv({ cls: 'step' });
            step.createEl('h3', { text: 'Where do you feel it?' });
            step.createEl('p', { text: 'Tap a body region, then choose a sensation.', cls: 'hint' });

            const bodyWrap = step.createDiv({ cls: 'body-zone-wrap' });
            const svgNS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(svgNS, 'svg');
            svg.setAttribute('viewBox', '0 0 200 440');
            svg.setAttribute('xmlns', svgNS);
            svg.style.width = '100%';
            svg.style.height = 'auto';

            this._zonePaths = {};

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

            // "No body sensation" button
            const noneBtn = step.createEl('button', { text: 'No body sensation', cls: 'none-btn' });
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

            // Selected zone pills
            this._zonePillsEl = step.createDiv({ cls: 'zone-pills' });
            this._updateZonePills();

            return step;
        }

        _showZoneSensationPopup(zoneId, event) {
            const popup = document.createElement('div');
            popup.classList.add('sensation-popup');
            this.contentEl.appendChild(popup);
            this._activePopup = popup;

            // Position near click/touch
            const x = event.clientX || 0;
            const y = event.clientY || 0;
            popup.style.left = `${x + 8}px`;
            popup.style.top = `${y - 10}px`;

            // Adjust if off-screen after render
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

            // Cancel
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

            // Close on outside click
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
            // Replace if same zone already selected, otherwise add
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
                    // create a lighter fill by increasing HSL lightness
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

        // ── Step 2: Trigger ─────────────────────────────────────────────────
        _buildTriggerStep(parent) {
            const step = parent.createDiv({ cls: 'step' });
            step.createEl('h3', { text: 'What just happened?' });
            step.createEl('p', { text: 'Optional \u2014 a word or two about the trigger.', cls: 'hint' });

            this._triggerInput = step.createEl('input');
            this._triggerInput.type = 'text';
            this._triggerInput.placeholder = 'What just happened? (optional)';
            this._triggerInput.maxLength = 90;
            this._triggerInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); this._save(); }
            });

            return step;
        }

        // ── Navigation ──────────────────────────────────────────────────────
        _nextStep() {
            if (this.currentStep === 2) { this._save(); return; }
            this.currentStep++;
            this._updateStepUI();
        }

        _prevStep() {
            if (this.currentStep === 0) return;
            this.currentStep--;
            this._updateStepUI();
        }

        _updateStepUI() {
            const n = this.currentStep;
            this._steps.forEach((s, i) => s.classList.toggle('active', i === n));
            this._stepDots.forEach((d, i) => d.classList.toggle('active', i === n));
            this._backBtn.style.display = n === 0 ? 'none' : '';
            this._nextBtn.textContent = n === 2 ? 'Save' : 'Next \u2192';
            this._skipBtn.style.display = n === 2 ? 'none' : '';

            if (n === 2) {
                setTimeout(() => { try { this._triggerInput.focus(); } catch(e){} }, 80);
            }
            if (n === 0 && this.valence !== null) {
                const cx = ((this.valence + 5) / 10) * 400;
                const cy = ((-this.arousal + 5) / 10) * 400;
                this._drawCircumplex(cx, cy);
            }
        }

        // ── Save ────────────────────────────────────────────────────────────
        _save() {
            if (this._resolved) return;
            this._closePopup();
            this._resolved = true;
            this._resolve({
                date_display: entry_date_display,
                valence: this.valence,
                arousal: this.arousal,
                bodySelections: this.bodySelections.slice(),
                noneSelected: this.noneSelected,
                trigger: this._triggerInput?.value?.trim() || '',
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
                new EmotionCheckInModal(app, resolve).open();
            });
        }
    }

    // ─── Launch modal ───────────────────────────────────────────────────────────
    try {
        const result = await EmotionCheckInModal.prompt(app);
        if (!result) {
            params.abort('Cancelled');
            return;
        }

        // Format body zones
        let bodyText;
        if (result.noneSelected) {
            bodyText = 'none';
        } else if (result.bodySelections.length > 0) {
            bodyText = result.bodySelections.map(s => `${s.zone}(${s.sensation})`).join(', ');
        } else {
            bodyText = '';
        }

        // Map to QuickAdd variables for Capture template
        variables.timestamp = result.date_display;
        variables.valence = result.valence !== null ? result.valence : '';
        variables.arousal = result.arousal !== null ? result.arousal : '';
        variables.body_zones = bodyText;
        variables.trigger = result.trigger || '';

        // Fire webhook to increment daily compliance counter
        try {
            await fetch('https://ha.twdickson.com/api/webhook/emotion_checkin_completed', { method: 'POST' });
        } catch (e) { /* ignore network errors */ }

    } catch (error) {
        if (error.name === 'MacroAbortError') {
            params.abort(error.message);
            return;
        }
        console.error("Emotion Check-In Script:", error);
        new Notice(`Error: ${error.message}`, 5000);
    }
}
