/**
 * Unit tests for the pure VR keyboard layout maths.
 */
const {
  KEY_W, KEY_H, GAP, ROWS, computeKeyLayout, keyboardBounds
} = require('../src/vr/input/keyboardLayout.js');

describe('computeKeyLayout', () => {
  test('produces one entry per key in the layout', () => {
    const expected = ROWS.reduce((n, row) => n + row.length, 0);
    expect(computeKeyLayout()).toHaveLength(expected);
  });

  test('every key carries label, glyph and geometry', () => {
    for (const k of computeKeyLayout()) {
      expect(typeof k.label).toBe('string');
      expect(typeof k.glyph).toBe('string');
      expect(k.w).toBeGreaterThan(0);
      expect(k.h).toBe(KEY_H);
      expect(Number.isFinite(k.x)).toBe(true);
      expect(Number.isFinite(k.y)).toBe(true);
    }
  });

  test('wide keys are wider than standard keys', () => {
    const keys = computeKeyLayout();
    const space = keys.find(k => k.label === 'space');
    const letter = keys.find(k => k.label === 'q');
    expect(space.w).toBeGreaterThan(letter.w);
  });

  test('each row is horizontally centred about x=0', () => {
    // Group keys by their y (row) and check the centre of mass is ~0.
    const byRow = new Map();
    for (const k of computeKeyLayout()) {
      const arr = byRow.get(k.y) || [];
      arr.push(k);
      byRow.set(k.y, arr);
    }
    for (const arr of byRow.values()) {
      const left = Math.min(...arr.map(k => k.x - k.w / 2));
      const right = Math.max(...arr.map(k => k.x + k.w / 2));
      expect(Math.abs(left + right)).toBeLessThan(1e-9); // symmetric
    }
  });

  test('rows are stacked top-to-bottom (decreasing y)', () => {
    const keys = computeKeyLayout();
    const firstRowY = keys[0].y;            // first key of first row
    const lastRowY = keys[keys.length - 1].y; // last key of last row
    expect(firstRowY).toBeGreaterThan(lastRowY);
  });

  test('back, enter, space and esc keys are present', () => {
    const labels = computeKeyLayout().map(k => k.label);
    expect(labels).toContain('back');
    expect(labels).toContain('enter');
    expect(labels).toContain('space');
    expect(labels).toContain('esc');
  });

  test('glyph differs from label for special keys', () => {
    const back = computeKeyLayout().find(k => k.label === 'back');
    expect(back.glyph).toBe('⌫');
  });

  test('scale enlarges every key uniformly (bigger targets, WCAG 2.5.5)', () => {
    const base = computeKeyLayout();
    const big = computeKeyLayout(ROWS, 2);
    expect(big).toHaveLength(base.length);
    for (let i = 0; i < base.length; i++) {
      expect(big[i].w).toBeCloseTo(base[i].w * 2, 9);
      expect(big[i].h).toBeCloseTo(base[i].h * 2, 9);
      expect(big[i].x).toBeCloseTo(base[i].x * 2, 9); // positions scale too
      expect(big[i].y).toBeCloseTo(base[i].y * 2, 9);
    }
  });

  test('scale defaults to 1 (unchanged geometry)', () => {
    expect(computeKeyLayout(ROWS, 1)).toEqual(computeKeyLayout());
  });
});

describe('keyboardBounds', () => {
  test('returns positive width and height', () => {
    const b = keyboardBounds();
    expect(b.width).toBeGreaterThan(0);
    expect(b.height).toBeGreaterThan(0);
  });

  test('height grows with the number of rows', () => {
    const small = keyboardBounds([['a'], ['b']]);
    const large = keyboardBounds([['a'], ['b'], ['c'], ['d']]);
    expect(large.height).toBeGreaterThan(small.height);
  });

  test('bounds scale with the size multiplier', () => {
    const base = keyboardBounds();
    const big = keyboardBounds(ROWS, 2);
    expect(big.width).toBeCloseTo(base.width * 2, 9);
    expect(big.height).toBeCloseTo(base.height * 2, 9);
  });
});
