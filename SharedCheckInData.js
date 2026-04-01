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

module.exports = {
    BODY_ZONES,
    SENSATION_COLOURS,
    SENSATION_TYPES,
    ZONE_LABEL_POS,
    lightenHex
};
