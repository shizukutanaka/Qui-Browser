/**
 * Unit tests for the shared VR button focus/hover treatment.
 * The hover state must be clearly perceptible (WCAG 2.4.7 / 1.4.11): a brighter
 * fill AND a thicker border (a hue-independent shape cue).
 */
const {
  buttonBg, buttonLineWidth, toggleIndicatorColors, buttonAccentColor,
  BUTTON_BG, BUTTON_BG_HOVER, BUTTON_LINE, BUTTON_LINE_HOVER,
  BUTTON_BG_HC, BUTTON_BG_HOVER_HC, BUTTON_LINE_HC, BUTTON_LINE_HOVER_HC
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

describe('buttonStyle — high-contrast mode (WCAG 1.4.11)', () => {
  test('HC idle background is pure black', () => {
    expect(buttonBg(false, true)).toBe(BUTTON_BG_HC);
    expect(BUTTON_BG_HC).toBe('#000000');
  });

  test('HC hover background differs from HC idle', () => {
    expect(buttonBg(true, true)).toBe(BUTTON_BG_HOVER_HC);
    expect(BUTTON_BG_HOVER_HC).not.toBe(BUTTON_BG_HC);
  });

  test('HC idle border is at least as thick as normal idle', () => {
    expect(buttonLineWidth(false, true)).toBeGreaterThanOrEqual(buttonLineWidth(false, false));
    expect(BUTTON_LINE_HC).toBeGreaterThanOrEqual(BUTTON_LINE);
  });

  test('HC hover border is thicker than HC idle (shape cue preserved)', () => {
    expect(buttonLineWidth(true, true)).toBeGreaterThan(buttonLineWidth(false, true));
    expect(BUTTON_LINE_HOVER_HC).toBeGreaterThan(BUTTON_LINE_HC);
  });

  test('normal-mode colors unchanged when highContrast is false (regression guard)', () => {
    expect(buttonBg(false, false)).toBe(BUTTON_BG);
    expect(buttonBg(true, false)).toBe(BUTTON_BG_HOVER);
    expect(buttonLineWidth(false, false)).toBe(BUTTON_LINE);
    expect(buttonLineWidth(true, false)).toBe(BUTTON_LINE_HOVER);
  });

  test('toggleIndicatorColors ON — normal green, HC vivid green', () => {
    const normal = toggleIndicatorColors(true, false);
    const hc     = toggleIndicatorColors(true, true);
    expect(normal.border).toBe('#44ff88');
    expect(normal.label).toBe('#44ff88');
    expect(hc.border).toBe('#00ff88');
    expect(hc.label).toBe('#00ff88');
  });

  test('toggleIndicatorColors OFF HC is brighter than normal OFF', () => {
    const normal = toggleIndicatorColors(false, false);
    const hc     = toggleIndicatorColors(false, true);
    // HC off-border must be visibly brighter: compare R+G+B hex sums.
    const brightness = (s) =>
      s.match(/[0-9a-f]{2}/gi).slice(0, 3).map(h => parseInt(h, 16)).reduce((a, b) => a + b, 0);
    expect(brightness(hc.border)).toBeGreaterThan(brightness(normal.border));
    expect(brightness(hc.label)).toBeGreaterThan(brightness(normal.label));
  });

  test('toggleIndicatorColors OFF normal — border and label differ (subtle distinction)', () => {
    const { border, label } = toggleIndicatorColors(false, false);
    expect(border).not.toBe(label);
  });

  test('buttonAccentColor returns white in HC, default otherwise', () => {
    expect(buttonAccentColor('#5e72e4', true)).toBe('#ffffff');
    expect(buttonAccentColor('#e4a85e', true)).toBe('#ffffff');
    expect(buttonAccentColor('#5e72e4', false)).toBe('#5e72e4');
    expect(buttonAccentColor('#e4a85e', false)).toBe('#e4a85e');
  });
});

// ── WCAG contrast-ratio guarantees for the high-contrast palette ──────────────
// Locks in the accessibility claims in buttonStyle.js (currently only asserted
// in prose comments). The VR toggle labels render as bold ≥28px text on canvas,
// which is "large scale" under WCAG 1.4.3 (≥18.66px bold) — so the applicable
// text threshold is 3:1, and the 1.4.11 non-text (border) threshold is also
// 3:1. Against the idle pure-black backing the primary states should also clear
// the stronger 4.5:1 normal-text bar. A future palette tweak that dims a colour
// below these ratios now fails CI instead of silently regressing.
describe('buttonStyle — high-contrast WCAG contrast ratios', () => {
  // The WCAG maths used to be reimplemented inline here. That copy handled
  // 6-digit hex only, so it could not evaluate a single `rgba()` value — and
  // the button/toast/row backings this palette sits on are all `rgba()`. It now
  // uses the shared implementation (src/vr/ui/contrast.js), which composites
  // alpha before measuring; the sanity check below still pins the endpoints so
  // a broken shared helper cannot quietly certify this palette.
  const { contrastRatio } = require('../src/vr/ui/contrast.js');

  test('contrastRatio sanity: black/white is 21:1, identical is 1:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#004adf', '#004adf')).toBeCloseTo(1, 5);
  });

  const HC_BG_IDLE  = BUTTON_BG_HC;        // '#000000'
  const HC_BG_HOVER = BUTTON_BG_HOVER_HC;  // '#004adf'

  test('every HC indicator colour clears 3:1 against BOTH the idle and hover backings', () => {
    const fg = [
      toggleIndicatorColors(true, true).label,   // '#00ff88'
      toggleIndicatorColors(false, true).label,  // '#aaccee'
      buttonAccentColor('#5e72e4', true)         // '#ffffff'
    ];
    for (const c of fg) {
      expect(contrastRatio(c, HC_BG_IDLE)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(c, HC_BG_HOVER)).toBeGreaterThanOrEqual(3);
    }
  });

  test('HC label colours clear the stronger 4.5:1 against the idle black backing', () => {
    expect(contrastRatio(toggleIndicatorColors(true, true).label, HC_BG_IDLE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(toggleIndicatorColors(false, true).label, HC_BG_IDLE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#ffffff', HC_BG_IDLE)).toBeGreaterThanOrEqual(4.5);
  });

  test('the HC hover backing itself is darker than white text by ≥4.5:1 (readable labels on hover)', () => {
    expect(contrastRatio('#ffffff', HC_BG_HOVER)).toBeGreaterThanOrEqual(4.5);
  });
});
