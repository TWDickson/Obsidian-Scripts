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

function getFallbackSharedCheckInData() {
    const BODY_ZONES = [
        { id: 'head', label: 'Head', path: 'M100,8 C78,8 62,28 62,52 C62,76 78,92 100,92 C122,92 138,76 138,52 C138,28 122,8 100,8Z' },
        { id: 'eyes', label: 'Eyes', path: 'M80,36 L120,36 C124,36 126,39 126,44 C126,49 124,52 120,52 L80,52 C76,52 74,49 74,44 C74,39 76,36 80,36Z' },
        { id: 'throat', label: 'Throat', path: 'M88,98 C88,98 92,96 100,96 C108,96 112,98 112,98 L114,116 C114,116 108,118 100,118 C92,118 86,116 86,116Z' },
        { id: 'jaw', label: 'Jaw', path: 'M78,72 L122,72 C122,72 122,84 118,92 C114,98 108,102 100,102 C92,102 86,98 82,92 C78,84 78,72 78,72Z' },
        { id: 'shoulders', label: 'Shoulders', path: 'M86,116 C70,118 42,124 28,134 C22,138 20,144 22,150 L46,146 C52,140 66,132 86,128Z M114,116 C130,118 158,124 172,134 C178,138 180,144 178,150 L154,146 C148,140 134,132 114,128Z' },
        { id: 'chest', label: 'Chest', path: 'M66,128 C62,128 58,132 58,138 L58,180 C58,184 62,188 66,188 L134,188 C138,188 142,184 142,180 L142,138 C142,132 138,128 134,128Z' },
        { id: 'heart', label: 'Heart', path: 'M100,148 C97,142 88,142 88,151 C88,160 98,168 100,174 C102,168 112,160 112,151 C112,142 103,142 100,148Z' },
        { id: 'stomach', label: 'Stomach', path: 'M62,188 C60,188 58,190 58,194 L60,246 C60,250 64,254 68,254 L132,254 C136,254 140,250 140,246 L142,194 C142,190 140,188 138,188Z' },
        { id: 'lower-back', label: 'Lower Back', path: 'M68,222 L132,222 L132,254 L68,254Z', opacity: 0.35 },
        { id: 'hips', label: 'Hips', path: 'M68,254 L132,254 C136,254 140,258 140,264 L138,276 C134,288 118,294 100,294 C82,294 66,288 62,276 L60,264 C60,258 64,254 68,254Z' },
        { id: 'arms', label: 'Arms', path: 'M22,150 C16,184 10,216 8,244 L24,248 C24,216 32,184 36,154Z M178,150 C184,184 190,216 192,244 L176,248 C176,216 168,184 164,154Z' },
        { id: 'hands', label: 'Hands', path: 'M14,244 C6,244 0,254 2,266 C4,278 12,286 20,284 C24,282 26,278 26,272 L28,252 C26,246 20,242 14,244Z M186,244 C194,244 200,254 198,266 C196,278 188,286 180,284 C176,282 174,278 174,272 L172,252 C174,246 180,242 186,244Z' },
        { id: 'legs', label: 'Legs', path: 'M68,292 C64,292 60,296 60,302 L56,370 C54,380 50,394 48,404 C46,412 44,420 50,424 C56,426 62,422 64,416 L70,380 C72,368 76,340 78,310 L82,294Z M132,292 C136,292 140,296 140,302 L144,370 C146,380 150,394 152,404 C154,412 156,420 150,424 C144,426 138,422 136,416 L130,380 C128,368 124,340 122,310 L118,294Z' }
    ];

    const SENSATION_COLOURS = {
        tight: '#e05c5c',
        tense: '#c0504d',
        heavy: '#6b7ab5',
        ache: '#9b59b6',
        hollow: '#b0bec5',
        numb: '#9e9e9e',
        braced: '#d4845a',
        buzzing: '#f0c040',
        flutter: '#7ec8a4',
        fire: '#e8401c',
        hunger: '#c0773a',
        warm: '#e8884a',
        open: '#87c4e0',
        settled: '#7ab87a',
        ease: '#a8d4a8'
    };

    const SENSATION_TYPES = Object.keys(SENSATION_COLOURS);

    const ZONE_LABEL_POS = {
        head: { x: 100, y: 65, anchor: 'middle' },
        eyes: { x: 150, y: 46, anchor: 'start', lx1: 126, ly1: 44, lx2: 148, ly2: 46 },
        jaw: { x: 150, y: 88, anchor: 'start', lx1: 122, ly1: 86, lx2: 148, ly2: 88 },
        throat: { x: 150, y: 108, anchor: 'start', lx1: 114, ly1: 107, lx2: 148, ly2: 108 },
        shoulders: { x: 57, y: 120, anchor: 'middle', rotate: -17 },
        chest: { x: 100, y: 140, anchor: 'middle' },
        heart: { x: 100, y: 182, anchor: 'middle' },
        stomach: { x: 100, y: 218, anchor: 'middle' },
        'lower-back': { x: 100, y: 234, anchor: 'middle', lines: ['Lower', 'Back'] },
        hips: { x: 100, y: 278, anchor: 'middle' },
        arms: { x: 40, y: 198, anchor: 'middle', rotate: -80 },
        hands: { x: 38, y: 272, anchor: 'middle', rotate: -80 },
        legs: { x: 100, y: 358, anchor: 'middle' }
    };

    function hexToHsl(hex) {
        const h = hex.replace('#', '');
        const r = parseInt(h.substring(0, 2), 16) / 255;
        const g = parseInt(h.substring(2, 4), 16) / 255;
        const b = parseInt(h.substring(4, 6), 16) / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let hh = 0;
        let s = 0;
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

    return {
        BODY_ZONES,
        SENSATION_COLOURS,
        SENSATION_TYPES,
        ZONE_LABEL_POS,
        lightenHex
    };
}

function getFallbackEmotionCheckInCss() {
    return `
        .emotion-modal {
            box-sizing: border-box;
            max-width: var(--modal-max-width);
            overflow-x: hidden;
        }
        .emotion-modal .step { display: none; flex-direction: column; gap: 12px; width: 90%; margin: 0 auto; padding-bottom: 16px; }
        .emotion-modal .step.active { display: flex; }
        .emotion-modal h3 { margin: 0 0 4px 0; font-size: 1rem; color: var(--text-normal); }
        .emotion-modal .hint { font-size: 0.85rem; color: var(--text-muted); margin: 0; }
        .emotion-modal .canvas-wrap {
            position: relative;
            width: 100%;
            border-radius: var(--radius-m, 8px);
            overflow: hidden;
            border: 1px solid var(--background-modifier-border);
            touch-action: none;
            cursor: crosshair;
        }
        .emotion-modal canvas { display: block; width: 100%; height: auto; }
        .circumplex-label { position: absolute; font-size: 0.7rem; color: var(--text-faint); pointer-events: none; user-select: none; }
        .emotion-modal .coord-readout { text-align: center; font-size: 0.85rem; color: var(--text-muted); margin-top: 4px; min-height: 1.2em; }
        .emotion-modal .body-zone-wrap { position: relative; width: 42%; margin: 0 auto; }
        .emotion-modal .body-zone-wrap svg { display: block; width: 100%; height: auto; }
        .emotion-modal .zone-path { fill: var(--background-primary); stroke: var(--text-muted); stroke-width: 1.5; cursor: pointer; transition: fill 0.15s; }
        .emotion-modal .zone-path:hover,
        .emotion-modal .zone-path.label-hover { fill: var(--background-primary-alt, rgb(46,163,242)); }
        .emotion-modal .zone-path.selected { fill: var(--background-primary-alt, rgb(46,163,242)); stroke: var(--interactive-accent); stroke-width: 2; }
        .emotion-modal .zone-label { font-size: 10px; fill: var(--text-faint); pointer-events: all; cursor: pointer; user-select: none; }
        .emotion-modal .zone-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; min-height: 28px; }
        .emotion-modal .zone-pill { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; font-size: 0.8rem; cursor: pointer; border: 1px solid var(--background-modifier-border); background: var(--background-secondary); color: var(--text-normal); }
        .emotion-modal .zone-pill .pill-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .emotion-modal .zone-pill .pill-x { margin-left: 4px; opacity: 0.5; font-size: 0.75rem; }
        .emotion-modal .zone-pill:hover .pill-x { opacity: 1; }
        .emotion-modal .none-btn { margin-top: 4px; padding: 6px 14px; border-radius: var(--radius-m, 6px); border: 1px solid var(--background-modifier-border); background: transparent; color: var(--text-muted); cursor: pointer; font-size: 0.85rem; align-self: center; }
        .emotion-modal .none-btn:hover { background: var(--background-modifier-hover); }
        .emotion-modal .none-btn.active { background: var(--interactive-accent); color: var(--text-on-accent); border-color: transparent; }
        .emotion-modal .sensation-popup { position: fixed; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: var(--radius-m, 8px); box-shadow: var(--shadow-l); padding: 8px; z-index: 1000; display: flex; flex-wrap: wrap; gap: 6px; width: 220px; }
        .emotion-modal .sensation-popup button { flex: 1 1 auto; padding: 5px 8px; border-radius: 999px; border: 1px solid var(--background-modifier-border); background: var(--background-secondary); color: var(--text-normal); font-size: 0.8rem; cursor: pointer; white-space: nowrap; }
        .emotion-modal .sensation-popup button:hover { background: var(--interactive-accent); color: var(--text-on-accent); border-color: transparent; }
        .emotion-modal input[type="text"] { width: 100%; box-sizing: border-box; font-size: 0.95rem; padding: 8px 10px; border-radius: var(--radius-m, 6px); border: 1px solid var(--background-modifier-border); background: var(--background-primary); color: var(--text-normal); }
        .emotion-modal input::placeholder { color: var(--text-muted); }
        .emotion-modal input:focus { outline: none; border-color: var(--interactive-accent); box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb, 46,163,242), 0.25); }
        .emotion-modal .step-indicators { display: flex; gap: 6px; justify-content: center; margin-bottom: 4px; }
        .emotion-modal .step-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--background-modifier-border); transition: background 0.2s; }
        .emotion-modal .step-dot.active { background: var(--interactive-accent); }
        .emotion-modal .btn-row { width: 90%; margin-left: auto; margin-right: auto; margin-top: 8px; display: flex; gap: 8px; justify-content: flex-end; padding-bottom: 4px; }
        .emotion-modal .btn-row button { padding: 8px 16px; border-radius: var(--radius-m, 6px); border: 1px solid var(--background-modifier-border); background: transparent; color: var(--text-normal); cursor: pointer; font-size: 0.95rem; }
        .emotion-modal .btn-row button:hover { background: var(--background-modifier-hover); }
        .emotion-modal .btn-row .primary { background: var(--interactive-accent); color: var(--text-on-accent); border-color: transparent; }
        .emotion-modal .btn-row .primary:hover { background: var(--interactive-accent-hover, var(--interactive-accent)); }
        .emotion-modal .skip-link { font-size: 0.8rem; color: var(--text-faint); cursor: pointer; text-decoration: underline; align-self: center; margin-right: auto; }
        .emotion-modal .skip-link:hover { color: var(--text-muted); }
        .is-phone .emotion-modal { padding-bottom: calc(var(--safe-area-inset-bottom, 0px) + 8px); overflow-x: hidden; }
        .is-phone .emotion-modal .sensation-popup { width: 180px; }
        .is-phone .emotion-modal .body-zone-wrap { width: 70%; }
    `;
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
    const fallbackData = getFallbackSharedCheckInData();
    const getEmotionCheckInCss = sharedStyles?.getEmotionCheckInCss ?? getFallbackEmotionCheckInCss;
    const {
        BODY_ZONES,
        SENSATION_COLOURS,
        SENSATION_TYPES,
        ZONE_LABEL_POS,
        lightenHex
    } = sharedData ?? fallbackData;

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
