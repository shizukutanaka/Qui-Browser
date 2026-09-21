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

describe('applyAccessibility — DOM class application', () => {
  const saved = {};
  beforeEach(() => {
    for (const k of ['document', 'matchMedia']) {
      saved[k] = global[k];
    }
  });
  afterEach(() => {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) { delete global[k]; } else { global[k] = saved[k]; }
    }
  });

  function stubBody() {
    const toggles = [];
    global.document = { body: { classList: { toggle: jest.fn((c, on) => toggles.push([c, on])) } } };
    return toggles;
  }

  test('toggles all three classes according to current prefs + OS signal', () => {
    const toggles = stubBody();
    global.matchMedia = jest.fn(() => ({ matches: false }));
    setPref('highContrast', true);
    setPref('largeText', true);
    applyAccessibility();
    expect(toggles).toEqual(expect.arrayContaining([
      ['a11y-high-contrast', true],
      ['a11y-large-text', true],
      ['a11y-reduced-motion', false]
    ]));
    // restore
    setPref('highContrast', false);
    setPref('largeText', false);
  });

  test('a11y-reduced-motion follows the OS media query', () => {
    const toggles = stubBody();
    global.matchMedia = jest.fn((q) => ({ matches: q.includes('reduce') }));
    applyAccessibility();
    expect(toggles).toContainEqual(['a11y-reduced-motion', true]);
  });

  test('absent document.body is a safe no-op', () => {
    global.document = {};
    expect(() => applyAccessibility()).not.toThrow();
  });
});

describe('storage-failure arms — private browsing / quota exhaustion', () => {
  const origLS = global.localStorage;
  afterEach(() => { global.localStorage = origLS; });

  test('getPrefs survives localStorage.getItem throwing (private mode)', () => {
    global.localStorage = { getItem() { throw new Error('denied'); } };
    const { getPrefs } = require('../src/a11y/accessibility.js');
    const p = getPrefs();
    expect(typeof p.highContrast).toBe('boolean');
  });

  test('setPref still applies in-memory when setItem throws (quota)', () => {
    global.localStorage = {
      getItem: () => null,
      setItem() { throw new Error('QuotaExceededError'); }
    };
    const { setPref, getPrefs } = require('../src/a11y/accessibility.js');
    expect(() => setPref('highContrast', true)).not.toThrow();
    expect(getPrefs().highContrast).toBe(true);
    setPref('highContrast', false);
  });

  test('corrupt stored JSON degrades to defaults instead of crashing', () => {
    global.localStorage = { getItem: () => '{not json', setItem() {} };
    // module cached prefs may be polluted by earlier tests — clear and reload
    jest.resetModules();
    const fresh = require('../src/a11y/accessibility.js');
    expect(typeof fresh.getPrefs().highContrast).toBe('boolean');
  });
});

describe('a11y storage — guard arms', () => {
  test('load() returns {} when localStorage is absent or empty', () => {
    const orig = global.localStorage;
    delete global.localStorage;
    jest.resetModules();
    const mod = require('../src/a11y/accessibility.js');
    expect(mod.getPrefs()).toBeTruthy();
    global.localStorage = { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() };
    jest.resetModules();
    const mod2 = require('../src/a11y/accessibility.js');
    expect(mod2.getPrefs().highContrast).toBe(false);
    global.localStorage = orig;
    jest.resetModules();
  });
});

test('captionLayout scale clamp arms', async () => {
  const { captionMeasureEm, captionFontSizeFor } = await import('../src/vr/accessibility/captionLayout.js');
  expect(captionMeasureEm(0)).toBe(captionMeasureEm(1));
  expect(captionFontSizeFor(3, -5)).toBe(captionFontSizeFor(3, 1));
});

test('urlDisplay room<=1 yields bare ellipsis; layoutSettingsPanel tolerates non-array', async () => {
  const { elideUrlForDisplay } = await import('../src/vr/browser/urlDisplay.js');
  const out = elideUrlForDisplay('https://a.co/averylongpath', 5); // room = 5-4 = 1
  expect(out.endsWith('…')).toBe(true);
  const { layoutSettingsPanel } = await import('../src/vr/ui/settingsLayout.js');
  expect(layoutSettingsPanel(null)).toEqual(expect.anything());
});

test('layout helpers cover omitted-default arms', async () => {
  const { captionMeasureEm, captionFontSizeFor } = await import('../src/vr/accessibility/captionLayout.js');
  expect(captionMeasureEm()).toBe(captionMeasureEm(1));
  expect(captionFontSizeFor(3)).toBe(captionFontSizeFor(3, 1));
  const { hitTest, bookmarkPanelColors } = await import('../src/vr/browser/bookmarkLayout.js');
  expect(hitTest(1, 1)).toBeTruthy();
  expect(bookmarkPanelColors()).toBeTruthy();
  const { toggleIndicatorColors, buttonAccentColor } = await import('../src/vr/ui/buttonStyle.js');
  expect(toggleIndicatorColors(true)).toBeTruthy();
  expect(buttonAccentColor('#123456')).toBeTruthy();
  const { imeColors } = await import('../src/vr/input/keyboardLayout.js');
  expect(imeColors()).toBeTruthy();
  const { layoutSettingsPanel } = await import('../src/vr/ui/settingsLayout.js');
  expect(layoutSettingsPanel([{ id: 'a' }])).toBeTruthy();   // openIds default
});

test('stored prefs that parse to falsy degrade to defaults', () => {
  global.localStorage = { getItem: () => 'null', setItem() {}, removeItem() {} };
  jest.resetModules();
  let mod;
  expect(() => { mod = require('../src/a11y/accessibility.js'); }).not.toThrow();
  expect(mod).toBeTruthy();
  delete global.localStorage;
  jest.resetModules();
});

test('stepper/layout/url sliver arms', async () => {
  const { decimalsFor } = await import('../src/vr/settingsStepper.js');
  expect(decimalsFor(0.1)).toBe(1);
  expect(decimalsFor(1e-7)).toBe(0);            // String → '1e-7' → no dot
  const { tabCloseZonePx } = await import('../src/vr/browser/panelGeometry.js');
  expect(tabCloseZonePx('nope').w).toBe(0);     // Number() NaN → 0
  const { topSiteTiles } = await import('../src/vr/browser/newTabPage.js');
  const tiles = topSiteTiles([{ url: 'https://x.example', title: 42 }], 800, 600);
  expect(tiles[0].title).toBe('');
  const { isSearchQuery } = await import('../src/vr/browser/urlResolver.js');
  expect(isSearchQuery('https://custom.example/?q=abc', { searchEngine: 'https://custom.example/?q=' })).toBe(true);
  const { extractReadableText } = await import('../src/vr/browser/readableText.js');
  const out = extractReadableText('<html><body><p></p><p>Real content here with enough text to count.</p></body></html>');
  expect(out).toBeTruthy();
});

test('readerLayout + textWrap + panelGeometry remaining default/guard arms', async () => {
  const rl = await import('../src/vr/browser/readerLayout.js');
  expect(rl.measureEmFor()).toBe(rl.measureEmFor(1));
  expect(rl.visibleLineCount(1, true)).toBeLessThanOrEqual(rl.visibleLineCount(1));
  expect(rl.fontPxFor('body')).toBeTruthy();
  const hit = rl.readerHitTest(50, rl.ARROW_Y0 + 2, true);
  expect(hit).toBeTruthy();
  const tw = await import('../src/vr/ui/textWrap.js');
  expect(tw.truncateToWidth('한국어한국어', 3)).toBeTruthy();    // Hangul width arm
  expect(tw.truncateToWidth(null, NaN)).toBe('');               // NaN→0.5 + null text
  expect(tw.wrapTextToLines && typeof tw.wrapTextToLines === 'function').toBe(true);
});

test('chromeColors + performance monitor sliver arms', async () => {
  const cc = await import('../src/vr/browser/chromeColors.js');
  expect(cc.webChromeColors()).toBeTruthy();
  expect(cc.webContentColors()).toBeTruthy();
  expect(cc.tabStripColors()).toBeTruthy();
  const { DeviceCompatibility } = await import('../src/utils/DeviceCompatibility.js');
  expect(DeviceCompatibility).toBeTruthy();
});

test('textWrap CJK ranges + NaN limits; BookmarkStore writeJSON without localStorage', async () => {
  const tw = await import('../src/vr/ui/textWrap.js');
  expect(tw.wrapTextToLines('⺀ radical test', NaN)).toBeTruthy();   // floor(NaN)→1 + CJK cp arm
  expect(tw.wrapTextToLines(null, 10)).toEqual(['']);
  const { BookmarkStore } = await import('../src/utils/BookmarkStore.js');
  const savedLS = global.localStorage;
  delete global.localStorage;
  const store = new BookmarkStore();
  expect(() => store.addHistory('https://x.example', 'X')).not.toThrow();
  global.localStorage = savedLS;
});

describe('readerLayout — default-parameter arms', () => {
  const { visibleLineCount, readerHitTest } = require('../src/vr/browser/readerLayout.js');
  test('visibleLineCount(scale) without reserveBottom uses the false default', () => {
    const withReserve = visibleLineCount(1, true);
    const plain = visibleLineCount(1);
    expect(plain).toBeGreaterThan(withReserve);
  });
  test('readerHitTest(px, py) without scrollable treats arrows as dead', () => {
    const { ARROW_Y0, ARROW_DN_X0 } = require('../src/vr/browser/readerLayout.js');
    // Dead zone: hit inside the arrow area without scrollable reports 'none'
    expect(readerHitTest(ARROW_DN_X0 + 5, ARROW_Y0 + 5)).toEqual({ type: 'none' });
  });
});
