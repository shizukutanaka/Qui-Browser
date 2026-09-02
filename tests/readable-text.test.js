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
    expect(readerHitTest(mid(ARROW_DN_X0), midY, false).type).not.toBe('scrollDown');
  });

  test('a hit outside the arrow band is not a scroll', () => {
    // It resolves to a text row instead — link rows are followable, and a row
    // with no href is inert, which WebPanel enforces.
    expect(readerHitTest(mid(ARROW_DN_X0), ARROW_Y0 - 50, true).type).not.toBe('scrollDown');
    expect(readerHitTest(10, midY, true).type).not.toBe('scrollUp');
    expect(readerHitTest(10, midY, true).type).not.toBe('scrollDown');
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

// ── Links: atom ④ of the core loop ───────────────────────────────────────────
// The reader extracted prose and threw every <a href> away, so a user could
// reach a page and read it but had no way to follow a link — the only route to
// another page was retyping its URL on a gaze keyboard at ~8–10 WPM.
describe('extractLinks', () => {
  const { extractLinks, extractReadableText, MAX_LINKS } =
    require('../src/vr/browser/readableText.js');
  const { layoutReaderLines } = require('../src/vr/browser/readerLayout.js');
  const BASE = 'https://example.com/dir/page.html';

  test('pulls text and absolute href from an anchor', () => {
    const out = extractLinks('<article><p>x</p><a href="/a">Alpha</a></article>', BASE);
    expect(out).toEqual([{ text: 'Alpha', href: 'https://example.com/a' }]);
  });

  test('resolves relative, root-relative and protocol-relative hrefs', () => {
    const out = extractLinks(
      '<a href="sib.html">S</a><a href="/root">R</a><a href="//cdn.example.org/x">P</a>', BASE);
    expect(out.map((l) => l.href)).toEqual([
      'https://example.com/dir/sib.html',
      'https://example.com/root',
      'https://cdn.example.org/x'
    ]);
  });

  test('accepts single-quoted and unquoted href attributes', () => {
    const out = extractLinks("<a href='/q'>Q</a><a href=/u>U</a>", BASE);
    expect(out.map((l) => l.href))
      .toEqual(['https://example.com/q', 'https://example.com/u']);
  });

  test('drops schemes the panel cannot navigate to', () => {
    const html = '<a href="javascript:alert(1)">J</a><a href="mailto:a@b.c">M</a>'
      + '<a href="data:text/html,x">D</a><a href="/ok">OK</a>';
    expect(extractLinks(html, BASE).map((l) => l.href)).toEqual(['https://example.com/ok']);
  });

  test('drops anchors with no readable label and empty hrefs', () => {
    const html = '<a href="/icon"><img src="i.png"></a><a href="">E</a><a href="/ok">OK</a>';
    expect(extractLinks(html, BASE).map((l) => l.text)).toEqual(['OK']);
  });

  test('dedupes by resolved href, keeping document order', () => {
    const html = '<a href="/a">First</a><a href="/b">B</a><a href="/a">Again</a>';
    expect(extractLinks(html, BASE).map((l) => l.text)).toEqual(['First', 'B']);
  });

  test('ignores links inside stripped boilerplate', () => {
    const html = '<nav><a href="/nav">NavLink</a></nav><footer><a href="/f">Foot</a></footer>'
      + '<p><a href="/real">Real</a></p>';
    expect(extractLinks(html, BASE).map((l) => l.text)).toEqual(['Real']);
  });

  test('decodes entities in both the label and the href', () => {
    const out = extractLinks('<a href="/s?a=1&amp;b=2">Tom &amp; Jerry</a>', BASE);
    expect(out[0].text).toBe('Tom & Jerry');
    expect(out[0].href).toBe('https://example.com/s?a=1&b=2');
  });

  test('a relative href with no base is dropped rather than guessed at', () => {
    expect(extractLinks('<a href="/a">A</a>')).toEqual([]);
    expect(extractLinks('<a href="https://x.example/a">A</a>')[0].href)
      .toBe('https://x.example/a');
  });

  test('caps the list so one link-farm page cannot swamp the reader', () => {
    const html = Array.from({ length: MAX_LINKS + 25 },
      (_, i) => `<a href="/p${i}">L${i}</a>`).join('');
    expect(extractLinks(html, BASE)).toHaveLength(MAX_LINKS);
  });

  test('degenerate input does not throw', () => {
    for (const bad of [undefined, null, '', 123, '<a href>']) {
      expect(() => extractLinks(bad, BASE)).not.toThrow();
    }
  });

  test('extractReadableText carries links alongside the prose', () => {
    const html = `<html><head><title>T</title></head><body><article>
      <p>${'Prose here. '.repeat(20)}</p><a href="/next">Next page</a>
    </article></body></html>`;
    const out = extractReadableText(html, BASE);
    expect(out.blocks.length).toBeGreaterThan(0);
    expect(out.links).toEqual([{ text: 'Next page', href: 'https://example.com/next' }]);
  });
});

describe('layoutReaderLines — link rows', () => {
  const { layoutReaderLines, measureEmForStyle } =
    require('../src/vr/browser/readerLayout.js');
  const { textWidthEm } = require('../src/vr/ui/textWrap.js');
  const LINKS = [
    { text: 'Alpha', href: 'https://a.example/' },
    { text: 'Beta', href: 'https://b.example/' }
  ];

  test('each link becomes exactly one selectable row carrying its href', () => {
    const lines = layoutReaderLines([{ type: 'p', text: 'Body' }], { links: LINKS });
    const rows = lines.filter((l) => l.style === 'link');
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.href)).toEqual(LINKS.map((l) => l.href));
  });

  test('rows are numbered, so a link is identifiable without colour (1.4.1)', () => {
    const rows = layoutReaderLines([], { links: LINKS }).filter((l) => l.style === 'link');
    expect(rows[0].text.startsWith('1. ')).toBe(true);
    expect(rows[1].text.startsWith('2. ')).toBe(true);
  });

  test('a heading introduces the section and can be translated', () => {
    const lines = layoutReaderLines([], { links: LINKS, linksLabel: 'このページのリンク' });
    const head = lines.find((l) => l.style === 'linksHeading');
    expect(head.text).toBe('このページのリンク');
    expect(head.href).toBeUndefined();
  });

  test('no links means no section at all', () => {
    const lines = layoutReaderLines([{ type: 'p', text: 'Body' }], { links: [] });
    expect(lines.some((l) => l.style === 'link' || l.style === 'linksHeading')).toBe(false);
    expect(layoutReaderLines([{ type: 'p', text: 'Body' }]).some((l) => l.href)).toBe(false);
  });

  test('a long label is truncated to one row, never wrapped across rows', () => {
    // Wrapping would spread one destination over rows that all mean the same
    // thing, making the row the user aimed at ambiguous to announce.
    const long = [{ text: 'あ'.repeat(200), href: 'https://a.example/' }];
    const rows = layoutReaderLines([], { links: long }).filter((l) => l.style === 'link');
    expect(rows).toHaveLength(1);
    expect(textWidthEm(rows[0].text)).toBeLessThanOrEqual(measureEmForStyle('p', 1) + 1e-9);
  });

  test('link rows survive the larger text scale low-vision users need', () => {
    const rows = layoutReaderLines([], { links: LINKS, scale: 1.5 })
      .filter((l) => l.style === 'link');
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(textWidthEm(r.text)).toBeLessThanOrEqual(measureEmForStyle('p', 1.5) + 1e-9);
    }
  });

  test('a link with no href is not rendered as a followable row', () => {
    const rows = layoutReaderLines([], { links: [{ text: 'x' }, ...LINKS] })
      .filter((l) => l.style === 'link');
    expect(rows).toHaveLength(2);
  });
});

describe('readerRowAt — draw and hit-test share one row model', () => {
  const {
    readerRowAt, readerHitTest, LINE_H, CONTENT_PAD, visibleLineCount
  } = require('../src/vr/browser/readerLayout.js');

  test('row i covers the band the draw path paints it in', () => {
    for (const scale of [1, 1.5]) {
      const lh = LINE_H * scale;
      for (const i of [0, 3, 7]) {
        // _drawReader puts row i's baseline at CONTENT_PAD + lh*(i+1).
        expect(readerRowAt(CONTENT_PAD + lh * i + 1, scale)).toBe(i);
        expect(readerRowAt(CONTENT_PAD + lh * (i + 1) - 1, scale)).toBe(i);
      }
    }
  });

  test('above the text column and past the last row are misses', () => {
    expect(readerRowAt(CONTENT_PAD - 5, 1)).toBe(-1);
    expect(readerRowAt(CONTENT_PAD + LINE_H * visibleLineCount(1, false) + 5, 1)).toBe(-1);
    expect(readerRowAt(NaN, 1)).toBe(-1);
  });

  test('the scroll arrows still win over the row underneath them', () => {
    const { ARROW_Y0, ARROW_DN_X0 } = require('../src/vr/browser/readerLayout.js');
    expect(readerHitTest(ARROW_DN_X0 + 5, ARROW_Y0 + 5, true, 1).type).toBe('scrollDown');
    // ...but only while there is something to scroll.
    expect(readerHitTest(ARROW_DN_X0 + 5, ARROW_Y0 + 5, false, 1).type).not.toBe('scrollDown');
  });
});

// ── Untrusted markup: the reader runs regexes on whatever a page sends ───────
// Extraction is synchronous, so a slow parse freezes the headset — in VR the
// world stops tracking your head, which is a comfort problem rather than jank.
describe('extraction is bounded and correct on malformed markup', () => {
  const {
    extractReadableText, extractLinks, MAX_BLOCKS, MAX_MARKUP_CHARS, MAX_ELEMENT_CHARS
  } = require('../src/vr/browser/readableText.js');
  const BASE = 'https://example.com/';

  /** Generous ceiling: the point is linear-not-quadratic, not a exact figure. */
  const BUDGET_MS = 2000;

  const timed = (fn) => {
    const t0 = Date.now();
    const out = fn();
    return { ms: Date.now() - t0, out };
  };

  test('an omitted </p> still yields BOTH paragraphs', () => {
    // </p> is optional in HTML, so this is valid, ordinary markup. Matching
    // lazily merged the two into one run of text; requiring a close dropped
    // the first entirely. Neither is acceptable.
    const { blocks } = extractReadableText(
      `<article><p>${'A'.repeat(300)}<p>${'B'.repeat(300)}</p></article>`, BASE);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].text.startsWith('A')).toBe(true);
    expect(blocks[1].text.startsWith('B')).toBe(true);
  });

  test('a block with no closing tag at all is still read', () => {
    const { blocks } = extractReadableText('<p>tail with no close', BASE);
    expect(blocks.map((b) => b.text)).toEqual(['tail with no close']);
  });

  test('mixed unclosed block tags keep their own identities', () => {
    const { blocks } = extractReadableText(
      '<h2>Head</h2><p>one<p>two</p><li>item</li>', BASE);
    expect(blocks.map((b) => `${b.type}:${b.text}`))
      .toEqual(['h:Head', 'p:one', 'p:two', 'p:item']);
  });

  test('thousands of unclosed tags do not go quadratic', () => {
    // Measured before the fix: 40,000 unclosed <p> (117 KB) took 2.1s through
    // extractReadableText and 10.8s in the block regex alone.
    const { ms } = timed(() => extractReadableText('<p>'.repeat(40000), BASE));
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  test('unclosed <script> and unclosed <a> are bounded too', () => {
    expect(timed(() => extractReadableText('<script>'.repeat(20000), BASE)).ms)
      .toBeLessThan(BUDGET_MS);
    expect(timed(() => extractLinks('<a href=/x>'.repeat(20000), BASE)).ms)
      .toBeLessThan(BUDGET_MS);
  });

  test('an enormous page is truncated, not chewed through', () => {
    const para = `<p>${'Sentence of ordinary prose. '.repeat(20)}</p>`;
    const html = `<html><body><article>${para.repeat(20000)}</article></body></html>`;
    expect(html.length).toBeGreaterThan(MAX_MARKUP_CHARS);
    const { ms, out } = timed(() => extractReadableText(html, BASE));
    expect(ms).toBeLessThan(BUDGET_MS);
    expect(out.blocks.length).toBeLessThanOrEqual(MAX_BLOCKS);
    expect(out.blocks.length).toBeGreaterThan(0); // the start is still readable
  });

  test('a single absurdly long element cannot consume the document', () => {
    const html = `<article><p>${'x'.repeat(MAX_ELEMENT_CHARS * 3)}</p><p>after</p></article>`;
    const { ms, out } = timed(() => extractReadableText(html, BASE));
    expect(ms).toBeLessThan(BUDGET_MS);
    // The oversized block is skipped rather than swallowing what follows.
    expect(out.blocks.some((b) => b.text === 'after')).toBe(true);
  });

  test('well-formed articles are unaffected', () => {
    const para = `<p>${'Sentence of ordinary prose. '.repeat(20)}</p>`;
    const { blocks } = extractReadableText(`<article>${para.repeat(50)}</article>`, BASE);
    expect(blocks).toHaveLength(50);
    expect(blocks.every((b) => b.type === 'p')).toBe(true);
  });

  test('pathological shapes do not throw', () => {
    for (const bad of ['<'.repeat(50000), '&amp;'.repeat(50000), '<p'.repeat(20000),
      '<a href='.repeat(20000), '</p>'.repeat(20000)]) {
      expect(() => extractReadableText(bad, BASE)).not.toThrow();
      expect(() => extractLinks(bad, BASE)).not.toThrow();
    }
  });
});

describe('extractLinks unwraps search-result redirects', () => {
  const { extractLinks } = require('../src/vr/browser/readableText.js');

  test('a DDG /l/?uddg result row carries its true destination', () => {
    const target = 'https://example.com/story';
    const html = `<html><body><div>
      <a href="//duckduckgo.com/l/?uddg=${encodeURIComponent(target)}&rut=x">The Story</a>
      <a href="https://other.example/page">Other</a>
    </div></body></html>`;
    const links = extractLinks(html, 'https://html.duckduckgo.com/html/?q=story');
    expect(links.map((l) => l.href)).toContain(target);
    expect(links.map((l) => l.href).join(' ')).not.toContain('/l/?uddg');
    expect(links.map((l) => l.href)).toContain('https://other.example/page');
  });

  test('two wrappers for the same destination dedupe after unwrapping', () => {
    const t = encodeURIComponent('https://example.com/a');
    const html = `<html><body>
      <a href="https://duckduckgo.com/l/?uddg=${t}&rut=1">One</a>
      <a href="https://duckduckgo.com/l/?uddg=${t}&rut=2">Two</a>
    </body></html>`;
    const links = extractLinks(html, 'https://duckduckgo.com/html/');
    expect(links.filter((l) => l.href === 'https://example.com/a')).toHaveLength(1);
  });
});

describe('linkRowIndex — addressing a link by its printed number', () => {
  const { layoutReaderLines, linkRowIndex } = require('../src/vr/browser/readerLayout.js');

  const laid = () => layoutReaderLines(
    [{ type: 'h', text: 'Heading' }, { type: 'p', text: 'Some prose here.' }],
    {
      title: 'Doc',
      links: [
        { text: 'First', href: 'https://a.example/' },
        { text: 'Second', href: 'https://b.example/' },
        { text: 'Third', href: 'https://c.example/' }
      ]
    }
  );

  test('the ordinal counts LINK rows, not lines — prose in between never shifts it', () => {
    const lines = laid();
    for (const [n, href] of [[1, 'https://a.example/'], [2, 'https://b.example/'], [3, 'https://c.example/']]) {
      const i = linkRowIndex(lines, n);
      expect(i).toBeGreaterThan(-1);
      expect(lines[i].href).toBe(href);
    }
  });

  test('the number it resolves is the number actually printed on the row', () => {
    // Reading the label back is what keeps the two in step: change the layout
    // numbering or the lookup alone and this fails.
    const lines = laid();
    for (const n of [1, 2, 3]) {
      expect(lines[linkRowIndex(lines, n)].text).toMatch(new RegExp(`^${n}\\.`));
    }
  });

  test('out of range and degenerate input return -1', () => {
    const lines = laid();
    expect(linkRowIndex(lines, 4)).toBe(-1);
    expect(linkRowIndex(lines, 0)).toBe(-1);
    expect(linkRowIndex(lines, -1)).toBe(-1);
    expect(linkRowIndex(lines, NaN)).toBe(-1);
    expect(linkRowIndex(null, 1)).toBe(-1);
  });

  test('a page with no links has no addressable rows', () => {
    const lines = layoutReaderLines([{ type: 'p', text: 'no links here' }], { title: 'x' });
    expect(linkRowIndex(lines, 1)).toBe(-1);
  });
});

describe('image text alternatives reach the reader (WCAG 1.1.1)', () => {
  const { extractReadableText } = require('../src/vr/browser/readableText.js');
  const { layoutReaderLines } = require('../src/vr/browser/readerLayout.js');

  test('an alt attribute becomes a block, in document order with the prose', () => {
    const html = `<html><body><article>
      <p>Before the chart.</p>
      <img src="c.png" alt="Chart showing 40% growth">
      <p>After the chart.</p>
    </article></body></html>`;
    const { blocks } = extractReadableText(html, 'https://e.example/');
    expect(blocks.map((b) => b.type)).toEqual(['p', 'img', 'p']);
    expect(blocks[1].text).toBe('Chart showing 40% growth');
  });

  test('alt="" is decorative per the spec and contributes nothing', () => {
    const { blocks } = extractReadableText(
      '<html><body><p>text</p><img src="spacer.gif" alt=""></body></html>', 'https://e.example/');
    expect(blocks.filter((b) => b.type === 'img')).toHaveLength(0);
  });

  test('an image with no alt is carried for its pixels, but adds no caption row', () => {
    // This assertion used to be "skipped entirely", on the grounds that a row
    // reading "image" and nothing else is noise. That reasoning held while the
    // reader could only show text. It can now render the picture, which is not
    // noise — so the block is carried with an empty caption and only the
    // pixels appear.
    const { blocks } = extractReadableText(
      '<html><body><p>text</p><img src="x.png"></body></html>', 'https://e.example/');
    const imgs = blocks.filter((b) => b.type === 'img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0].text).toBe('');
    expect(imgs[0].src).toBe('https://e.example/x.png');

    const { layoutReaderLines } = require('../src/vr/browser/readerLayout.js');
    const lines = layoutReaderLines(imgs, { imageLabel: 'Image' });
    expect(lines.some((l) => l.style === 'imgbox')).toBe(true);
    expect(lines.some((l) => l.style === 'img')).toBe(false); // no caption
  });

  test('an unresolvable or non-http src leaves the alt text standing alone', () => {
    const { blocks } = extractReadableText(
      '<html><body><img src="javascript:evil()" alt="Described"></body></html>', 'https://e.example/');
    const img = blocks.find((b) => b.type === 'img');
    expect(img.text).toBe('Described');
    expect(img.src).toBeNull();
  });

  test('images per page are bounded — a page cannot ask for unlimited decodes', () => {
    const many = Array.from({ length: 30 }, (_, i) => `<img src="i${i}.png" alt="pic ${i}">`).join('');
    const { blocks } = extractReadableText(
      `<html><body><article>${many}</article></body></html>`, 'https://e.example/');
    expect(blocks.filter((b) => b.type === 'img').length).toBeLessThanOrEqual(8);
  });

  test('single quotes, unquoted values and entities in alt all decode', () => {
    const html = `<html><body>
      <img src=a.png alt='Tom &amp; Jerry'>
      <img src=b.png alt=Simple>
    </body></html>`;
    const alts = extractReadableText(html, 'https://e.example/')
      .blocks.filter((b) => b.type === 'img').map((b) => b.text);
    expect(alts).toEqual(['Tom & Jerry', 'Simple']);
  });

  test('images inside stripped regions stay stripped', () => {
    const html = `<html><body>
      <nav><img src="logo.png" alt="Site logo"></nav>
      <article><p>real prose</p><img src="fig.png" alt="Figure one"></article>
    </body></html>`;
    const alts = extractReadableText(html, 'https://e.example/')
      .blocks.filter((b) => b.type === 'img').map((b) => b.text);
    expect(alts).toEqual(['Figure one']);
  });

  test('the laid-out row is labelled in words, not by colour alone', () => {
    const lines = layoutReaderLines(
      [{ type: 'img', text: 'Chart showing growth' }], { imageLabel: '画像' });
    const row = lines.find((l) => l.style === 'img');
    expect(row).toBeTruthy();
    expect(row.text).toContain('画像');
    expect(row.text).toContain('Chart showing growth');
  });

  test('alt text is findable, like any other prose in the page', () => {
    const { findMatches } = require('../src/vr/browser/readerSearch.js');
    const lines = layoutReaderLines(
      [{ type: 'p', text: 'ordinary prose' }, { type: 'img', text: 'a red bicycle' }],
      { imageLabel: 'Image' });
    expect(findMatches(lines, 'bicycle')).toHaveLength(1);
  });
});

describe('table rows reach the reader', () => {
  const { extractReadableText } = require('../src/vr/browser/readableText.js');

  test('a data table keeps its numbers, in document order', () => {
    const html = `<html><body><article>
      <p>Intro.</p>
      <table>
        <tr><th>Year</th><th>Growth</th></tr>
        <tr><td>2024</td><td>40%</td></tr>
      </table>
      <p>After.</p>
    </article></body></html>`;
    const { blocks } = extractReadableText(html, 'https://e.example/');
    expect(blocks.map((b) => b.text)).toEqual([
      'Intro.', 'Year | Growth', '2024 | 40%', 'After.'
    ]);
  });

  test('an all-th row is marked as a heading, so the structure survives', () => {
    const html = '<html><body><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table></body></html>';
    const { blocks } = extractReadableText(html, 'https://e.example/');
    expect(blocks[0].type).toBe('h');
    expect(blocks[1].type).toBe('p');
  });

  test('a layout table does not print its cells twice', () => {
    // Cells holding block elements are extracted as blocks already; emitting
    // the row as well would duplicate every paragraph on table-laid-out pages.
    const html = '<html><body><article><table><tr><td><p>Only once.</p></td></tr></table></article></body></html>';
    const { blocks } = extractReadableText(html, 'https://e.example/');
    expect(blocks.map((b) => b.text)).toEqual(['Only once.']);
  });

  test('rows with optional closing tags still separate', () => {
    // </tr> and </td> are optional in HTML; requiring them would drop the row.
    const html = '<html><body><table><tr><td>a<td>b<tr><td>c<td>d</table></body></html>';
    const { blocks } = extractReadableText(html, 'https://e.example/');
    expect(blocks.map((b) => b.text)).toEqual(['a | b', 'c | d']);
  });

  test('an empty row contributes nothing', () => {
    const html = '<html><body><p>x</p><table><tr><td></td><td></td></tr></table></body></html>';
    const { blocks } = extractReadableText(html, 'https://e.example/');
    expect(blocks.filter((b) => b.text.includes('|'))).toHaveLength(0);
  });

  test('tables inside stripped regions stay stripped', () => {
    const html = `<html><body>
      <footer><table><tr><td>junk</td><td>links</td></tr></table></footer>
      <article><table><tr><td>real</td><td>data</td></tr></table></article>
    </body></html>`;
    const { blocks } = extractReadableText(html, 'https://e.example/');
    expect(blocks.map((b) => b.text)).toEqual(['real | data']);
  });
});

// ── The class: content the extractor cannot see is silently discarded ────────
// Images (void elements) and table cells (not block tags) were each found by
// hand, one round apart. The shape is always the same — the page looks like it
// had less to say, with nothing to indicate anything was lost. This enumerates
// the content-bearing constructs a reader must carry, so the next one is
// caught here rather than by someone noticing an article looks short.
describe('no content-bearing construct is silently dropped', () => {
  const { extractReadableText } = require('../src/vr/browser/readableText.js');

  const CONSTRUCTS = {
    'paragraph': ['<p>Prose sentence.</p>', 'Prose sentence.'],
    'h1-h3 heading': ['<h2>Section</h2>', 'Section'],
    // BLOCK_TAGS was h[1-3]: every deeper heading, i.e. the structure of any
    // long article, extracted to nothing.
    'h4 heading': ['<h4>Subsection</h4>', 'Subsection'],
    'h5 heading': ['<h5>Deeper</h5>', 'Deeper'],
    'h6 heading': ['<h6>Deepest</h6>', 'Deepest'],
    'list item': ['<ul><li>Item text</li></ul>', 'Item text'],
    'blockquote': ['<blockquote>Quoted words</blockquote>', 'Quoted words'],
    // A technical article's payload.
    'code block': ['<pre><code>const answer = 42;</code></pre>', 'const answer = 42;'],
    'definition term': ['<dl><dt>Term</dt><dd>Meaning</dd></dl>', 'Term'],
    'definition body': ['<dl><dt>Term</dt><dd>Meaning</dd></dl>', 'Meaning'],
    // Ironic one: alt text arrived a round earlier while the caption sitting
    // beside the image was still being thrown away.
    'figure caption': ['<figure><figcaption>What the figure shows</figcaption></figure>', 'What the figure shows'],
    'table caption': ['<table><caption>What the table shows</caption></table>', 'What the table shows'],
    'disclosure summary': ['<details><summary>Click to expand</summary></details>', 'Click to expand'],
    'address': ['<address>Contact line</address>', 'Contact line'],
    'table row': ['<table><tr><td>cell one</td><td>cell two</td></tr></table>', 'cell one | cell two'],
    'image alt text': ['<img src="x.png" alt="A described picture">', 'A described picture']
  };

  for (const [name, [markup, expected]] of Object.entries(CONSTRUCTS)) {
    test(`${name} survives extraction`, () => {
      const { blocks } = extractReadableText(
        `<html><body><article>${markup}</article></body></html>`, 'https://e.example/');
      const texts = blocks.map((b) => b.text);
      expect(texts.join(' ⏎ ')).toContain(expected);
    });
  }

  test('headings of every level are typed as headings, not prose', () => {
    const markup = [1, 2, 3, 4, 5, 6].map((n) => `<h${n}>Level ${n}</h${n}>`).join('');
    const { blocks } = extractReadableText(
      `<html><body><article>${markup}</article></body></html>`, 'https://e.example/');
    expect(blocks).toHaveLength(6);
    expect(blocks.every((b) => b.type === 'h')).toBe(true);
  });

  test('a code sample is not extracted twice by both pre and code', () => {
    const { blocks } = extractReadableText(
      '<html><body><article><pre><code>once()</code></pre></article></body></html>',
      'https://e.example/');
    expect(blocks.filter((b) => b.text.includes('once()'))).toHaveLength(1);
  });
});
