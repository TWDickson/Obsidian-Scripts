function getBodyMapCommonCss(modalClass) {
    return `
        .${modalClass} .body-zone-wrap {
            position: relative;
            width: 42%;
            margin: 0 auto;
        }
        .${modalClass} .body-zone-wrap svg {
            display: block;
            width: 100%;
            height: auto;
        }
        .${modalClass} .zone-path {
            fill: var(--background-primary);
            stroke: var(--text-muted);
            stroke-width: 1.5;
            cursor: pointer;
            transition: fill 0.15s;
        }
        .${modalClass} .zone-path:hover,
        .${modalClass} .zone-path.label-hover {
            fill: var(--background-primary-alt, rgb(46,163,242));
        }
        .${modalClass} .zone-path.selected {
            fill: var(--background-primary-alt, rgb(46,163,242));
            stroke: var(--interactive-accent);
            stroke-width: 2;
        }
        .${modalClass} .zone-label {
            font-size: 10px;
            fill: var(--text-faint);
            pointer-events: all;
            cursor: pointer;
            user-select: none;
        }

        .${modalClass} .zone-pills {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 8px;
            min-height: 28px;
        }
        .${modalClass} .zone-pill {
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
        .${modalClass} .zone-pill .pill-dot {
            width: 8px; height: 8px;
            border-radius: 50%;
            flex-shrink: 0;
        }
        .${modalClass} .zone-pill .pill-x {
            margin-left: 4px;
            opacity: 0.5;
            font-size: 0.75rem;
        }
        .${modalClass} .zone-pill:hover .pill-x { opacity: 1; }

        .${modalClass} .none-btn {
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
        .${modalClass} .none-btn:hover { background: var(--background-modifier-hover); }
        .${modalClass} .none-btn.active {
            background: var(--interactive-accent);
            color: var(--text-on-accent);
            border-color: transparent;
        }

        .${modalClass} .sensation-popup {
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
        .${modalClass} .sensation-popup button {
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
        .${modalClass} .sensation-popup button:hover {
            background: var(--interactive-accent);
            color: var(--text-on-accent);
            border-color: transparent;
        }

        .${modalClass} input[type="text"] {
            width: 100%;
            box-sizing: border-box;
            font-size: 0.95rem;
            padding: 8px 10px;
            border-radius: var(--radius-m, 6px);
            border: 1px solid var(--background-modifier-border);
            background: var(--background-primary);
            color: var(--text-normal);
        }
        .${modalClass} input::placeholder { color: var(--text-muted); }
        .${modalClass} input:focus {
            outline: none;
            border-color: var(--interactive-accent);
            box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb, 46,163,242), 0.25);
        }

        .${modalClass} .btn-row {
            margin-top: 8px;
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            padding-bottom: 4px;
        }
        .${modalClass} .btn-row button {
            padding: 8px 16px;
            border-radius: var(--radius-m, 6px);
            border: 1px solid var(--background-modifier-border);
            background: transparent;
            color: var(--text-normal);
            cursor: pointer;
            font-size: 0.95rem;
        }
        .${modalClass} .btn-row button:hover { background: var(--background-modifier-hover); }
        .${modalClass} .btn-row .primary {
            background: var(--interactive-accent);
            color: var(--text-on-accent);
            border-color: transparent;
        }
        .${modalClass} .btn-row .primary:hover { background: var(--interactive-accent-hover, var(--interactive-accent)); }

        .is-phone .${modalClass} {
            padding-bottom: calc(var(--safe-area-inset-bottom, 0px) + 8px);
            overflow-x: hidden;
        }
        .is-phone .${modalClass} .sensation-popup { width: 180px; }
    `;
}

function getEmotionCheckInCss() {
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
        .emotion-modal canvas {
            display: block;
            width: 100%;
            height: auto;
        }

        .circumplex-label {
            position: absolute;
            font-size: 0.7rem;
            color: var(--text-faint);
            pointer-events: none;
            user-select: none;
        }

        .emotion-modal .coord-readout {
            text-align: center;
            font-size: 0.85rem;
            color: var(--text-muted);
            margin-top: 4px;
            min-height: 1.2em;
        }

        ${getBodyMapCommonCss('emotion-modal')}

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

        .emotion-modal .btn-row {
            width: 90%;
            margin-left: auto;
            margin-right: auto;
        }

        .emotion-modal .skip-link {
            font-size: 0.8rem;
            color: var(--text-faint);
            cursor: pointer;
            text-decoration: underline;
            align-self: center;
            margin-right: auto;
        }
        .emotion-modal .skip-link:hover { color: var(--text-muted); }

        .is-phone .emotion-modal .body-zone-wrap { width: 70%; }
    `;
}

function getPoleCheckInCss() {
    return `
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
            color: var(--text-on-accent);
            border-color: #d94040;
        }
        .pole-modal .pole-btn.avoidant.selected {
            background: #3b7dd8;
            color: var(--text-on-accent);
            border-color: #3b7dd8;
        }

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

        ${getBodyMapCommonCss('pole-modal')}

        .pole-modal .zone-pills {
            margin-top: 6px;
            min-height: 26px;
        }

        .pole-modal .field-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .is-phone .pole-modal .pole-btn { padding: 12px 8px; font-size: 0.95rem; }
        .is-phone .pole-modal .intensity-circle { width: 36px; height: 36px; font-size: 0.9rem; }
        .is-phone .pole-modal .body-zone-wrap { width: 58%; }
    `;
}

module.exports = {
    getEmotionCheckInCss,
    getPoleCheckInCss
};
