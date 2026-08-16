import { safeMeasureEm } from '../ui/textWrap.js';
/**
 * Pure layout maths for the in-VR keyboard.
 *
 * Kept free of Three.js so the key-grid geometry can be unit-tested headlessly.
 * Positions are in metres, centred about (0,0); the +x axis points right and
 * +y points up. Rows are stacked downward from the top.
 */

export const KEY_W = 0.062;   // default key width (m)
export const KEY_H = 0.062;   // key height (m)
export const GAP = 0.008;     // gap between keys (m)

// The VR keyboard layout. A row entry is either a label string (1 unit wide)
// or { label, width } for wide keys. `label` is what onKeyPress receives.
export const ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', { label: 'back', width: 1.5, glyph: '⌫' }],
  [{ label: 'shift', width: 1.5, glyph: '⇧' }, 'z', 'x', 'c', 'v', 'b', 'n', 'm', { label: '.', width: 1 }, { label: '/', width: 1 }],
  [{ label: 'esc', width: 1, glyph: '✕' }, { label: 'かな', width: 1.5 }, { label: 'space', width: 3, glyph: '␣' }, { label: '変換', width: 1.5 }, { label: 'enter', width: 2, glyph: '⏎' }]
];

/**
 * Compute the geometry for every key in a layout.
 *
 * @param {Array} rows  layout (defaults to ROWS)
 * @param {number} scale  uniform size multiplier (≥1 enlarges keys for motor /
 *   low-vision users — bigger targets mean fewer mis-taps; WCAG 2.5.5)
 * @returns {Array<{label:string, glyph:string, x:number, y:number, w:number, h:number}>}
 */
export function computeKeyLayout(rows = ROWS, scale = 1) {
  const keyW = KEY_W * scale;
  const keyH = KEY_H * scale;
  const gap = GAP * scale;
  const keys = [];
  const rowCount = rows.length;
  // Total stacked height so we can centre vertically.
  const totalH = rowCount * keyH + (rowCount - 1) * gap;
  const topY = totalH / 2 - keyH / 2;

  rows.forEach((row, r) => {
    // Width of this row in "units" (each unit = keyW + gap, minus trailing gap).
    let totalUnits = 0;
    for (const k of row) {
      totalUnits += (typeof k === 'object' ? (k.width || 1) : 1);
    }
    const rowWidth = totalUnits * keyW + (row.length - 1) * gap;

    let x = -rowWidth / 2;
    const y = topY - r * (keyH + gap);

    for (const entry of row) {
      const label = typeof entry === 'object' ? entry.label : entry;
      const units = typeof entry === 'object' ? (entry.width || 1) : 1;
      const glyph = typeof entry === 'object' && entry.glyph ? entry.glyph : label;
      const w = units * keyW;
      keys.push({ label, glyph, x: x + w / 2, y, w, h: keyH });
      x += w + gap;
    }
  });

  return keys;
}

/**
 * Total bounding size of the keyboard, useful for the backing panel.
 * @param {Array} rows
 * @param {number} scale  same multiplier as computeKeyLayout
 * @returns {{width:number, height:number}}
 */
export function keyboardBounds(rows = ROWS, scale = 1) {
  const keys = computeKeyLayout(rows, scale);
  const gap = GAP * scale;
  let maxRight = 0;
  let maxTop = 0;
  let minBottom = 0;
  for (const k of keys) {
    maxRight = Math.max(maxRight, k.x + k.w / 2);
    maxTop = Math.max(maxTop, k.y + k.h / 2);
    minBottom = Math.min(minBottom, k.y - k.h / 2);
  }
  return { width: maxRight * 2 + gap * 2, height: (maxTop - minBottom) + gap * 2 };
}

// ── Suggestion / composition text budgets ───────────────────────────────────
// Kept here (a pure module) rather than inside JapaneseIME.js so the real
// values are reachable by unit tests and by the real-browser layout harness
// (tools/verify-text-layout.mjs) without importing THREE.

/** URL-suggestion button: canvas size and label font. */
export const SUGGESTION_BTN_PX_W = 384;
export const SUGGESTION_BTN_PX_H = 128;
export const SUGGESTION_LABEL_FONT_PX = 34;
/**
 * Label measure in em. A 22-*character* budget silently assumed Latin: 22
 * Latin characters are ~374px (just fits) but 22 full-width ones are 748px —
 * 95% wider than the button. Suggestion labels are page titles, which for a
 * Japanese user are overwhelmingly Japanese.
 */
export const SUGGESTION_MEASURE_EM =
  safeMeasureEm(SUGGESTION_BTN_PX_W - 24, SUGGESTION_LABEL_FONT_PX);

/** Composition display: canvas width, font, and the mode badge on the right. */
export const COMPOSITION_CANVAS_W = 1024;
export const COMPOSITION_FONT_PX = 40;
export const COMPOSITION_BADGE_W = 80;
/** Usable text width, left of the mode badge. */
export const COMPOSITION_TEXT_W = COMPOSITION_CANVAS_W - 24 - COMPOSITION_BADGE_W - 12;
export const COMPOSITION_MEASURE_EM = safeMeasureEm(COMPOSITION_TEXT_W, COMPOSITION_FONT_PX);

/**
 * Colours for the IME mode badge (ひ / カ / 漢) drawn in the composition strip.
 *
 * The badge is the only indicator of which script the next keystroke will
 * produce, so it has to be legible — and it was not. The glyph was drawn in
 * `#ffffff` on the saturated badge fill, which measures **2.37:1** on the
 * katakana orange and **2.05:1** on the kanji green. At `bold 36px` that is
 * large text, so WCAG 1.4.3 asks for 3:1 and both failed; the hiragana blue
 * only scraped past at 3.38:1.
 *
 * Fixed by inverting the glyph rather than darkening the badge. Darkening the
 * fill would have fixed the glyph (white on a dark blue reaches 5.8:1) but
 * dropped the badge *rectangle* to ~3.0:1 against the `#111726` strip, right
 * on the 1.4.11 line — trading a readable glyph for an indicator you cannot
 * locate. Keeping the fill bright holds the rectangle at 5.3–8.7:1 and an ink
 * glyph reaches 5.7–9.3:1, so both the badge and its content clear the bar.
 *
 * The glyph itself already carries the meaning (ひ / カ / 漢), so colour is
 * reinforcement only — WCAG 1.4.1 is unaffected either way.
 *
 * @param {'hiragana'|'katakana'|'kanji'} mode
 * @returns {{bg: string, text: string}}
 */
export function imeBadgeColors(mode) {
  const BG = { hiragana: '#4488ff', katakana: '#ff8844', kanji: '#44cc88' };
  return { bg: BG[mode] || '#8899cc', text: '#0b0f1a' };
}
