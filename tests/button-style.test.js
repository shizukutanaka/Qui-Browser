/**
 * Unit tests for the shared VR button focus/hover treatment.
 * The hover state must be clearly perceptible (WCAG 2.4.7 / 1.4.11): a brighter
 * fill AND a thicker border (a hue-independent shape cue).
 */
const {
  buttonBg, buttonLineWidth,
  BUTTON_BG, BUTTON_BG_HOVER, BUTTON_LINE, BUTTON_LINE_HOVER
} = require('../src/vr/ui/buttonStyle.js');

describe('buttonStyle — focus/hover indicator', () => {
  test('idle vs hover fill differ', () => {
    expect(buttonBg(false)).toBe(BUTTON_BG);
    expect(buttonBg(true)).toBe(BUTTON_BG_HOVER);
    expect(buttonBg(true)).not.toBe(buttonBg(false));
  });

  test('hover thickens the border (shape cue independent of hue)', () => {
    expect(buttonLineWidth(false)).toBe(BUTTON_LINE);
    expect(buttonLineWidth(true)).toBe(BUTTON_LINE_HOVER);
    expect(buttonLineWidth(true)).toBeGreaterThan(buttonLineWidth(false));
  });

  test('hover fill is materially brighter than idle (not a near-black shift)', () => {
    // Parse the leading "rgb" channels and compare summed luminance-ish weight.
    const channels = (s) => s.match(/\d+/g).slice(0, 3).map(Number);
    const sum = (a) => a.reduce((n, x) => n + x, 0);
    expect(sum(channels(BUTTON_BG_HOVER))).toBeGreaterThan(sum(channels(BUTTON_BG)) * 2);
  });
});
