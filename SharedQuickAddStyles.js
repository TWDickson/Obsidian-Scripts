function getPatternModalCss(extraCss = '') {
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

function getJournalThoughtModalCss(extraCss = '') {
    return `
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
            border: 1px solid var(--background-modifier-border);
            background: var(--background-primary);
            color: var(--text-normal);
        }
        .journal-modal input::placeholder, .journal-modal textarea::placeholder { color: var(--text-muted); }
        .journal-modal textarea { min-height:8em; resize:vertical; }

        /* Fix for select text clipping: ensure adequate vertical space and proper line-height */
        .journal-modal select {
            box-sizing: border-box;
            padding-top: 8px;
            padding-bottom: 8px;
            padding-right: 36px;
            line-height: 1.4;
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

        /* Ensure datetime input doesn't exceed other input widths */
        .journal-modal input[type="datetime-local"] {
            width: 100%;
            max-width: 100%;
            display: block;
            box-sizing: border-box;
            padding: 8px 10px;
            font-size: inherit;
            min-width: 0;
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
            border: 1px solid var(--background-modifier-border);
            background: transparent;
            color: var(--text-normal);
            cursor: pointer;
            font-size: 0.95rem;
        }
        .journal-modal .btn-row button:focus { outline: 2px solid var(--interactive-accent, rgba(0,120,212,0.18)); outline-offset: 2px; }
        .journal-modal .btn-row .primary {
            background: var(--interactive-accent);
            color: var(--text-on-accent);
            border-color: transparent;
        }
        .journal-modal .btn-row .primary:hover { background: var(--interactive-accent-hover, var(--interactive-accent)); }

        /* Tags area */
        .journal-modal .tags-wrapper { width:100%; max-width:100%; box-sizing:border-box; }
        .journal-modal .selected-tags { display:flex; flex-wrap:wrap; gap:6px; max-width:100%; overflow:hidden; }
        .journal-modal .tag-pill { max-width:100%; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; background: var(--interactive-accent); color: var(--text-on-accent); padding: 4px 8px; border-radius: var(--border-radius, 999px); }

        /* Ensure elements inside flex containers can shrink on small screens */
        .journal-modal .tag-suggester-input, .journal-modal .tag-input { min-width:0; }

        /* Prevent horizontal scrolling within the modal */
        .journal-modal, .journal-modal * { max-width:100%; box-sizing:border-box; }
        .journal-modal { overflow-x: hidden; }

        /* Mobile-safe modal */
        .is-phone .journal-modal { margin-bottom: 0; max-width: calc(100vw - 12px); overflow-x:hidden; }
        .is-phone .journal-modal {
            padding-bottom: calc(var(--safe-area-inset-bottom, 0px) + 8px);
        }
        .is-phone .journal-modal .btn-row {
            display: flex;
            gap: 8px;
            flex-wrap: nowrap;
            align-items: center;
        }
        .is-phone .journal-modal .btn-row button {
            flex: 1 1 auto;
            min-width: 0;
        }

        /* Narrow-screen tweaks specifically for datetime overflow */
        @media (max-width: 420px) {
            .journal-modal .row { width: calc(100vw - 48px); }
            .journal-modal input[type="datetime-local"] { max-width: calc(100% - 4px); }
        }

        ${extraCss}
    `;
}

module.exports = {
    getPatternModalCss,
    getJournalThoughtModalCss
};
