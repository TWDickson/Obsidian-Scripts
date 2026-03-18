module.exports = {
    entry: start,
    settings: {
        name: "Attachment Pole Check-In Script",
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

    // ─── Body zone definitions (shared with EmotionCheckIn) ────────────────────
    const BODY_ZONES = [
        { id: 'head',       label: 'Head',       path: 'M100,8 C78,8 62,28 62,52 C62,76 78,92 100,92 C122,92 138,76 138,52 C138,28 122,8 100,8Z' },
        { id: 'eyes',       label: 'Eyes',       path: 'M80,36 L120,36 C124,36 126,39 126,44 C126,49 124,52 120,52 L80,52 C76,52 74,49 74,44 C74,39 76,36 80,36Z' },
        { id: 'throat',     label: 'Throat',     path: 'M88,98 C88,98 92,96 100,96 C108,96 112,98 112,98 L114,116 C114,116 108,118 100,118 C92,118 86,116 86,116Z' },
        { id: 'jaw',        label: 'Jaw',        path: 'M78,72 L122,72 C122,72 122,84 118,92 C114,98 108,102 100,102 C92,102 86,98 82,92 C78,84 78,72 78,72Z' },
        { id: 'shoulders',  label: 'Shoulders',  path: 'M86,116 C70,118 42,124 28,134 C22,138 20,144 22,150 L46,146 C52,140 66,132 86,128Z M114,116 C130,118 158,124 172,134 C178,138 180,144 178,150 L154,146 C148,140 134,132 114,128Z' },
        { id: 'chest',      label: 'Chest',      path: 'M66,128 C62,128 58,132 58,138 L58,180 C58,184 62,188 66,188 L134,188 C138,188 142,184 142,180 L142,138 C142,132 138,128 134,128Z' },
        { id: 'heart',      label: 'Heart',      path: 'M100,148 C97,142 88,142 88,151 C88,160 98,168 100,174 C102,168 112,160 112,151 C112,142 103,142 100,148Z' },
        { id: 'stomach',    label: 'Stomach',    path: 'M62,188 C60,188 58,190 58,194 L60,246 C60,250 64,254 68,254 L132,254 C136,254 140,250 140,246 L142,194 C142,190 140,188 138,188Z' },
        { id: 'lower-back', label: 'Lower Back', path: 'M68,222 L132,222 L132,254 L68,254Z', opacity: 0.35 },
        { id: 'hips',       label: 'Hips',       path: 'M68,254 L132,254 C136,254 140,258 140,264 L138,276 C134,288 118,294 100,294 C82,294 66,288 62,276 L60,264 C60,258 64,254 68,254Z' },
        { id: 'arms',       label: 'Arms',       path: 'M22,150 C16,184 10,216 8,244 L24,248 C24,216 32,184 36,154Z M178,150 C184,184 190,216 192,244 L176,248 C176,216 168,184 164,154Z' },
        { id: 'hands',      label: 'Hands',      path: 'M14,244 C6,244 0,254 2,266 C4,278 12,286 20,284 C24,282 26,278 26,272 L28,252 C26,246 20,242 14,244Z M186,244 C194,244 200,254 198,266 C196,278 188,286 180,284 C176,282 174,278 174,272 L172,252 C174,246 180,242 186,244Z' },
        { id: 'legs',       label: 'Legs',       path: 'M68,292 C64,292 60,296 60,302 L56,370 C54,380 50,394 48,404 C46,412 44,420 50,424 C56,426 62,422 64,416 L70,380 C72,368 76,340 78,310 L82,294Z M132,292 C136,292 140,296 140,302 L144,370 C146,380 150,394 152,404 C154,412 156,420 150,424 C144,426 138,422 136,416 L130,380 C128,368 124,340 122,310 L118,294Z' },
    ];

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

    function hexToHsl(hex) {
        const h = hex.replace('#', '');
        const r = parseInt(h.substring(0,2), 16) / 255;
        const g = parseInt(h.substring(2,4), 16) / 255;
        const b = parseInt(h.substring(4,6), 16) / 255;
        const max = Math.max(r,g,b), min = Math.min(r,g,b);
        let hh = 0, s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: hh = (g - b) / d + (g < b ? 6 : 0); break;
                case g: hh = (b - r) / d + 2; break;
                case b: hh = (r - g) / d + 4; break;
            }
            hh = hh * 60;
        }
        return { h: Math.round(hh), s: Math.round(s * 100), l: Math.round(l * 100) };
    }

    function hslToCss(h, s, l, alpha) {
        if (alpha === undefined || alpha === 1) return `hsl(${h}, ${s}%, ${l}%)`;
        return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
    }

    function lightenHex(hex, increasePercent) {
        const hsl = hexToHsl(hex);
        const newL = Math.min(100, hsl.l + increasePercent);
        return hslToCss(hsl.h, hsl.s, newL);
    }

    const ZONE_LABEL_POS = {
        'head':       { x: 100, y: 65,  anchor: 'middle' },
        'eyes':       { x: 150, y: 46,  anchor: 'start', lx1: 126, ly1: 44, lx2: 148, ly2: 46 },
        'jaw':        { x: 150, y: 88,  anchor: 'start', lx1: 122, ly1: 86, lx2: 148, ly2: 88 },
        'throat':     { x: 150, y: 108, anchor: 'start', lx1: 114, ly1: 107, lx2: 148, ly2: 108 },
        'shoulders':  { x: 57,  y: 120, anchor: 'middle', rotate: -17 },
        'chest':      { x: 100,  y: 140, anchor: 'middle' },
        'heart':      { x: 100,  y: 182, anchor: 'middle' },
        'stomach':    { x: 100, y: 218, anchor: 'middle' },
        'lower-back': { x: 100, y: 234, anchor: 'middle', lines: ['Lower', 'Back'] },
        'hips':       { x: 100, y: 278, anchor: 'middle' },
        'arms':       { x: 40,  y: 198, anchor: 'middle', rotate: -80 },
        'hands':      { x: 38,  y: 272, anchor: 'middle', rotate: -80 },
        'legs':       { x: 100, y: 358, anchor: 'middle' },
    };

    // ─── CSS ────────────────────────────────────────────────────────────────────
    const CSS = `
        .pole-modal {
            box-sizing: border-box;
            max-width: var(--modal-max-width);
            overflow-x: hidden;
        }
        .pole-modal .form-body {
            display: flex;
            flex-direction: column;
            gap: 14px;
            width: 90%;
            margin: 0 auto;
            padding-bottom: 16px;
        }
        .pole-modal h3 {
            margin: 0 0 2px 0;
            font-size: 1rem;
            color: var(--text-normal);
        }
        .pole-modal .hint {
            font-size: 0.85rem;
            color: var(--text-muted);
            margin: 0 0 4px 0;
        }

        /* Pole selector */
        .pole-modal .pole-selector {
            display: flex;
            gap: 10px;
            justify-content: center;
        }
        .pole-modal .pole-btn {
            flex: 1;
            padding: 14px 10px;
            border-radius: 999px;
            border: 2px solid var(--background-modifier-border);
            background: transparent;
            color: var(--text-normal);
            font-size: 1.05rem;
            font-weight: 600;
            cursor: pointer;
            text-align: center;
            transition: all 0.15s;
        }
        .pole-modal .pole-btn:hover { border-color: var(--text-muted); }
        .pole-modal .pole-btn.anxious.selected {
            background: #d94040;
            color: white;
            border-color: #d94040;
        }
        .pole-modal .pole-btn.avoidant.selected {
            background: #3b7dd8;
            color: white;
            border-color: #3b7dd8;
        }

        /* Intensity */
        .pole-modal .intensity-row {
            display: flex;
            gap: 10px;
            justify-content: center;
        }
        .pole-modal .intensity-circle {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: 2px solid var(--background-modifier-border);
            background: transparent;
            color: var(--text-normal);
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s;
        }
        .pole-modal .intensity-circle:hover { border-color: var(--text-muted); }
        .pole-modal .intensity-circle.selected {
            background: var(--interactive-accent);
            color: var(--text-on-accent);
            border-color: var(--interactive-accent);
        }

        /* Body zone SVG */
        .pole-modal .body-zone-wrap {
            position: relative;
            width: 42%;
            margin: 0 auto;
        }
        .pole-modal .body-zone-wrap svg {
            display: block;
            width: 100%;
            height: auto;
        }
        .pole-modal .zone-path {
            fill: var(--background-primary);
            stroke: var(--text-muted);
            stroke-width: 1.5;
            cursor: pointer;
            transition: fill 0.15s;
        }
        .pole-modal .zone-path:hover,
        .pole-modal .zone-path.label-hover {
            fill: var(--background-primary-alt, rgb(46,163,242));
        }
        .pole-modal .zone-path.selected {
            fill: var(--background-primary-alt, rgb(46,163,242));
            stroke: var(--interactive-accent);
            stroke-width: 2;
        }
        .pole-modal .zone-label {
            font-size: 10px;
            fill: var(--text-faint);
            pointer-events: all;
            cursor: pointer;
            user-select: none;
        }

        /* Zone pills */
        .pole-modal .zone-pills {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 6px;
            min-height: 26px;
        }
        .pole-modal .zone-pill {
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
        .pole-modal .zone-pill .pill-dot {
            width: 8px; height: 8px;
            border-radius: 50%;
            flex-shrink: 0;
        }
        .pole-modal .zone-pill .pill-x {
            margin-left: 4px;
            opacity: 0.5;
            font-size: 0.75rem;
        }
        .pole-modal .zone-pill:hover .pill-x { opacity: 1; }

        /* No body sensation button */
        .pole-modal .none-btn {
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
        .pole-modal .none-btn:hover { background: var(--background-modifier-hover); }
        .pole-modal .none-btn.active {
            background: var(--interactive-accent);
            color: var(--text-on-accent);
            border-color: transparent;
        }

        /* Sensation popup */
        .pole-modal .sensation-popup {
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
        .pole-modal .sensation-popup button {
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
        .pole-modal .sensation-popup button:hover {
            background: var(--interactive-accent);
            color: var(--text-on-accent);
            border-color: transparent;
        }

        /* Text inputs */
        .pole-modal input[type="text"] {
            width: 100%;
            box-sizing: border-box;
            font-size: 0.95rem;
            padding: 8px 10px;
            border-radius: var(--radius-m, 6px);
            border: 1px solid var(--background-modifier-border);
            background: var(--background-primary);
            color: var(--text-normal);
        }
        .pole-modal input::placeholder { color: var(--text-muted); }
        .pole-modal input:focus {
            outline: none;
            border-color: var(--interactive-accent);
            box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb, 46,163,242), 0.25);
        }

        /* Buttons */
        .pole-modal .btn-row {
            margin-top: 8px;
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            padding-bottom: 4px;
        }
        .pole-modal .btn-row button {
            padding: 8px 16px;
            border-radius: var(--radius-m, 6px);
            border: 1px solid var(--background-modifier-border);
            background: transparent;
            color: var(--text-normal);
            cursor: pointer;
            font-size: 0.95rem;
        }
        .pole-modal .btn-row button:hover { background: var(--background-modifier-hover); }
        .pole-modal .btn-row .primary {
            background: var(--interactive-accent);
            color: var(--text-on-accent);
            border-color: transparent;
        }
        .pole-modal .btn-row .primary:hover { filter: brightness(0.95); }

        /* Field group */
        .pole-modal .field-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        /* Mobile */
        .is-phone .pole-modal .pole-btn { padding: 12px 8px; font-size: 0.95rem; }
        .is-phone .pole-modal .intensity-circle { width: 36px; height: 36px; font-size: 0.9rem; }
        .is-phone .pole-modal .body-zone-wrap { width: 58%; }
        /* Respect safe area inset on phones so keyboard doesn't cover inputs */
        .is-phone .modal .modal-content, .is-phone .modal .modal-inner {
            padding-bottom: calc(var(--safe-area-inset-bottom, 0px) + 8px);
        }
        .is-phone .pole-modal .sensation-popup { width: 180px; }
    `;

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
