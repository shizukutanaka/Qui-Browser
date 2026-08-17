/**
 * Reader-mode text extraction + layout. All pure (no canvas, no THREE, no DOM)
 * — which is the point: canvas output can't be verified headlessly, so every
 * decision that matters lives in these functions.
 */

const {
  extractReadableText, extractTitle, decodeEntities
} = require('../src/vr/browser/readableText.js');
const {
  layoutReaderLines, clampReaderScroll, readerWindow, readerProgressLabel,
  visibleLineCount, measureEmFor, maxMeasureEmForFont, fontPxFor, MEASURE_EM,
  CONTENT_PX_W, CONTENT_PAD
} = require('../src/vr/browser/readerLayout.js');
const {
  wrapTextToLines, wrapTextToWidth, textWidthEm, charWidthEm,
  HALFWIDTH_EM, EMOJI_EM, WIDTH_SAFETY
} = require('../src/vr/ui/textWrap.js');

describe('decodeEntities', () => {
  test('decodes the named entities that occur in prose', () => {
    expect(decodeEntities('a &amp; b &lt;c&gt; &quot;d&quot;')).toBe('a & b <c> "d"');
    expect(decodeEntities('dash&mdash;here&hellip;')).toBe('dash—here…');
  });

  test('decodes numeric and hex references', () => {
    expect(decodeEntities('&#65;&#x42;')).toBe('AB');
    expect(decodeEntities('&#x65e5;&#x672c;')).toBe('日本');
  });

  test('leaves unknown entities untouched rather than mangling them', () => {
    expect(decodeEntities('&notreal; x')).toBe('&notreal; x');
  });

  test('null/undefined are safe', () => {
    expect(decodeEntities(null)).toBe('');
    expect(decodeEntities(undefined)).toBe('');
  });
});

describe('extractTitle', () => {
  test('prefers <title>', () => {
    expect(extractTitle('<html><title>Real Title</title><h1>Other</h1>')).toBe('Real Title');
  });

  test('falls back to the first h1', () => {
    expect(extractTitle('<html><body><h1>Heading</h1></body>')).toBe('Heading');
  });

  test('returns empty when there is neither', () => {
    expect(extractTitle('<p>nothing</p>')).toBe('');
  });
});

describe('extractReadableText', () => {
  test('drops script/style content entirely', () => {
    const html = `
      <html><body>
        <script>var secret = "should not appear";</script>
        <style>.x { color: red }</style>
        <p>Visible prose.</p>
      </body></html>`;
    const { blocks } = extractReadableText(html);
    const all = blocks.map(b => b.text).join(' ');
    expect(all).toContain('Visible prose.');
    expect(all).not.toContain('secret');
    expect(all).not.toContain('color: red');
  });

  test('drops nav/header/footer/aside boilerplate', () => {
    const html = `
      <body>
        <nav><a href="/">Home</a><a href="/x">Nav Link</a></nav>
        <header>Site Header</header>
        <p>The actual article body.</p>
        <aside>Related junk</aside>
        <footer>Copyright notice</footer>
      </body>`;
    const all = extractReadableText(html).blocks.map(b => b.text).join(' ');
    expect(all).toContain('The actual article body.');
    expect(all).not.toContain('Nav Link');
    expect(all).not.toContain('Copyright notice');
    expect(all).not.toContain('Related junk');
  });

  test('prefers <article> when it carries substantial text', () => {
    const filler = 'This is the real article content and it is long enough to win. '.repeat(6);
    const html = `
      <body>
        <div><p>Sidebar chatter that should lose.</p></div>
        <article><p>${filler}</p></article>
      </body>`;
    const all = extractReadableText(html).blocks.map(b => b.text).join(' ');
    expect(all).toContain('real article content');
    expect(all).not.toContain('Sidebar chatter');
  });

  test('keeps headings and paragraphs in document order with types', () => {
    const html = '<body><h2>First Heading</h2><p>Body one.</p><h3>Second</h3><p>Body two.</p></body>';
    const { blocks } = extractReadableText(html);
    expect(blocks.map(b => b.type)).toEqual(['h', 'p', 'h', 'p']);
    expect(blocks[0].text).toBe('First Heading');
    expect(blocks[3].text).toBe('Body two.');
  });

  test('decodes entities and collapses whitespace inside blocks', () => {
    const html = '<p>Tom  &amp;\n   Jerry   &mdash; friends</p>';
    expect(extractReadableText(html).blocks[0].text).toBe('Tom & Jerry — friends');
  });

  test('extracts Japanese prose intact', () => {
    const html = '<body><h1>日本語の見出し</h1><p>これは本文です。空白がありません。</p></body>';
    const { title, blocks } = extractReadableText(html);
    expect(title).toBe('日本語の見出し');
    expect(blocks.some(b => b.text.includes('これは本文です'))).toBe(true);
  });

  test('an empty shell yields no blocks rather than garbage', () => {
    expect(extractReadableText('<html><body><div id="root"></div></body></html>').blocks).toHaveLength(0);
    expect(extractReadableText('').blocks).toHaveLength(0);
    expect(extractReadableText(null).blocks).toHaveLength(0);
  });
});

describe('layoutReaderLines', () => {
  test('wraps prose to the em measure for the scale', () => {
    const long = 'word '.repeat(80).trim();
    const lines = layoutReaderLines([{ type: 'p', text: long }]);
    const max = measureEmFor(1);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) {
      expect(textWidthEm(l.text)).toBeLessThanOrEqual(max);
    }
  });

  test('spaceless Japanese hard-splits without severing surrogate pairs', () => {
    // 𠮷 is a surrogate pair; a UTF-16 slice would break it.
    const jp = ('𠮷野家'.repeat(40));
    const lines = layoutReaderLines([{ type: 'p', text: jp }], { scale: 1 });
    const joined = lines.filter(l => l.style === 'p').map(l => l.text).join('');
    expect(joined).toBe(jp);
    expect(joined).not.toContain('�');
  });

  test('title is emitted first with title style', () => {
    const lines = layoutReaderLines([{ type: 'p', text: 'Body.' }], { title: 'The Title' });
    expect(lines[0].style).toBe('title');
    expect(lines[0].text).toBe('The Title');
  });

  test('no leading blank line at the very top', () => {
    const lines = layoutReaderLines([{ type: 'p', text: 'First.' }]);
    expect(lines[0].style).not.toBe('blank');
  });

  test('blocks are separated by a blank line', () => {
    const lines = layoutReaderLines([
      { type: 'p', text: 'One.' },
      { type: 'p', text: 'Two.' }
    ]);
    expect(lines.map(l => l.style)).toEqual(['p', 'blank', 'p']);
  });

  test('bigger scale wraps sooner (narrower em measure)', () => {
    expect(measureEmFor(2)).toBeLessThan(measureEmFor(1));
  });

  test('empty / non-array input yields no lines', () => {
    expect(layoutReaderLines([])).toEqual([]);
    expect(layoutReaderLines(null)).toEqual([]);
  });
});

describe('clampReaderScroll / readerWindow / readerProgressLabel', () => {
  const lines = Array.from({ length: 100 }, (_, i) => ({ text: `L${i}`, style: 'p' }));

  test('clamps below zero and past the end', () => {
    expect(clampReaderScroll(-5, 100, 10)).toBe(0);
    expect(clampReaderScroll(999, 100, 10)).toBe(90);
  });

  test('a list that fits cannot scroll', () => {
    expect(clampReaderScroll(5, 8, 10)).toBe(0);
  });

  test('window never returns an empty slice for a non-empty list', () => {
    expect(readerWindow(lines, 999, 10)).toHaveLength(10);
    expect(readerWindow(lines, -3, 10)[0].text).toBe('L0');
  });

  test('progress label matches the bookmark-panel convention', () => {
    expect(readerProgressLabel(0, 100, 10)).toBe('1–10/100');
    expect(readerProgressLabel(90, 100, 10)).toBe('91–100/100');
  });

  test('no progress label when everything fits', () => {
    expect(readerProgressLabel(0, 8, 10)).toBe('');
  });

  test('non-finite offsets degrade to 0', () => {
    expect(clampReaderScroll(NaN, 100, 10)).toBe(0);
    expect(clampReaderScroll(undefined, 100, 10)).toBe(0);
  });
});

describe('viewport metrics', () => {
  test('visible line count shrinks as text grows', () => {
    expect(visibleLineCount(2)).toBeLessThan(visibleLineCount(1));
    expect(visibleLineCount(1)).toBeGreaterThan(5);
  });

  test('font size ranks title > heading > paragraph and scales', () => {
    expect(fontPxFor('title', 1)).toBeGreaterThan(fontPxFor('h', 1));
    expect(fontPxFor('h', 1)).toBeGreaterThan(fontPxFor('p', 1));
    expect(fontPxFor('p', 2)).toBeGreaterThan(fontPxFor('p', 1));
  });
});

// Script-correct line measure. A code-point budget silently assumes every
// character has the same advance, which is false for the two scripts this app
// targets: CJK is 1 em, Latin ~0.5 em (Unicode UAX #11 East Asian Width).
describe('em-based measure — Japanese must not overflow the panel', () => {
  const BODY_PX = fontPxFor('p', 1);          // 20
  const COLUMN_EM = maxMeasureEmForFont(BODY_PX); // what physically fits

  test('charWidthEm classes: full-width 1 em, half-width a measured BOUND', () => {
    expect(charWidthEm('本'.codePointAt(0))).toBe(1);
    expect(charWidthEm('あ'.codePointAt(0))).toBe(1);
    expect(charWidthEm('Ａ'.codePointAt(0))).toBe(1);   // fullwidth Latin
    // 0.6 bounds real measured Latin: 0.453 lowercase sans, 0.584 bold caps,
    // 0.602 monospace. The old 0.5 "average" under-counted URLs and caps.
    expect(charWidthEm('A'.codePointAt(0))).toBe(HALFWIDTH_EM);
    expect(charWidthEm('7'.codePointAt(0))).toBe(HALFWIDTH_EM);
    // 0.6 covers proportional bold caps (0.584) outright. Monospace (0.602)
    // is covered by the WIDTH_SAFETY margin on top, not by the bound alone —
    // tools/verify-text-layout.mjs confirms the combination actually fits.
    expect(HALFWIDTH_EM).toBeGreaterThanOrEqual(0.584);
    expect(HALFWIDTH_EM / WIDTH_SAFETY).toBeGreaterThanOrEqual(0.602);
  });

  test('emoji get their own class — they render wider than one em', () => {
    // Measured 1.248 em; classing them as 1.0 (plain Wide) overflowed titles.
    expect(charWidthEm('😀'.codePointAt(0))).toBe(EMOJI_EM);
    expect(EMOJI_EM).toBeGreaterThan(1);
  });

  test('the ellipsis counts as a full em (it is appended by every truncation)', () => {
    expect(charWidthEm('…'.codePointAt(0))).toBe(1);
  });

  test('textWidthEm measures mixed scripts, not code points', () => {
    // 3 kanji (3 em) + 3 ASCII (3 * HALFWIDTH_EM) from 6 code points.
    expect(textWidthEm('日本語abc')).toBeCloseTo(3 + 3 * HALFWIDTH_EM);
  });

  test('the chosen measure physically fits the text column', () => {
    expect(MEASURE_EM).toBeLessThanOrEqual(COLUMN_EM);
  });

  test('REGRESSION: Japanese prose no longer exceeds the column width', () => {
    // Pre-fix, a 58-CHARACTER budget rendered 58 full-width glyphs = 1160px
    // into a 928px column — 25% off the panel edge.
    const jp = 'これは日本語の本文です。'.repeat(30);
    for (const l of layoutReaderLines([{ type: 'p', text: jp }])) {
      expect(textWidthEm(l.text) * BODY_PX).toBeLessThanOrEqual(CONTENT_PX_W - 2 * CONTENT_PAD);
    }
  });

  test('one measure lands BOTH scripts in their researched optimum', () => {
    // Latin classic measure 45–75 chars; horizontal Japanese 15–35.
    const en = layoutReaderLines([{ type: 'p', text: 'word '.repeat(200).trim() }])
      .filter(l => l.style === 'p');
    const jp = layoutReaderLines([{ type: 'p', text: '本'.repeat(400) }])
      .filter(l => l.style === 'p');
    const enChars = Array.from(en[0].text).length;
    const jpChars = Array.from(jp[0].text).length;
    expect(enChars).toBeGreaterThanOrEqual(45);
    expect(enChars).toBeLessThanOrEqual(75);
    expect(jpChars).toBeGreaterThanOrEqual(15);
    expect(jpChars).toBeLessThanOrEqual(35);
  });

  test('mixed Japanese/Latin lines also stay within the measure', () => {
    const mixed = 'WebXRの仕様はW3Cが策定しています。'.repeat(20);
    for (const l of layoutReaderLines([{ type: 'p', text: mixed }])) {
      expect(textWidthEm(l.text)).toBeLessThanOrEqual(measureEmFor(1));
    }
  });

  test('wrapTextToWidth never severs a surrogate pair', () => {
    const rows = wrapTextToWidth('𠮷'.repeat(20), 5);
    expect(rows.join('')).toBe('𠮷'.repeat(20));
    expect(rows.join('')).not.toContain('�');
    for (const r of rows) {
      expect(textWidthEm(r)).toBeLessThanOrEqual(5);
    }
  });

  test('headings wrap to the same measure as prose', () => {
    const lines = layoutReaderLines([{ type: 'h', text: '見出し'.repeat(30) }]);
    for (const l of lines) {
      expect(textWidthEm(l.text)).toBeLessThanOrEqual(measureEmFor(1));
    }
  });
});

describe('wrapTextToLines (shared with CaptionSystem)', () => {
  test('is the same hardened implementation captions rely on', () => {
    expect(wrapTextToLines('', 10)).toEqual(['']);
    expect(wrapTextToLines('a b c', 10)).toEqual(['a b c']);
  });

  test('hard-splits a long spaceless run by code point', () => {
    const rows = wrapTextToLines('あ'.repeat(25), 10);
    expect(rows).toHaveLength(3);
    expect(rows.join('')).toBe('あ'.repeat(25));
  });

  test('a degenerate maxChars does not hang or throw', () => {
    expect(() => wrapTextToLines('abc', 0)).not.toThrow();
    expect(wrapTextToLines('abc', 0).join('')).toBe('abc');
  });
});

// Discrete paging, not continuous scrolling: text speed and movement mode are
// significant contributors to cybersickness in HMD reading, and *unexpected /
// uncontrolled* vection is the strongest predictor — so a user-initiated jump
// of a known size is the safer design.
describe('reader scroll affordance', () => {
  const {
    readerHitTest, pageJumpLines, PAGE_OVERLAP_LINES,
    ARROW_UP_X0, ARROW_DN_X0, ARROW_W, ARROW_H, ARROW_Y0
  } = require('../src/vr/browser/readerLayout.js');

  const mid = (x0) => x0 + ARROW_W / 2;
  const midY = ARROW_Y0 + ARROW_H / 2;

  test('a page jump keeps overlap so reading position survives', () => {
    expect(pageJumpLines(24)).toBe(24 - PAGE_OVERLAP_LINES);
    expect(PAGE_OVERLAP_LINES).toBeGreaterThan(0);
  });

  test('a jump never advances by zero or negative lines', () => {
    expect(pageJumpLines(1)).toBeGreaterThanOrEqual(1);
    expect(pageJumpLines(0)).toBeGreaterThanOrEqual(1);
  });

  test('the up and down arrow zones resolve distinctly', () => {
    expect(readerHitTest(mid(ARROW_UP_X0), midY, true).type).toBe('scrollUp');
    expect(readerHitTest(mid(ARROW_DN_X0), midY, true).type).toBe('scrollDown');
  });

  test('arrows are inert when the article fits on one screen', () => {
    expect(readerHitTest(mid(ARROW_DN_X0), midY, false).type).toBe('none');
  });

  test('a hit outside the arrow band is not a scroll', () => {
    expect(readerHitTest(mid(ARROW_DN_X0), ARROW_Y0 - 50, true).type).toBe('none');
    expect(readerHitTest(10, midY, true).type).toBe('none');
  });

  test('the two arrow zones do not overlap', () => {
    expect(ARROW_UP_X0 + ARROW_W).toBeLessThan(ARROW_DN_X0);
  });
});

// The em model (full-width 1.0, Latin 0.5) is an approximation of UAX #11.
// Measured against real Chromium + real CJK fonts (tools/measure-text-metrics.mjs):
// full-width advance is 1.012 em, Latin 0.458-0.496, monospace 0.602. So the
// model slightly UNDER-estimates full-width text, and any budget derived from
// pixel geometry with zero slack would overflow.
describe('WIDTH_SAFETY — budgets survive real font metrics', () => {
  const { safeMeasureEm, WIDTH_SAFETY } = require('../src/vr/ui/textWrap.js');
  const MEASURED_FULLWIDTH_EM = 1.012; // ground truth, see the tool

  test('reserves headroom rather than using the full box', () => {
    expect(WIDTH_SAFETY).toBeGreaterThan(0.8);
    expect(WIDTH_SAFETY).toBeLessThan(1);
    expect(safeMeasureEm(1000, 20)).toBeCloseTo(50 * WIDTH_SAFETY, 5);
  });

  test('the margin absorbs the measured 1.2% under-estimate', () => {
    const avail = 976, font = 66;                 // caption at the large-text scale
    const budget = safeMeasureEm(avail, font);
    expect(budget * font * MEASURED_FULLWIDTH_EM).toBeLessThanOrEqual(avail);
  });

  test('a naive budget (no margin) would NOT survive it', () => {
    const avail = 976, font = 66;
    expect((avail / font) * font * MEASURED_FULLWIDTH_EM).toBeGreaterThan(avail);
  });

  test('degenerate inputs stay safe', () => {
    expect(safeMeasureEm(0, 20)).toBe(0);
    expect(safeMeasureEm(-100, 20)).toBe(0);
    expect(Number.isFinite(safeMeasureEm(100, 0))).toBe(true);
  });
});

// ── Vertical layout: text must not run under the paging affordance ──────────
// Measured with real font metrics in headless Chromium: a sans-serif glyph box
// is ~1.10–1.14 em and CJK ink ~1.03–1.05 em, so a baseline at y carries ink
// from about y-0.95em to y+0.22em. `visibleLineCount` used to fill the whole
// content height, putting the last baseline at y=864 — ink to y=868, inside the
// arrow band that begins at y=854 — and the text column reaches x=976 while the
// arrows start at x=804, so a long final line rendered under the buttons.
describe('reader reserves the bottom strip for the arrows and progress label', () => {
  const {
    visibleLinesFor, visibleLineCount, CONTENT_BOTTOM_RESERVED,
    ARROW_Y0, ARROW_H, ARROW_UP_X0, CONTENT_PX_W, CONTENT_PX_H, CONTENT_PAD, LINE_H
  } = require('../src/vr/browser/readerLayout.js');

  const INK_ASCENT = 0.95;   // measured upper bound (em)
  const INK_DESCENT = 0.22;  // measured lower bound (em)
  const lastInkBottom = (scale, visible) => {
    const lh = LINE_H * scale;
    return CONTENT_PAD + lh * visible + fontPxFor('p', scale) * INK_DESCENT;
  };

  test.each([1, 1.3, 1.5, 2])(
    'at scale %s the last line clears the arrow band',
    (scale) => {
      const visible = visibleLinesFor(500, scale);
      expect(lastInkBottom(scale, visible)).toBeLessThan(ARROW_Y0);
    }
  );

  test.each([1, 1.3, 1.5, 2])(
    'at scale %s the UNRESERVED count would have collided (the defect)',
    (scale) => {
      const naive = visibleLineCount(scale, false);
      expect(lastInkBottom(scale, naive)).toBeGreaterThan(ARROW_Y0);
    }
  );

  test('the last line also clears the progress label', () => {
    for (const scale of [1, 1.3, 1.5, 2]) {
      const visible = visibleLinesFor(500, scale);
      const labelInkTop = (CONTENT_PX_H - 30) - 16 * INK_ASCENT;
      expect(lastInkBottom(scale, visible)).toBeLessThan(labelInkTop);
    }
  });

  test('the reserve covers the whole affordance band', () => {
    expect(CONTENT_BOTTOM_RESERVED).toBeGreaterThanOrEqual(CONTENT_PX_H - ARROW_Y0);
    // …and the arrows sit inside the text column horizontally, which is why a
    // vertical reserve is required rather than just narrowing the last line.
    expect(ARROW_UP_X0).toBeLessThan(CONTENT_PX_W - CONTENT_PAD);
    expect(ARROW_Y0 + ARROW_H).toBeLessThanOrEqual(CONTENT_PX_H);
  });

  test('an article that fits on one screen keeps the full height (no arrows drawn)', () => {
    // The reserve is conditional: with nothing to page through there is no
    // affordance to avoid, so short articles must not lose lines to it.
    const unreserved = visibleLineCount(1, false);
    expect(visibleLinesFor(unreserved, 1)).toBe(unreserved);
    expect(visibleLinesFor(1, 1)).toBe(unreserved);
    expect(visibleLinesFor(unreserved + 1, 1)).toBeLessThan(unreserved);
  });

  test('reserving only ever shrinks the count, so the two-step is stable', () => {
    for (const scale of [1, 1.3, 1.5, 2, 3]) {
      expect(visibleLineCount(scale, true)).toBeLessThanOrEqual(visibleLineCount(scale, false));
      expect(visibleLineCount(scale, true)).toBeGreaterThanOrEqual(1);
    }
  });
});
