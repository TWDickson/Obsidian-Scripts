module.exports = {
    entry: start,
    settings: {
        name: "Emotion Check-In Script",
        author: "Taylor Dickson"
    }
};

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

    // ─── Body zone definitions ──────────────────────────────────────────────────
    // Each zone maps to an SVG region on a 200x440 viewBox body silhouette.
    // Paths are smooth curves for a more natural, anatomical look.
    const BODY_ZONES = [
        { id: 'head',       label: 'Head',        path: 'M100,8 C78,8 62,28 62,52 C62,76 78,92 100,92 C122,92 138,76 138,52 C138,28 122,8 100,8Z' },
        { id: 'jaw',        label: 'Jaw',         path: 'M78,72 C78,88 88,100 100,100 C112,100 122,88 122,72 C120,82 112,90 100,90 C88,90 80,82 78,72Z' },
        { id: 'throat',     label: 'Throat',      path: 'M88,98 C88,98 92,96 100,96 C108,96 112,98 112,98 L114,116 C114,116 108,118 100,118 C92,118 86,116 86,116Z' },
        { id: 'shoulders',  label: 'Shoulders',   path: 'M86,116 C70,118 42,124 28,134 C22,138 20,144 22,150 L46,146 C52,140 66,132 86,128Z M114,116 C130,118 158,124 172,134 C178,138 180,144 178,150 L154,146 C148,140 134,132 114,128Z' },
        { id: 'chest',      label: 'Chest',       path: 'M66,128 C62,128 58,132 58,138 L58,180 C58,184 62,188 66,188 L134,188 C138,188 142,184 142,180 L142,138 C142,132 138,128 134,128Z' },
        { id: 'stomach',    label: 'Stomach',     path: 'M62,188 C60,188 58,190 58,194 L60,246 C60,250 64,254 68,254 L132,254 C136,254 140,250 140,246 L142,194 C142,190 140,188 138,188Z' },
        { id: 'arms',       label: 'Arms',        path: 'M22,150 C16,184 10,216 8,244 L24,248 C24,216 32,184 36,154Z M178,150 C184,184 190,216 192,244 L176,248 C176,216 168,184 164,154Z' },
        { id: 'hands',      label: 'Hands',       path: 'M14,244 C6,244 0,254 2,266 C4,278 12,286 20,284 C24,282 26,278 26,272 L28,252 C26,246 20,242 14,244Z M186,244 C194,244 200,254 198,266 C196,278 188,286 180,284 C176,282 174,278 174,272 L172,252 C174,246 180,242 186,244Z' },
        { id: 'lower-back', label: 'Lower Back',  path: 'M68,222 L132,222 L132,254 L68,254Z', opacity: 0.35 },
        { id: 'legs',       label: 'Legs',        path: 'M62,254 C60,254 58,258 58,262 L56,370 C54,380 50,394 48,404 C46,412 44,420 50,424 C56,426 62,422 64,416 L70,380 C72,368 76,340 78,310 L80,270 C82,262 84,258 88,256Z M138,254 C140,254 142,258 142,262 L144,370 C146,380 150,394 152,404 C154,412 156,420 150,424 C144,426 138,422 136,416 L130,380 C128,368 124,340 122,310 L120,270 C118,262 116,258 112,256Z' },
    ];

    // ─── Sensation types & colours ──────────────────────────────────────────────
    const SENSATION_COLOURS = {
        // Activation / distress
        'tight':    '#e05c5c',   // red — constriction
        'tense':    '#c0504d',   // deep red — bracing/vigilance
        'heavy':    '#6b7ab5',   // slate blue — weight/depression
        'ache':     '#9b59b6',   // purple — grief, longing pain
        'hollow':   '#b0bec5',   // blue-grey — emptiness
        'numb':     '#9e9e9e',   // grey — shutdown/dissociation
        'braced':   '#d4845a',   // burnt orange — anticipatory tension

        // Activation / alive (positive or mixed)
        'buzzing':  '#f0c040',   // amber — energy, aliveness
        'flutter':  '#7ec8a4',   // mint green — lightness, positive anticipation
        'fire':     '#e8401c',   // ember red-orange — desire, hunger, aliveness
        'hunger':   '#c0773a',   // warm amber-brown — wanting, reaching

        // Ease / positive
        'warm':     '#e8884a',   // soft orange — comfort, safety
        'open':     '#87c4e0',   // sky blue — expansion, receptivity
        'settled':  '#7ab87a',   // sage green — groundedness, calm
        'ease':     '#a8d4a8',   // pale green — relief, softening
    };
    const SENSATION_TYPES = Object.keys(SENSATION_COLOURS);

    // ─── CSS ────────────────────────────────────────────────────────────────────
    const SHARED_CSS = `
        .emotion-modal {
            box-sizing: border-box;
            max-width: var(--modal-max-width);
            overflow-x: hidden;
        }
        .emotion-modal .step { display: none; flex-direction: column; gap: 12px; width: 90%; margin: 0 auto; padding-bottom: 16px; }
        .emotion-modal .step.active { display: flex; }
        .emotion-modal h3 { margin: 0 0 4px 0; font-size: 1rem; color: var(--text-normal); }
        .emotion-modal .hint { font-size: 0.85rem; color: var(--text-muted); margin: 0; }

        /* Canvas container */
        .emotion-modal .canvas-wrap {
            position: relative;
            width: 100%;
            border-radius: var(--radius-m, 8px);
            overflow: hidden;
            border: 1px solid var(--background-modifier-border);
            touch-action: none;
            cursor: crosshair;
        }
        .emotion-modal canvas {
            display: block;
            width: 100%;
            height: auto;
        }

        /* Quadrant labels on circumplex */
        .circumplex-label {
            position: absolute;
            font-size: 0.7rem;
            color: var(--text-faint);
            pointer-events: none;
            user-select: none;
        }

        /* Coordinate readout */
        .emotion-modal .coord-readout {
            text-align: center;
            font-size: 0.85rem;
            color: var(--text-muted);
            margin-top: 4px;
            min-height: 1.2em;
        }

        /* Body zone SVG */
        .emotion-modal .body-zone-wrap {
            position: relative;
            width: 55%;
            margin: 0 auto;
        }
        .emotion-modal .body-zone-wrap svg {
            display: block;
            width: 100%;
            height: auto;
        }
        .emotion-modal .zone-path {
            fill: transparent;
            stroke: var(--text-muted);
            stroke-width: 1.5;
            cursor: pointer;
            transition: fill 0.15s;
        }
        .emotion-modal .zone-path:hover {
            fill: rgba(var(--interactive-accent-rgb, 46,163,242), 0.15);
        }
        .emotion-modal .zone-path.selected {
            fill: rgba(var(--interactive-accent-rgb, 46,163,242), 0.25);
            stroke: var(--interactive-accent);
            stroke-width: 2;
        }
        .emotion-modal .zone-label {
            font-size: 12px;
            fill: var(--text-faint);
            pointer-events: none;
            user-select: none;
            text-anchor: middle;
        }

        /* Zone pills (selected zones + sensation) */
        .emotion-modal .zone-pills {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 8px;
            min-height: 28px;
        }
        .emotion-modal .zone-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 0.8rem;
            cursor: pointer;
            border: 1px solid var(--background-modifier-border);
            background: var(--background-secondary);
            color: var(--text-normal);
        }
        .emotion-modal .zone-pill .pill-dot {
            width: 8px; height: 8px;
            border-radius: 50%;
            flex-shrink: 0;
        }
        .emotion-modal .zone-pill .pill-x {
            margin-left: 4px;
            opacity: 0.5;
            font-size: 0.75rem;
        }
        .emotion-modal .zone-pill:hover .pill-x { opacity: 1; }

        /* No body sensation button */
        .emotion-modal .none-btn {
            margin-top: 4px;
            padding: 6px 14px;
            border-radius: var(--radius-m, 6px);
            border: 1px solid var(--background-modifier-border);
            background: transparent;
            color: var(--text-muted);
            cursor: pointer;
            font-size: 0.85rem;
            align-self: center;
        }
        .emotion-modal .none-btn:hover { background: var(--background-modifier-hover); }
        .emotion-modal .none-btn.active {
            background: var(--interactive-accent);
            color: var(--text-on-accent);
            border-color: transparent;
        }

        /* Sensation popup */
        .emotion-modal .sensation-popup {
            position: fixed;
            background: var(--background-primary);
            border: 1px solid var(--background-modifier-border);
            border-radius: var(--radius-m, 8px);
            box-shadow: var(--shadow-l);
            padding: 8px;
            z-index: 1000;
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            width: 220px;
        }
        .emotion-modal .sensation-popup button {
            flex: 1 1 auto;
            padding: 5px 8px;
            border-radius: 999px;
            border: 1px solid var(--background-modifier-border);
            background: var(--background-secondary);
            color: var(--text-normal);
            font-size: 0.8rem;
            cursor: pointer;
            white-space: nowrap;
        }
        .emotion-modal .sensation-popup button:hover {
            background: var(--interactive-accent);
            color: var(--text-on-accent);
            border-color: transparent;
        }

        /* Trigger input */
        .emotion-modal input[type="text"] {
            width: 100%;
            box-sizing: border-box;
            font-size: 0.95rem;
            padding: 8px 10px;
            border-radius: var(--radius-m, 6px);
            border: 1px solid var(--background-modifier-border);
            background: var(--background-primary);
            color: var(--text-normal);
        }
        .emotion-modal input::placeholder { color: var(--text-muted); }
        .emotion-modal input:focus {
            outline: none;
            border-color: var(--interactive-accent);
            box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb, 46,163,242), 0.25);
        }

        /* Step indicators */
        .emotion-modal .step-indicators {
            display: flex;
            gap: 6px;
            justify-content: center;
            margin-bottom: 4px;
        }
        .emotion-modal .step-dot {
            width: 8px; height: 8px;
            border-radius: 50%;
            background: var(--background-modifier-border);
            transition: background 0.2s;
        }
        .emotion-modal .step-dot.active { background: var(--interactive-accent); }

        /* Nav buttons */
        .emotion-modal .btn-row {
            margin-top: 8px;
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            width: 90%;
            margin-left: auto;
            margin-right: auto;
            padding-bottom: 4px;
        }
        .emotion-modal .btn-row button {
            padding: 8px 16px;
            border-radius: var(--radius-m, 6px);
            border: 1px solid var(--background-modifier-border);
            background: transparent;
            color: var(--text-normal);
            cursor: pointer;
            font-size: 0.95rem;
        }
        .emotion-modal .btn-row button:hover { background: var(--background-modifier-hover); }
        .emotion-modal .btn-row .primary {
            background: var(--interactive-accent);
            color: var(--text-on-accent);
            border-color: transparent;
        }
        .emotion-modal .btn-row .primary:hover { filter: brightness(0.95); }

        /* Skip link */
        .emotion-modal .skip-link {
            font-size: 0.8rem;
            color: var(--text-faint);
            cursor: pointer;
            text-decoration: underline;
            align-self: center;
            margin-right: auto;
        }
        .emotion-modal .skip-link:hover { color: var(--text-muted); }

        /* Mobile */
        .is-phone .emotion-modal .body-zone-wrap { width: 70%; }
        .is-phone .emotion-modal .sensation-popup { width: 180px; }
    `;

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

            // Zone label positions (center of each zone, approximate)
            const zoneLabelPos = {
                'head':       { x: 100, y: 55 },
                'jaw':        { x: 100, y: 86 },
                'throat':     { x: 100, y: 108 },
                'shoulders':  { x: 100, y: 132 },
                'chest':      { x: 100, y: 162 },
                'stomach':    { x: 100, y: 224 },
                'arms':       { x: 10,  y: 200 },
                'hands':      { x: 16,  y: 268 },
                'lower-back': { x: 100, y: 242 },
                'legs':       { x: 100, y: 340 },
            };

            this._zonePaths = {};

            BODY_ZONES.forEach(zone => {
                const path = document.createElementNS(svgNS, 'path');
                path.setAttribute('d', zone.path);
                path.classList.add('zone-path');
                path.dataset.zone = zone.id;
                if (zone.opacity) path.style.opacity = zone.opacity;

                path.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._closePopup();
                    if (this.noneSelected) return;
                    this._showZoneSensationPopup(zone.id, e);
                });
                path.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this._closePopup();
                    if (this.noneSelected) return;
                    const touch = e.changedTouches[0];
                    this._showZoneSensationPopup(zone.id, { clientX: touch.clientX, clientY: touch.clientY });
                });

                svg.appendChild(path);
                this._zonePaths[zone.id] = path;

                // Label
                const pos = zoneLabelPos[zone.id];
                if (pos) {
                    const text = document.createElementNS(svgNS, 'text');
                    text.classList.add('zone-label');
                    text.setAttribute('x', pos.x);
                    text.setAttribute('y', pos.y);
                    text.textContent = zone.label;
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
            const selectedIds = new Set(this.bodySelections.map(s => s.zone));
            Object.entries(this._zonePaths).forEach(([id, path]) => {
                path.classList.toggle('selected', selectedIds.has(id));
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
            this._triggerInput.maxLength = 60;
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
