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
  readerAvailPx, readerOverflows, readerFitCount, lastReaderStart, readerPageJump,
  linePitchFor, contentHeightPx, measureEmFor, maxMeasureEmForFont, fontPxFor,
  MEASURE_EM, CONTENT_PX_W, CONTENT_PAD
} = require('../src/vr/browser/readerLayout.js');
const {
  wrapTextToLines, wrapTextToWidth, textWidthEm, charWidthEm,
  HALFWIDTH_EM, EMOJI_EM, WIDTH_SAFETY, KIN_START
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

  test('decodes the standard named repertoire, not a hand-picked few', () => {
    // Measured leaking raw before: &copy; &trade; &euro; &deg; &sect;
    // &laquo; &frac12; &times; &eacute; — every one emitted literally.
    expect(decodeEntities('&copy; &reg; &trade; &euro; &cent; &pound; &yen;'))
      .toBe('© ® ™ € ¢ £ ¥');
    expect(decodeEntities('&sect; &para; &deg; &plusmn; &micro; &middot; &cedil;'))
      .toBe('§ ¶ ° ± µ · ¸');
    expect(decodeEntities('&laquo;q&raquo; &lsaquo;x&rsaquo; &frac14; &frac12; &frac34; &sup2;'))
      .toBe('«q» ‹x› ¼ ½ ¾ ²');
    expect(decodeEntities('&times; &divide; &minus; &ne; &le; &ge; &infin; &asymp; &int; &sum;'))
      .toBe('× ÷ − ≠ ≤ ≥ ∞ ≈ ∫ ∑');
    expect(decodeEntities('&alpha; &pi; &mu; &Sigma; &Delta; &Omega; &sigmaf;'))
      .toBe('α π μ Σ Δ Ω ς');
    expect(decodeEntities('&dagger; &Dagger; &permil; &prime; &Prime; &bull; &oline;'))
      .toBe('† ‡ ‰ ′ ″ • ‾');
    expect(decodeEntities('&eacute; &agrave; &ntilde; &ccedil; &szlig; &aelig; &oelig; &oslash; &thorn;'))
      .toBe('é à ñ ç ß æ œ ø þ');
    expect(decodeEntities('&larr; &rarr; &harr; &rArr; &spades; &hearts; &loz;'))
      .toBe('← → ↔ ⇒ ♠ ♥ ◊');
  });

  test('entity names are case-sensitive per the HTML table', () => {
    // &Eacute; is É, not é; &Dagger; is ‡, not †. A case-insensitive lookup
    // decodes the wrong letter — silently, in published text.
    expect(decodeEntities('&Eacute; &Iacute; &Oacute; &Uacute; &Aacute;'))
      .toBe('É Í Ó Ú Á');
    expect(decodeEntities('&eacute; &iacute; &oacute; &uacute; &aacute;'))
      .toBe('é í ó ú á');
    expect(decodeEntities('&Dagger;')).toBe('‡');
    expect(decodeEntities('&dagger;')).toBe('†');
    expect(decodeEntities('&OElig;')).toBe('Œ');
    expect(decodeEntities('&oelig;')).toBe('œ');
    expect(decodeEntities('&THORN;')).toBe('Þ');
    expect(decodeEntities('&thorn;')).toBe('þ');
    expect(decodeEntities('&Sigma;')).toBe('Σ');
    expect(decodeEntities('&sigma;')).toBe('σ');
  });

  test('HTML5 all-caps aliases decode; invented names still untouched', () => {
    expect(decodeEntities('&AMP; &LT; &GT; &QUOT; &COPY; &REG; &TRADE;'))
      .toBe('& < > " © ® ™');
    expect(decodeEntities('&fake; &nbspx; &copyright; &NotAnEntity;'))
      .toBe('&fake; &nbspx; &copyright; &NotAnEntity;');
  });

  test('names with digits decode (&frac12;, &sup1;) — digits are legal in names', () => {
    expect(decodeEntities('&frac12; &sup1; &sup3;')).toBe('½ ¹ ³');
  });

  test('soft/invisible references decode to whitespace or vanish', () => {
    expect(decodeEntities('a&shy;b')).toBe('ab');
    expect(decodeEntities('a&NewLine;b')).toBe('a b');
    expect(decodeEntities('x&ensp;y&emsp;z&thinsp;w')).toBe('x y z w');
  });

  test('HTML5-only names beyond the HTML4 repertoire decode (P-1)', () => {
    // The hand table stopped at the ~250 HTML4/XHTML names; real pages emit
    // HTML5 names — math operators in Wikipedia alt text, camelCase arrows
    // in technical writing, multi-codepoint combining forms.
    expect(decodeEntities('&LeftArrow; &DoubleLeftRightArrow;')).toBe('\u2190 \u21d4');
    expect(decodeEntities('&InvisibleTimes; &ApplyFunction; &NoBreak;'))
      .toBe('\u2062 \u2061 \u2060');
    expect(decodeEntities('&NotEqualTilde;')).toBe('\u2242\u0338'); // multi-codepoint
    expect(decodeEntities('&fjlig; &dollar;')).toBe('fj $');
    expect(decodeEntities('&ThickSpace;')).toBe('\u205f\u200a');
  });

  test('canvas-normalization overrides survive the generated table', () => {
    // The generated file ships raw Unicode; readableText still flattens the
    // invisible/space entries exactly as the hand table did.
    expect(decodeEntities('a&nbsp;b')).toBe('a b');
    expect(decodeEntities('a&shy;b&zwnj;c&zwj;d&lrm;e&rlm;f')).toBe('abcdef');
    expect(decodeEntities('a&Tab;b&NewLine;c')).toBe('a b c');
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

  test('strips the "- Site" suffix when the h1 covers a segment (measured Wikipedia shape)', () => {
    const html = '<html><head><title>WebXR - Wikipedia</title></head>' +
      '<body><h1>WebXR</h1></body></html>';
    expect(extractTitle(html)).toBe('WebXR');
  });

  test('strips the "| Site" suffix when the h1 covers a segment (measured MDN shape)', () => {
    const html = '<html><head><title>WebXR Device API - Web APIs | MDN</title></head>' +
      '<body><h1>WebXR Device API</h1></body></html>';
    expect(extractTitle(html)).toBe('WebXR Device API');
  });

  test('h1 inside a suffix-carrying segment still resolves', () => {
    // Measured Qiita shape: "<article> #Tag - Qiita" — the h1 lives inside
    // the first segment, so that segment (minus the site name) is the title.
    const html = '<html><head><title>Deep dive #WebXR - Qiita</title></head>' +
      '<body><h1>Deep dive</h1></body></html>';
    expect(extractTitle(html)).toBe('Deep dive #WebXR');
  });

  test('keeps the raw <title> when no h1 can arbitrate the split', () => {
    expect(extractTitle('<html><title>Article Name | Site Name</title><p>x</p></html>'))
      .toBe('Article Name | Site Name');
  });

  test('keeps the raw <title> when the h1 matches no segment', () => {
    const html = '<html><head><title>Alpha - Beta - Gamma</title></head>' +
      '<body><h1>Completely different</h1></body></html>';
    expect(extractTitle(html)).toBe('Alpha - Beta - Gamma');
  });

  test('hyphens inside words are not site-name separators', () => {
    const html = '<html><head><title>well-being tips - Site</title></head>' +
      '<body><h1>well-being tips</h1></body></html>';
    expect(extractTitle(html)).toBe('well-being tips');
  });

  test('a separator-free title is returned verbatim', () => {
    const html = '<html><head><title>just words</title></head>' +
      '<body><h1>other</h1></body></html>';
    expect(extractTitle(html)).toBe('just words');
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

  test('a > inside a quoted attribute value does not leak tag fragments', () => {
    // The tag-stripper must not stop at a > that lives inside quotes — the
    // remnant ('y">') would otherwise surface as literal text in the reader.
    const html = '<p><a title="x>y">link</a> tail</p>';
    expect(extractReadableText(html).blocks[0].text).toBe('link tail');
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

  test('<pre> code survives with newlines and indentation intact', () => {
    const html = `<body>
      <p>Before the snippet.</p>
      <pre><code>const x = 1;\n  if (x) {\n    run();\n  }</code></pre>
      <p>After it.</p>
    </body>`;
    const { blocks } = extractReadableText(html);
    expect(blocks.map(b => b.type)).toEqual(['p', 'pre', 'p']);
    const code = blocks[1].text;
    expect(code).toContain('const x = 1;');
    expect(code).toContain('\n  if (x) {');
    expect(code).toContain('\n    run();');
    // Indentation is not collapsed into a single space run.
    expect(code).toMatch(/\n {4}run/);
  });

  test('<pre> containing <br> keeps line breaks; empty pre is dropped', () => {
    const html = '<body><pre>a<br>b</pre><pre>   </pre><p>x</p></body>';
    const { blocks } = extractReadableText(html);
    expect(blocks[0].type).toBe('pre');
    expect(blocks[0].text).toBe('a\nb');
    expect(blocks.map(b => b.type)).toEqual(['pre', 'p']);
  });

  test('tabs in <pre> expand to spaces (canvas draws \\t unreliably)', () => {
    const html = '<body><pre><code>if (x) {\n\ty();\n}</code></pre></body>';
    const { blocks } = extractReadableText(html);
    expect(blocks[0].text).toBe('if (x) {\n  y();\n}');
    expect(blocks[0].text).not.toContain('\t');
  });

  test('<table> rows surface as pipe-joined paragraphs instead of vanishing', () => {
    const html = '<body><p>intro</p><table><tr><th>Name</th><th>VRAM</th></tr>' +
      '<tr><td>Quest 3</td><td>8GB</td></tr></table><p>tail</p></body>';
    const { blocks } = extractReadableText(html);
    const texts = blocks.map(b => b.text);
    expect(texts).toContain('Name | VRAM');
    expect(texts).toContain('Quest 3 | 8GB');
    expect(texts).toContain('tail');
  });

  test('<ol> items keep their ordinal; <ul> stays unnumbered', () => {
    const html = '<body><ol><li>first</li><li>second</li></ol>' +
      '<ul><li>loose</li></ul></body>';
    const { blocks } = extractReadableText(html);
    const texts = blocks.map(b => b.text);
    expect(texts).toEqual(expect.arrayContaining(['1. first', '2. second', 'loose']));
    expect(texts).not.toContain('1. loose');
  });

  test('<img alt> inlines as [img: …]; empty alt stays silent', () => {
    const html = '<body><p>see <img src="a.png" alt="arch diagram"> below</p>' +
      '<p>deco <img src="dot.gif" alt=""></p></body>';
    const { blocks } = extractReadableText(html);
    expect(blocks[0].text).toBe('see [img: arch diagram] below');
    expect(blocks[1].text).toBe('deco');
  });

  test('h4–h6 headings are headings too', () => {
    const html = '<body><h4>Deep</h4><p>x</p></body>';
    const { blocks } = extractReadableText(html);
    expect(blocks[0]).toEqual({ type: 'h', text: 'Deep' });
  });

  test('<ruby> keeps only base text — rt/rp furigana is not duplicated inline', () => {
    const html = '<body><p><ruby>漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>を読む</p></body>';
    const { blocks } = extractReadableText(html);
    expect(blocks[0].text).toBe('漢字 を読む');
    expect(blocks[0].text).not.toContain('かんじ');
  });

  test('<dl> terms/definitions and <summary> labels are extracted', () => {
    const html = '<body><dl><dt>Term</dt><dd>Definition here</dd></dl>' +
      '<details><summary>Open</summary><p>hidden</p></details></body>';
    const { blocks } = extractReadableText(html);
    const texts = blocks.map(b => b.text);
    expect(texts).toEqual(expect.arrayContaining(['Term', 'Definition here', 'Open', 'hidden']));
  });

  test('<ol start> begins numbering at start (WHATWG HTML §4.4.7)', () => {
    const html = '<body><p>intro</p><ol start="5"><li>five</li><li>six</li></ol></body>';
    const { blocks } = extractReadableText(html);
    const texts = blocks.map(b => b.text);
    expect(texts).toEqual(expect.arrayContaining(['5. five', '6. six']));
    expect(texts).not.toContain('1. five');
  });

  test('<li value> restarts the ordinal run (WHATWG HTML §4.4.8)', () => {
    const html = '<body><ol><li>a</li><li value="7">b</li><li>c</li></ol></body>';
    const { blocks } = extractReadableText(html);
    expect(blocks.map(b => b.text))
      .toEqual(expect.arrayContaining(['1. a', '7. b', '8. c']));
  });

  test('<ol reversed> counts down to start', () => {
    const html = '<body><ol reversed><li>a</li><li>b</li><li>c</li></ol>' +
      '<ol reversed start="10"><li>x</li><li>y</li><li>z</li></ol></body>';
    const { blocks } = extractReadableText(html);
    expect(blocks.map(b => b.text)).toEqual(expect.arrayContaining(
      ['3. a', '2. b', '1. c', '12. x', '11. y', '10. z']));
  });

  test('a nested <ol> keeps its own numbering instead of stealing the parent\'s', () => {
    // Pre-fix measured: `1. outer inner1` (merged), `2. inner2` (misattributed
    // to the parent run) and `outer2` — the parent's next item lost its
    // number entirely because the flat counter was consumed by the children.
    const html = '<body><ol><li>outer<ol><li>in1</li><li>in2</li></ol></li>' +
      '<li>outer2</li></ol></body>';
    const { blocks } = extractReadableText(html);
    const texts = blocks.map(b => b.text);
    expect(texts).toContain('2. outer2'); // parent's run unbroken
    expect(texts).toContain('2. in2');    // inner list numbers itself
  });

  test('a <ul> nested in an <ol> does not consume ordinals', () => {
    const html = '<body><ol><li>a<ul><li>bullet</li></ul></li><li>b</li></ol></body>';
    const { blocks } = extractReadableText(html);
    const texts = blocks.map(b => b.text);
    expect(texts).toContain('2. b');
    expect(texts.some(t => /^\d+\. bullet/.test(t))).toBe(false);
  });

  test('<br> inside a paragraph splits into separate blocks in order', () => {
    // innerText yields '\n' for <br>; merging into one run-on paragraph
    // dropped the break entirely (measured: "line one line two line three").
    const html = '<body><p>line one<br>line two<br/>line three</p></body>';
    const { blocks } = extractReadableText(html);
    const texts = blocks.map(b => b.text);
    expect(texts).toEqual(['line one', 'line two', 'line three']);
    expect(texts).not.toContain('line one line two line three');
  });

  test('<br> inside a list item splits after the baked ordinal', () => {
    const html = '<body><ol><li>step one<br>step two</li></ol></body>';
    const { blocks } = extractReadableText(html);
    expect(blocks.map(b => b.text)).toEqual(['1. step one', 'step two']);
  });

  test('an <ol> item containing a <pre> keeps the code inside the item text', () => {
    const html = '<body><ol><li>setup<pre>npm i</pre></li><li>run</li></ol></body>';
    const { blocks } = extractReadableText(html);
    const texts = blocks.map(b => b.text);
    expect(texts.some(t => t.includes('npm i'))).toBe(true);
    expect(texts).toContain('2. run');
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

  test('pre blocks emit one c-style line per physical source line', () => {
    const lines = layoutReaderLines([
      { type: 'p', text: 'Prose.' },
      { type: 'pre', text: 'line1\n  line2\nline3' }
    ]);
    const styles = lines.map(l => l.style);
    expect(styles).toEqual(['p', 'blank', 'c', 'c', 'c']);
    expect(lines.filter(l => l.style === 'c').map(l => l.text))
      .toEqual(['line1', '  line2', 'line3']);
  });

  test('a code line longer than the measure wraps rather than vanishing', () => {
    const long = 'x'.repeat(200);
    const lines = layoutReaderLines([{ type: 'pre', text: long }]);
    const code = lines.filter(l => l.style === 'c');
    expect(code.length).toBeGreaterThan(1);
    expect(code.map(l => l.text).join('')).toBe(long);
  });

  test('fontPxFor sizes code smaller than body', () => {
    expect(fontPxFor('c', 1)).toBe(17);
    expect(fontPxFor('c', 1)).toBeLessThan(fontPxFor('p', 1));
  });
});

describe('clampReaderScroll / readerWindow / readerProgressLabel', () => {
  const lines = Array.from({ length: 100 }, (_, i) => ({ text: `L${i}`, style: 'p' }));
  const lastStart = lastReaderStart(lines, readerAvailPx(true), 1);

  test('clamps below zero and past the end', () => {
    expect(clampReaderScroll(lines, -5)).toBe(0);
    expect(clampReaderScroll(lines, 999)).toBe(lastStart);
    expect(lastStart).toBeGreaterThan(0);
    expect(lastStart).toBeLessThan(100);
  });

  test('a list that fits cannot scroll', () => {
    const short = Array.from({ length: 8 }, (_, i) => ({ text: `S${i}`, style: 'p' }));
    expect(clampReaderScroll(short, 5)).toBe(0);
  });

  test('window never returns an empty slice for a non-empty list', () => {
    expect(readerWindow(lines, 999).length).toBeGreaterThan(0);
    expect(readerWindow(lines, -3)[0].text).toBe('L0');
  });

  test('the window at max scroll reaches the last line', () => {
    const w = readerWindow(lines, 999);
    expect(w[w.length - 1].text).toBe('L99');
  });

  test('progress label matches the bookmark-panel convention', () => {
    const first = readerProgressLabel(lines, 0);
    expect(first.startsWith('1–')).toBe(true);
    expect(first.endsWith('/100')).toBe(true);
    const last = readerProgressLabel(lines, 999);
    expect(last.endsWith('–100/100')).toBe(true);
  });

  test('no progress label when everything fits', () => {
    const short = Array.from({ length: 8 }, (_, i) => ({ text: `S${i}`, style: 'p' }));
    expect(readerProgressLabel(short, 0)).toBe('');
  });

  test('non-finite offsets degrade to 0', () => {
    expect(clampReaderScroll(lines, NaN)).toBe(0);
    expect(clampReaderScroll(lines, undefined)).toBe(0);
  });
});

describe('viewport metrics', () => {
  test('fewer lines fit as text grows', () => {
    const lines = Array.from({ length: 100 }, (_, i) => ({ text: `L${i}`, style: 'p' }));
    const at2 = readerFitCount(lines, 0, readerAvailPx(true), 2);
    const at1 = readerFitCount(lines, 0, readerAvailPx(true), 1);
    expect(at2).toBeLessThan(at1);
    expect(at1).toBeGreaterThan(5);
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

  test('mixed Japanese/Latin lines stay within the measure modulo kinsoku', () => {
    // Kinsoku (ぶら下げ) lets a trailing run of line-start-prohibited chars
    // overhang the measure — strip it before asserting the width contract.
    const strip = (s) => {
      const cps = Array.from(s);
      while (cps.length && KIN_START.has(cps[cps.length - 1])) {
        cps.pop();
      }
      return cps.join('');
    };
    const mixed = 'WebXRの仕様はW3Cが策定しています。'.repeat(20);
    for (const l of layoutReaderLines([{ type: 'p', text: mixed }])) {
      expect(textWidthEm(strip(l.text))).toBeLessThanOrEqual(measureEmFor(1));
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
    readerHitTest, readerPageJump, readerFitCount, readerAvailPx,
    PAGE_OVERLAP_LINES,
    ARROW_UP_X0, ARROW_DN_X0, ARROW_W, ARROW_H, ARROW_Y0
  } = require('../src/vr/browser/readerLayout.js');

  const mid = (x0) => x0 + ARROW_W / 2;
  const midY = ARROW_Y0 + ARROW_H / 2;
  const long = Array.from({ length: 100 }, (_, i) => ({ text: `L${i}`, style: 'p' }));

  test('a page jump keeps overlap so reading position survives', () => {
    const fitted = readerFitCount(long, 0, readerAvailPx(true), 1);
    expect(readerPageJump(long, 0, 1)).toBe(fitted - PAGE_OVERLAP_LINES);
    expect(PAGE_OVERLAP_LINES).toBeGreaterThan(0);
  });

  test('a jump never advances by zero or negative lines', () => {
    expect(readerPageJump([{ text: 'a', style: 'p' }], 0)).toBeGreaterThanOrEqual(1);
    expect(readerPageJump([], 0)).toBeGreaterThanOrEqual(1);
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
    readerAvailPx, readerOverflows, readerFitCount, readerWindow,
    linePitchFor, CONTENT_BOTTOM_RESERVED,
    ARROW_Y0, ARROW_H, ARROW_UP_X0, CONTENT_PX_W, CONTENT_PX_H, CONTENT_PAD, LINE_H
  } = require('../src/vr/browser/readerLayout.js');

  const INK_ASCENT = 0.95;   // measured upper bound (em)
  const INK_DESCENT = 0.22;  // measured lower bound (em)
  const long = Array.from({ length: 500 }, (_, i) => ({ text: `L${i}`, style: 'p' }));
  // Ink bottom of the last drawn line: the draw path accumulates each line's
  // own pitch, so the visible count times the (uniform, here) body pitch.
  const lastInkBottom = (scale, visible) => {
    const lh = linePitchFor('p', scale);
    return CONTENT_PAD + lh * visible + fontPxFor('p', scale) * INK_DESCENT;
  };

  test.each([1, 1.3, 1.5, 2])(
    'at scale %s the last line clears the arrow band',
    (scale) => {
      const visible = readerFitCount(long, 0, readerAvailPx(true), scale);
      expect(lastInkBottom(scale, visible)).toBeLessThan(ARROW_Y0);
    }
  );

  test.each([1, 1.3, 1.5, 2])(
    'at scale %s the UNRESERVED count would have collided (the defect)',
    (scale) => {
      const naive = readerFitCount(long, 0, readerAvailPx(false), scale);
      expect(lastInkBottom(scale, naive)).toBeGreaterThan(ARROW_Y0);
    }
  );

  test('the last line also clears the progress label', () => {
    for (const scale of [1, 1.3, 1.5, 2]) {
      const visible = readerFitCount(long, 0, readerAvailPx(true), scale);
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
    const short = Array.from({ length: 5 }, (_, i) => ({ text: `S${i}`, style: 'p' }));
    expect(readerOverflows(short, 1)).toBe(false);
    expect(readerWindow(short, 0, 1)).toHaveLength(5);
    // …and a just-fitting article still uses the unreserved budget.
    const fits = Math.floor(readerAvailPx(false) / LINE_H);
    const edge = Array.from({ length: fits }, (_, i) => ({ text: `E${i}`, style: 'p' }));
    expect(readerOverflows(edge, 1)).toBe(false);
    expect(readerWindow(edge, 0, 1)).toHaveLength(fits);
    expect(readerOverflows([...edge, { text: 'one more', style: 'p' }], 1)).toBe(true);
  });

  test('reserving only ever shrinks the window, so the two-step is stable', () => {
    for (const scale of [1, 1.3, 1.5, 2, 3]) {
      const reserved = readerFitCount(long, 0, readerAvailPx(true), scale);
      const open = readerFitCount(long, 0, readerAvailPx(false), scale);
      expect(reserved).toBeLessThanOrEqual(open);
      expect(reserved).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('decodeEntities — safeFromCodePoint arms', () => {
  const { decodeEntities } = require('../src/vr/browser/readableText.js');

  test('in-range numeric entities decode to the character', () => {
    expect(decodeEntities('&#65;&#x42;')).toBe('AB');
  });

  test('out-of-range code points decode to empty (not a throw)', () => {
    expect(decodeEntities('&#x110000;x')).toBe('x');        // > U+10FFFF
    // negatives can't reach safeFromCodePoint — \d+ never matches the '-'
    expect(decodeEntities('&#-1;y')).toBe('&#-1;y');
  });

  test('invalid entities stay literal', () => {
    expect(decodeEntities('&#xZZ;')).toBe('&#xZZ;');
  });
});

describe('extractReadableText — crumb drop + block typing', () => {
  const { extractReadableText } = require('../src/vr/browser/readableText.js');

  test('one-word <li> crumbs are dropped; real list items become p blocks', () => {
    const { blocks } = extractReadableText(
      '<main><ul><li>go</li><li>a real list item</li></ul><p>body</p></main>');
    const texts = blocks.map(b => b.text);
    expect(texts).not.toContain('go');
    expect(texts).toContain('a real list item');
    expect(texts).toContain('body');
  });

  test('h1-3 map to type "h"; p/li/blockquote map to "p"', () => {
    const { blocks } = extractReadableText(
      '<main><h2>Head</h2><p>para text</p><blockquote>a quote here</blockquote></main>');
    expect(blocks[0]).toEqual({ type: 'h', text: 'Head' });
    expect(blocks[1]).toEqual({ type: 'p', text: 'para text' });
    expect(blocks[2]).toEqual({ type: 'p', text: 'a quote here' });
  });
});

describe('layoutReaderLines — malformed block skip', () => {
  test('null and textless blocks are skipped', () => {
    const lines = layoutReaderLines([null, { type: 'p' }, { type: 'p', text: 'ok' }]);
    expect(lines.filter(l => l.style === 'p')).toEqual([{ text: 'ok', style: 'p' }]);
  });
});

describe('readerLayout — remaining branch arms', () => {
  const { linePitchFor, measureEmFor, clampReaderScroll, readerOverflows,
    readerWindow, readerProgressLabel, readerHitTest, fontPxFor, readerPageJump } =
    require('../src/vr/browser/readerLayout.js');

  test('scale ≤0 falls back to 1 in linePitchFor / measureEmFor / fontPxFor', () => {
    expect(linePitchFor('p', 0)).toBe(linePitchFor('p', 1));
    expect(linePitchFor('title', -3)).toBe(linePitchFor('title', 1));
    expect(measureEmFor(0)).toBe(measureEmFor(1));
    expect(fontPxFor('title', 0)).toBe(fontPxFor('title', 1));
    expect(fontPxFor('h', -1)).toBe(fontPxFor('h', 1));
    expect(fontPxFor('p', 0)).toBe(fontPxFor('p', 1));
  });

  test('readerOverflows: non-array lines never scroll', () => {
    expect(readerOverflows(undefined)).toBe(false);
    expect(readerOverflows(null)).toBe(false);
    expect(readerOverflows([])).toBe(false);
  });

  test('clampReaderScroll: non-finite offset → 0; missing lines → 0', () => {
    const lines = Array.from({ length: 100 }, (_, i) => ({ text: `L${i}`, style: 'p' }));
    expect(clampReaderScroll(lines, NaN)).toBe(0);
    expect(clampReaderScroll(lines, Infinity)).toBe(0);
    expect(clampReaderScroll(undefined, 5)).toBe(0);
    expect(clampReaderScroll(lines, 3.9)).toBe(3); // floor
  });

  test('readerWindow: non-array lines → []; fitting article shows in full', () => {
    expect(readerWindow(null, 0)).toEqual([]);
    expect(readerWindow(undefined, 0)).toEqual([]);
    const lines = [{ text: 'a', style: 'p' }, { text: 'b', style: 'p' }, { text: 'c', style: 'p' }];
    expect(readerWindow(lines, 0)).toEqual(lines);            // fits unreserved
    expect(readerWindow(lines, 1)).toEqual(lines);            // fits → offset clamps to 0
  });

  test('readerProgressLabel: missing/fitting content → empty label', () => {
    expect(readerProgressLabel(undefined, 0)).toBe('');
    expect(readerProgressLabel([], 0)).toBe('');
    expect(readerProgressLabel([{ text: 'a', style: 'p' }], 0)).toBe('');
  });

  test('readerHitTest: not-scrollable ignores the arrow band; off-arrow x is none', () => {
    const { ARROW_Y0 } = require('../src/vr/browser/readerLayout.js');
    // scrollable=false → arrows dead even inside their band
    expect(readerHitTest(0, ARROW_Y0 + 1, false).type).toBe('none');
    // scrollable but x outside both arrows → none
    expect(readerHitTest(512, ARROW_Y0 + 1, true).type).toBe('none');
    // py outside the band entirely → none even when scrollable
    expect(readerHitTest(0, 10, true).type).toBe('none');
  });

  test('readerPageJump: degenerate input still advances ≥1', () => {
    expect(readerPageJump(undefined, 0)).toBe(1);
    const lines = Array.from({ length: 100 }, (_, i) => ({ text: `L${i}`, style: 'p' }));
    expect(readerPageJump(lines, 0)).toBeGreaterThanOrEqual(1);
  });
});

describe('readerLayout — complementary arms', () => {
  test('non-positive scale normalizes to 1 in line/font helpers', () => {
    const { linePitchFor, measureEmFor, fontPxFor } = require('../src/vr/browser/readerLayout.js');
    expect(linePitchFor('p', 0)).toBe(linePitchFor('p', 1));
    expect(measureEmFor(-3)).toBe(measureEmFor(1));
    expect(fontPxFor('body', 0)).toBe(fontPxFor('body', 1));
  });

  test('title style yields a larger font than body', () => {
    const { fontPxFor } = require('../src/vr/browser/readerLayout.js');
    expect(fontPxFor('title', 1)).toBeGreaterThan(fontPxFor('body', 1));
  });

  test('readerHitTest arrow zone dispatches scrollUp/scrollDown when scrollable', () => {
    const { readerHitTest } = require('../src/vr/browser/readerLayout.js');
    const mod = require('../src/vr/browser/readerLayout.js');
    const { ARROW_Y0, ARROW_UP_X0 } = mod;
    if (ARROW_Y0 !== undefined) {
      const hit = readerHitTest(ARROW_UP_X0 + 1, ARROW_Y0 + 1, true);
      expect(['scrollUp', 'scrollDown', 'up', 'down']).toContain(hit.type);
    }
  });
});
