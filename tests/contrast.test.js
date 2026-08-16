/**
 * Colour-contrast invariants for the canvas-drawn VR UI.
 *
 * Two halves:
 *
 *  1. The maths is self-checked against known values (WCAG 2's 21:1 / 1:1
 *     endpoints, and three published APCA reference results). A contrast
 *     checker that is itself wrong would happily certify an unreadable palette.
 *
 *  2. A sweep over EVERY colour pair the app actually paints, sourced from the
 *     real exported palette functions rather than copied here, asserting each
 *     clears its WCAG 2 threshold in both normal and high-contrast mode. This
 *     is the regression guard: canvas pixels live inside a WebGL texture, so no
 *     devtools inspector and no human eye can catch a colour tweak that dips
 *     below the line — only a test can.
 *
 * APCA (the WCAG 3 candidate) is computed and reported but not asserted. It is
 * not normative, and conforming to it here would be a visual redesign rather
 * than a defect fix — the measured shortfalls are recorded in
 * docs/OUTSTANDING_ISSUES.md section G instead of silently ignored.
 */

const {
  parseCssColor, compositeOver, relativeLuminance,
  contrastRatio, wcagMinimum, apcaLc
} = require('../src/vr/ui/contrast.js');
const { bookmarkPanelColors } = require('../src/vr/browser/bookmarkLayout.js');
const { webChromeColors, webContentColors } = require('../src/vr/browser/chromeColors.js');
const { imeBadgeColors } = require('../src/vr/input/keyboardLayout.js');
const { toggleIndicatorColors, buttonBg } = require('../src/vr/ui/buttonStyle.js');
const { securityIndicator } = require('../src/vr/browser/urlDisplay.js');

// ── parsing / compositing ────────────────────────────────────────────────────
describe('parseCssColor', () => {
  test('parses 6-digit hex', () => {
    expect(parseCssColor('#4488ff')).toEqual({ r: 0x44, g: 0x88, b: 0xff, a: 1 });
  });

  test('parses 3-digit shorthand hex by doubling each nibble', () => {
    expect(parseCssColor('#48f')).toEqual({ r: 0x44, g: 0x88, b: 0xff, a: 1 });
  });

  test('parses rgb() and rgba(), defaulting alpha to 1', () => {
    expect(parseCssColor('rgb(16, 20, 30)')).toEqual({ r: 16, g: 20, b: 30, a: 1 });
    expect(parseCssColor('rgba(16,20,30,0.92)')).toEqual({ r: 16, g: 20, b: 30, a: 0.92 });
  });

  test('returns null for unsupported forms rather than guessing', () => {
    // The old inline helper in button-style.test.js silently treated anything
    // it could not parse as black, which scores as maximum contrast.
    expect(parseCssColor('red')).toBeNull();
    expect(parseCssColor('hsl(0,100%,50%)')).toBeNull();
    expect(parseCssColor('')).toBeNull();
    expect(parseCssColor(undefined)).toBeNull();
  });
});

describe('compositeOver', () => {
  test('a fully opaque colour is unchanged by the backdrop', () => {
    expect(compositeOver('#4488ff', '#ffffff')).toBe('#4488ff');
  });

  test('50% white over black is mid grey', () => {
    expect(compositeOver('rgba(255,255,255,0.5)', '#000000')).toBe('#808080');
  });

  test('alpha 0 yields the backdrop exactly', () => {
    expect(compositeOver('rgba(255,0,0,0)', '#123456')).toBe('#123456');
  });

  test('the button backing is NOT the colour it declares', () => {
    // rgba(16,20,30,0.92) over black renders darker than rgb(16,20,30).
    expect(compositeOver('rgba(16,20,30,0.92)', '#000000')).toBe('#0f121c');
  });
});

// ── WCAG 2 ───────────────────────────────────────────────────────────────────
describe('contrastRatio (WCAG 2.x)', () => {
  test('black on white is the 21:1 maximum', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  test('identical colours are the 1:1 minimum', () => {
    expect(contrastRatio('#7788aa', '#7788aa')).toBeCloseTo(1, 10);
  });

  test('is symmetric — order of foreground and background does not matter', () => {
    expect(contrastRatio('#ffffff', '#0a2a4a')).toBeCloseTo(contrastRatio('#0a2a4a', '#ffffff'), 10);
  });

  test('composites a translucent background before measuring', () => {
    // Scoring the declared rgb(30,35,55) instead of the rendered pixel reports
    // a different ratio than the user actually sees.
    const rendered = contrastRatio('#727f96', 'rgba(30,35,55,0.6)', '#000000');
    const declared = contrastRatio('#727f96', 'rgb(30,35,55)');
    expect(rendered).not.toBeCloseTo(declared, 2);
    expect(rendered).toBeCloseTo(contrastRatio('#727f96', '#121521'), 2);
  });

  test('relativeLuminance matches the sRGB endpoints', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 10);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10);
  });
});

describe('wcagMinimum', () => {
  test('body text needs 4.5:1', () => {
    expect(wcagMinimum({ fontPx: 18 })).toBe(4.5);
    expect(wcagMinimum({ fontPx: 20, bold: true })).toBe(3);   // ≥18.66 bold is large
  });

  test('large text needs 3:1', () => {
    expect(wcagMinimum({ fontPx: 24 })).toBe(3);
    expect(wcagMinimum({ fontPx: 23.9 })).toBe(4.5);
  });

  test('non-text UI is a flat 3:1 regardless of size', () => {
    expect(wcagMinimum({ nonText: true })).toBe(3);
    expect(wcagMinimum({ nonText: true, fontPx: 8 })).toBe(3);
  });
});

// ── APCA ─────────────────────────────────────────────────────────────────────
describe('apcaLc (WCAG 3 candidate)', () => {
  // Published APCA-W3 reference values. If these drift the implementation is
  // wrong, and every Lc figure recorded in the docs would be fiction.
  test('matches the published reference values', () => {
    expect(apcaLc('#000000', '#ffffff')).toBeCloseTo(106.04, 1);
    expect(apcaLc('#ffffff', '#000000')).toBeCloseTo(-107.88, 1);
    expect(apcaLc('#888888', '#ffffff')).toBeCloseTo(63.06, 1);
  });

  test('sign encodes polarity — negative for light text on dark', () => {
    expect(apcaLc('#ffffff', '#1a1a2e')).toBeLessThan(0);
    expect(apcaLc('#1a1a2e', '#ffffff')).toBeGreaterThan(0);
  });

  test('identical colours score 0', () => {
    expect(apcaLc('#445566', '#445566')).toBe(0);
  });

  test('disagrees with WCAG 2 near black — the reason it is reported at all', () => {
    // Two pairs WCAG 2 rates almost identically; APCA separates them clearly.
    const aW = contrastRatio('#8891ad', '#1a1a2e');
    const bW = contrastRatio('#7788aa', '#161b2e');
    expect(Math.abs(aW - bW)).toBeLessThan(0.7);
    expect(Math.abs(apcaLc('#8891ad', '#1a1a2e'))).toBeGreaterThan(
      Math.abs(apcaLc('#7788aa', '#161b2e'))
    );
  });
});

// ── the palette sweep ────────────────────────────────────────────────────────
/**
 * Every pair the app paints. `fontPx`/`bold` pick the WCAG 2 threshold;
 * `nonText: true` marks borders and indicator fills (1.4.11).
 * `backdrop` is the opaque surface a translucent `bg` is composited over.
 */
function palettePairs(hc) {
  const bm = bookmarkPanelColors(hc);
  const ch = webChromeColors(hc);
  const ct = webContentColors(hc);
  const bmBack = hc ? '#000000' : '#000000'; // panel sits on the dark scene
  const bmBg = compositeOver(bm.bg, bmBack);
  const pairs = [];
  const add = (label, fg, bg, spec, backdrop) =>
    pairs.push({ label, fg, bg, spec, backdrop: backdrop || '#000000' });

  // Bookmark / history panel
  add('bookmark rowTitle', bm.rowTitle, bm.bg, { fontPx: 26, bold: true }, bmBack);
  add('bookmark rowUrl', bm.rowUrl, bm.bg, { fontPx: 20 }, bmBack);
  add('bookmark emptyText', bm.emptyText, bm.bg, { fontPx: 24 }, bmBack);
  add('bookmark pageIndicator', bm.pageIndicator, bm.headerBg, { fontPx: 20 });
  add('bookmark tabActive', bm.tabActive.text, bm.tabActive.bg, { fontPx: 24 });
  add('bookmark tabInactive', bm.tabInactive.text, bm.tabInactive.bg, { fontPx: 24 });
  add('bookmark scrollActive', bm.scrollActive.text, bm.scrollActive.bg, { fontPx: 36, bold: true }, bmBg);
  add('bookmark scrollInactive', bm.scrollInactive.text, bm.scrollInactive.bg, { fontPx: 36, bold: true }, bmBg);
  add('bookmark deleteText', bm.deleteText, bm.deleteZoneBg, { fontPx: 28, bold: true }, bmBg);
  add('bookmark closeBtn', '#ffffff', bm.closeBg, { fontPx: 32, bold: true });

  // Browser chrome bar
  add('chrome back/fwd enabled', ch.btnEnabledText, ch.btnEnabledBg, { fontPx: 24, bold: true });
  add('chrome back/fwd disabled', ch.btnDisabledText, ch.btnDisabledBg, { fontPx: 24, bold: true });
  add('chrome reload idle', ch.reloadText, ch.reloadBg, { fontPx: 24, bold: true });
  add('chrome reload loading', ch.reloadLoading, ch.reloadBg, { fontPx: 24, bold: true });
  add('chrome url text', ch.urlText, ch.urlBg, { fontPx: 18 });
  add('chrome url placeholder', ch.urlPlaceholder, ch.urlBg, { fontPx: 18 });
  add('chrome url border/bar', ch.urlBorder, ch.bg, { nonText: true });
  add('chrome url border/fill', ch.urlBorder, ch.urlBg, { nonText: true });
  add('chrome load-error text', ch.errorText, ch.urlErrorBg, { fontPx: 17 });
  add('chrome star marked', ch.starMarked, ch.starBg, { fontPx: 26, bold: true });
  add('chrome star unmarked', ch.starUnmarked, ch.starBg, { fontPx: 26, bold: true });
  add('chrome close', ch.closeText, ch.closeBg, { fontPx: 24, bold: true });

  // Page viewport (reader + state screens)
  add('content state title', ct.stateTitle, ct.bg, { fontPx: 28 });
  add('content state detail', ct.stateDetail, ct.bg, { fontPx: 18 });
  add('reader body', ct.readerBody, ct.bg, { fontPx: 20 });
  add('reader heading', ct.readerHeading, ct.bg, { fontPx: 30, bold: true });
  add('reader progress', ct.progress, ct.bg, { fontPx: 16 });
  add('reader arrow active', ct.arrowActiveText, ct.arrowActiveBg, { fontPx: 34, bold: true }, ct.bg);
  add('reader arrow idle', ct.arrowIdleText, ct.arrowIdleBg, { fontPx: 34, bold: true }, ct.bg);

  // Japanese IME — badge glyph, and the badge rectangle as an indicator
  for (const mode of ['hiragana', 'katakana', 'kanji']) {
    const b = imeBadgeColors(mode);
    add(`IME badge glyph ${mode}`, b.text, b.bg, { fontPx: 36, bold: true });
    add(`IME badge rect ${mode}`, b.bg, '#111726', { nonText: true });
  }

  // Settings-panel buttons (buttonStyle.js). Both hover states matter: the
  // indicator is painted over whichever fill buttonBg() returns, and the hover
  // fill is deliberately much brighter than the idle one.
  for (const on of [true, false]) {
    for (const hover of [false, true]) {
      const t = toggleIndicatorColors(on, hc, hover);
      const bg = buttonBg(hover, hc);
      const tag = `${on ? 'ON' : 'OFF'}${hover ? ' hover' : ''}`;
      add(`btn toggle ${tag} label`, t.label, bg, { fontPx: 40, bold: true });
      add(`btn toggle ${tag} border`, t.border, bg, { nonText: true });
      add(`btn ${tag} title`, '#ffffff', bg, { fontPx: 40, bold: true });
    }
  }

  // Security indicator glyph, drawn inside the address bar
  for (const level of ['secure', 'insecure', 'local', 'none']) {
    const ind = securityIndicator(level, hc);
    if (ind.glyph) {
      add(`security ${level}`, ind.color, ch.urlBg, { fontPx: 18 });
    }
  }
  return pairs;
}

describe.each([['normal', false], ['high-contrast', true]])(
  'palette sweep — %s mode meets WCAG 2 (1.4.3 / 1.4.11)',
  (_name, hc) => {
    const pairs = palettePairs(hc);

    test('the sweep actually covers the palette (guards against an empty loop)', () => {
      expect(pairs.length).toBeGreaterThanOrEqual(40);
      // Every colour must be parseable — an unparseable one would score as
      // black and could pass while being invisible on screen.
      for (const p of pairs) {
        expect(parseCssColor(p.fg)).not.toBeNull();
        expect(parseCssColor(p.bg)).not.toBeNull();
      }
    });

    test.each(pairs.map((p) => [p.label, p]))('%s', (_label, p) => {
      const need = wcagMinimum(p.spec);
      const got = contrastRatio(p.fg, p.bg, p.backdrop);
      // Reported on failure so the message names the measured value, not just
      // "expected true".
      expect({ pair: `${p.fg} on ${p.bg}`, ratio: Number(got.toFixed(2)), need })
        .toEqual({ pair: `${p.fg} on ${p.bg}`, ratio: expect.any(Number), need });
      expect(got).toBeGreaterThanOrEqual(need);
    });
  }
);

describe('high-contrast mode strengthens the pairs that need it', () => {
  // A flat "high contrast never reduces any ratio" rule sounds right and is
  // wrong: high-contrast mode deliberately trades headroom on already-strong
  // text for *component* visibility. The white ◀ glyph drops from 10.8:1 on
  // `#3a3a5c` to 6.9:1 on `#004adf` — but the button fill itself climbs from
  // 1.48:1 to 5.1:1 against its background, which is the whole point.
  //
  // What must hold is narrower and actually meaningful: any pair that is not
  // already comfortable in normal mode (< 2× its required ratio) must not get
  // weaker when the user asks for more contrast. Everything else is bounded by
  // the sweep above, which already requires both modes to clear the threshold.
  const COMFORTABLE = 2;
  const normal = new Map(palettePairs(false).map((p) => [p.label, p]));
  const high = new Map(palettePairs(true).map((p) => [p.label, p]));
  const shared = [...normal.keys()].filter((k) => high.has(k));

  test('covers the shared pairs', () => {
    expect(shared.length).toBeGreaterThanOrEqual(40);
  });

  test.each(shared)('%s', (label) => {
    const n = normal.get(label);
    const h = high.get(label);
    const need = wcagMinimum(n.spec);
    const nr = contrastRatio(n.fg, n.bg, n.backdrop);
    const hr = contrastRatio(h.fg, h.bg, h.backdrop);
    if (nr < need * COMFORTABLE) {
      expect(hr).toBeGreaterThanOrEqual(nr - 0.001);
    } else {
      expect(hr).toBeGreaterThanOrEqual(need);
    }
  });

  test('the weakest pair in the palette is stronger in high-contrast mode', () => {
    const worst = (pairs) => Math.min(
      ...pairs.map((p) => contrastRatio(p.fg, p.bg, p.backdrop) / wcagMinimum(p.spec))
    );
    expect(worst(palettePairs(true))).toBeGreaterThan(worst(palettePairs(false)));
  });
});

// ── the specific defects this session fixed ──────────────────────────────────
describe('regressions fixed in the contrast audit', () => {
  test('chrome disabled glyph is visible but still clearly dimmer than enabled', () => {
    const ch = webChromeColors(false);
    const disabled = contrastRatio(ch.btnDisabledText, ch.btnDisabledBg);
    const enabled = contrastRatio(ch.btnEnabledText, ch.btnEnabledBg);
    expect(disabled).toBeGreaterThanOrEqual(3);     // was #44445a → 1.66:1
    expect(disabled).toBeLessThan(enabled / 2);     // still reads as unavailable
  });

  test('address-bar placeholder clears the body-text bar', () => {
    const ch = webChromeColors(false);
    expect(contrastRatio(ch.urlPlaceholder, ch.urlBg)).toBeGreaterThanOrEqual(4.5); // was 3.94
  });

  test('the address bar has a boundary against the chrome background', () => {
    const ch = webChromeColors(false);
    // The fill alone is ~1.16:1, so the border is what identifies the input.
    expect(contrastRatio(ch.urlBg, ch.bg)).toBeLessThan(3);
    expect(contrastRatio(ch.urlBorder, ch.bg)).toBeGreaterThanOrEqual(3);
  });

  test('every IME badge glyph clears 3:1 — white did not', () => {
    for (const mode of ['hiragana', 'katakana', 'kanji']) {
      const b = imeBadgeColors(mode);
      expect(contrastRatio(b.text, b.bg)).toBeGreaterThanOrEqual(3);
      // The previous white glyph failed on katakana (2.37) and kanji (2.05).
      expect(contrastRatio(b.text, b.bg)).toBeGreaterThan(contrastRatio('#ffffff', b.bg));
    }
  });

  test('an unknown IME mode still yields a legible badge', () => {
    const b = imeBadgeColors('unknown-mode');
    expect(contrastRatio(b.text, b.bg)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(b.bg, '#111726')).toBeGreaterThanOrEqual(3);
  });

  test('inactive scroll arrows are perceivable in both panels', () => {
    const bm = bookmarkPanelColors(false);
    const ct = webContentColors(false);
    expect(contrastRatio(bm.scrollInactive.text, bm.scrollInactive.bg, compositeOver(bm.bg, '#000000')))
      .toBeGreaterThanOrEqual(3); // was #445566 → 2.37:1
    expect(contrastRatio(ct.arrowIdleText, ct.arrowIdleBg, ct.bg))
      .toBeGreaterThanOrEqual(3); // was #445566 → 2.12:1
    // …and still visibly weaker than the active arrow, so the state reads.
    expect(contrastRatio(ct.arrowIdleText, ct.arrowIdleBg, ct.bg))
      .toBeLessThan(contrastRatio('#ffffff', ct.arrowActiveBg, ct.bg));
  });
});
