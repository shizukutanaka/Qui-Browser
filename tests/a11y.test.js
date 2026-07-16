/**
 * Unit tests for the accessibility preferences module.
 */
const { getPrefs, setPref, togglePref, applyAccessibility, largeTextScale, LARGE_TEXT_SCALE, prefersHighContrast } = require('../src/a11y/accessibility.js');

describe('src/a11y/accessibility', () => {
  test('defaults to no overrides', () => {
    const p = getPrefs();
    expect(typeof p.highContrast).toBe('boolean');
    expect(typeof p.largeText).toBe('boolean');
  });

  test('setPref stores and returns the value', () => {
    expect(setPref('highContrast', true)).toBe(true);
    expect(getPrefs().highContrast).toBe(true);
    setPref('highContrast', false);
    expect(getPrefs().highContrast).toBe(false);
  });

  test('togglePref flips the value', () => {
    setPref('largeText', false);
    expect(togglePref('largeText')).toBe(true);
    expect(getPrefs().largeText).toBe(true);
    togglePref('largeText');
    expect(getPrefs().largeText).toBe(false);
  });

  test('applyAccessibility is safe without a DOM', () => {
    expect(() => applyAccessibility()).not.toThrow();
  });
});

describe('largeTextScale — single source of truth for VR text scaling', () => {
  test('large-text off → no scaling (1.0) regardless of base', () => {
    expect(largeTextScale(false)).toBe(1.0);
    expect(largeTextScale(false, 1.4)).toBe(1.0);
    expect(largeTextScale(false, 99)).toBe(1.0);
  });

  test('large-text on → the standard factor by default', () => {
    expect(largeTextScale(true)).toBe(LARGE_TEXT_SCALE);
  });

  test('the standard factor is the documented 1.3', () => {
    expect(LARGE_TEXT_SCALE).toBe(1.3);
  });

  test('an explicit base overrides the default (e.g. captions at 1.4)', () => {
    expect(largeTextScale(true, 1.4)).toBe(1.4);
  });

  test('scaling on never shrinks (always ≥ 1.0)', () => {
    expect(largeTextScale(true)).toBeGreaterThanOrEqual(1.0);
    expect(largeTextScale(true, 1.4)).toBeGreaterThanOrEqual(1.0);
  });
});

describe('prefersHighContrast — single source of truth for the effective HC decision', () => {
  afterEach(() => setPref('highContrast', false));

  test('returns a boolean', () => {
    expect(typeof prefersHighContrast()).toBe('boolean');
  });

  test('true when the user explicitly enables high-contrast', () => {
    setPref('highContrast', true);
    expect(prefersHighContrast()).toBe(true);
  });

  test('false when neither the user nor the OS requests it', () => {
    setPref('highContrast', false);
    // No matchMedia in the test env → osHighContrast() is false.
    expect(prefersHighContrast()).toBe(false);
  });

  test('honours the OS signal even when the user pref is off', () => {
    setPref('highContrast', false);
    const prevMM = global.matchMedia;
    global.matchMedia = (q) => ({ matches: q.includes('prefers-contrast') });
    try {
      expect(prefersHighContrast()).toBe(true);
    } finally {
      global.matchMedia = prevMM;
    }
  });
});
