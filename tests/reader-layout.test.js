const {
  readerAvailPx, linePitchFor, measureEmFor, readerHitTest, fontPxFor
} = require('../src/vr/browser/readerLayout.js');

describe('readerLayout — scale/scroll arms', () => {
  test('linePitchFor/measureEmFor/fontPxFor clamp non-positive scale to 1', () => {
    expect(linePitchFor('p', 0)).toBe(linePitchFor('p', 1));
    expect(measureEmFor(0)).toBe(measureEmFor(1));
    expect(fontPxFor('body', -1)).toBe(fontPxFor('body', 1));
  });

  test('readerHitTest hits the scroll arrow zone only when scrollable', () => {
    const { ARROW_Y0 } = require('../src/vr/browser/readerLayout.js');
    expect(readerHitTest(50, ARROW_Y0 + 5, true)).toBeTruthy();
    const r = readerHitTest(50, ARROW_Y0 + 5, false);
    expect(!r || r.kind !== 'scroll-up').toBe(true);
  });
});

describe('readerLayout — reserveBottom arm', () => {
  test('readerAvailPx shrinks when reserveBottom is set', () => {
    const open = readerAvailPx(false);
    const reserved = readerAvailPx(true);
    expect(readerAvailPx()).toBe(open); // reserveBottom defaults to false
    expect(reserved).toBeLessThan(open);
  });
});

describe('readerLayout — per-style pitch (WCAG 1.4.12)', () => {
  test('title and heading pitch reach the 1.5 line-height guidance', () => {
    // I-2: a single 34px pitch gave 1.13/1.36 — two-line titles had ~1px gap.
    expect(linePitchFor('title', 1) / fontPxFor('title', 1)).toBeGreaterThanOrEqual(1.5);
    expect(linePitchFor('h', 1) / fontPxFor('h', 1)).toBeGreaterThanOrEqual(1.5);
  });

  test('body/blank/code keep the shared pitch floor', () => {
    const { LINE_H } = require('../src/vr/browser/readerLayout.js');
    expect(linePitchFor('p', 1)).toBe(LINE_H);
    expect(linePitchFor('blank', 1)).toBe(LINE_H);
    expect(linePitchFor('c', 1)).toBe(LINE_H);
    // all already at or above 1.5 — the floor wins.
    expect(linePitchFor('p', 1) / fontPxFor('p', 1)).toBeGreaterThanOrEqual(1.5);
    expect(linePitchFor('c', 1) / fontPxFor('c', 1)).toBeGreaterThanOrEqual(1.5);
  });

  test('pitch scales with the text-size multiplier', () => {
    expect(linePitchFor('title', 2)).toBeGreaterThan(linePitchFor('title', 1));
    expect(linePitchFor('h', 2)).toBeGreaterThan(linePitchFor('h', 1));
    expect(linePitchFor('p', 2)).toBeGreaterThan(linePitchFor('p', 1));
  });
});
