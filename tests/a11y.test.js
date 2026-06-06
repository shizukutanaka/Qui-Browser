/**
 * Unit tests for the accessibility preferences module.
 */
const { getPrefs, setPref, togglePref, applyAccessibility } = require('../src/a11y/accessibility.js');

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
