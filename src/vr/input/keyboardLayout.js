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
 * @returns {Array<{label:string, glyph:string, x:number, y:number, w:number, h:number}>}
 */
export function computeKeyLayout(rows = ROWS) {
  const keys = [];
  const rowCount = rows.length;
  // Total stacked height so we can centre vertically.
  const totalH = rowCount * KEY_H + (rowCount - 1) * GAP;
  const topY = totalH / 2 - KEY_H / 2;

  rows.forEach((row, r) => {
    // Width of this row in "units" (each unit = KEY_W + GAP, minus trailing gap).
    let totalUnits = 0;
    for (const k of row) {
      totalUnits += (typeof k === 'object' ? (k.width || 1) : 1);
    }
    const rowWidth = totalUnits * KEY_W + (row.length - 1) * GAP;

    let x = -rowWidth / 2;
    const y = topY - r * (KEY_H + GAP);

    for (const entry of row) {
      const label = typeof entry === 'object' ? entry.label : entry;
      const units = typeof entry === 'object' ? (entry.width || 1) : 1;
      const glyph = typeof entry === 'object' && entry.glyph ? entry.glyph : label;
      const w = units * KEY_W;
      keys.push({ label, glyph, x: x + w / 2, y, w, h: KEY_H });
      x += w + GAP;
    }
  });

  return keys;
}

/**
 * Total bounding size of the keyboard, useful for the backing panel.
 * @returns {{width:number, height:number}}
 */
export function keyboardBounds(rows = ROWS) {
  const keys = computeKeyLayout(rows);
  let maxRight = 0;
  let maxTop = 0;
  let minBottom = 0;
  for (const k of keys) {
    maxRight = Math.max(maxRight, k.x + k.w / 2);
    maxTop = Math.max(maxTop, k.y + k.h / 2);
    minBottom = Math.min(minBottom, k.y - k.h / 2);
  }
  return { width: maxRight * 2 + GAP * 2, height: (maxTop - minBottom) + GAP * 2 };
}
