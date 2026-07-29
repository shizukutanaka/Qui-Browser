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
  visibleLineCount, wrapCharsFor, fontPxFor
} = require('../src/vr/browser/readerLayout.js');
const { wrapTextToLines } = require('../src/vr/ui/textWrap.js');

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
  test('wraps prose to the character budget for the scale', () => {
    const long = 'word '.repeat(80).trim();
    const lines = layoutReaderLines([{ type: 'p', text: long }]);
    const max = wrapCharsFor(1);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) {
      expect(Array.from(l.text).length).toBeLessThanOrEqual(max);
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

  test('bigger scale wraps sooner (fewer chars per line)', () => {
    expect(wrapCharsFor(2)).toBeLessThan(wrapCharsFor(1));
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
