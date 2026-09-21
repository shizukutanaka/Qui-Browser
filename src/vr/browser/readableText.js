/**
 * Reader-mode text extraction: HTML → readable blocks.
 *
 * ## Why this exists
 *
 * A WebXR **web app** cannot composite cross-origin page pixels into a 3D
 * texture (X-Frame-Options / CSP `frame-ancestors` refuse framing outright,
 * and a framed document's pixels are not readable into WebGL). So the panel
 * cannot show a page the way a native browser does — see `docs/SPEC.md`
 * FR-1.1. What it *can* do is fetch the markup and render the readable text
 * itself, which is also the shape VR is genuinely good at: a large, calm,
 * high-contrast reading surface with adjustable text size.
 *
 * ## What this is (and is not)
 *
 * This is a **reader heuristic, not an HTML parser**. It is regex-based and
 * deliberately dependency-free: no jsdom/cheerio is installed, and Jest runs
 * under `testEnvironment: 'node'` where `DOMParser` does not exist, so a pure
 * string implementation is the only thing that stays headlessly testable —
 * which is this repository's standing discipline for logic that canvas
 * rendering depends on.
 *
 * It will not perfectly handle every document (nested/malformed markup,
 * script-injected content, or single-page apps that ship an empty shell). It
 * aims to be *useful and honest*: pull the article text when the markup
 * carries it, and return nothing rather than garbage when it does not.
 */

/** Elements whose contents are never reader text. */
const STRIP_ELEMENTS = [
  'script', 'style', 'noscript', 'template', 'svg', 'canvas',
  'nav', 'header', 'footer', 'aside', 'form', 'iframe'
];

/** Minimal HTML entity set — the ones that actually show up in prose. */
const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', hellip: '…', lsquo: '‘', rsquo: '’',
  ldquo: '“', rdquo: '”', middot: '·', bull: '•'
};

/**
 * Decode the common named entities plus numeric ones. Unknown entities are
 * left as-is rather than mangled.
 * @param {string} s
 * @returns {string}
 */
export function decodeEntities(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => {
      const v = ENTITIES[name.toLowerCase()];
      return v === undefined ? m : v;
    });
}

function safeFromCodePoint(cp) {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) {
    return '';
  }
  try {
    return String.fromCodePoint(cp);
  } catch {
    return '';
  }
}

// `>` inside a quoted attribute value must not end the tag — the naive
// /<[^>]*>/ leaves the tail of such attributes behind as literal text.
const TAG_RE = /<(?:[^>"']|"[^"]*"|'[^']*')*>/g;

/** Remove tags and collapse whitespace to a single-line string. */
function textOf(html) {
  return decodeEntities(String(html).replace(TAG_RE, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract <pre> text keeping its line structure: <br> and literal newlines
 * become line breaks, leading indentation survives, and interior whitespace
 * is not collapsed — code without line breaks is not code. Trailing
 * whitespace per line and leading/trailing blank lines are trimmed.
 */
function preTextOf(html) {
  const text = decodeEntities(
    String(html)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(TAG_RE, '')
      .replace(/\r\n?/g, '\n')
      .replace(/\t/g, '  ') // canvas renders \t inconsistently — expand
  );
  const lines = text.split('\n').map(l => l.replace(/\s+$/, ''));
  while (lines.length && !lines[0].trim()) {
    lines.shift();
  }
  while (lines.length && !lines[lines.length - 1].trim()) {
    lines.pop();
  }
  return lines.join('\n');
}

/** Strip elements whose contents are never prose (with their contents). */
function stripNonContent(html) {
  let out = String(html).replace(/<!--[\s\S]*?-->/g, ' ');
  for (const tag of STRIP_ELEMENTS) {
    // Non-greedy, case-insensitive, tolerant of attributes.
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), ' ');
    // Self-closing / unclosed variants.
    out = out.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), ' ');
  }
  return out;
}

/**
 * Narrow to the main content region when the markup declares one. Falls back
 * to the whole document, which is why boilerplate stripping runs first.
 */
function mainRegion(html) {
  const candidates = [
    /<article\b[^>]*>([\s\S]*?)<\/article\s*>/i,
    /<main\b[^>]*>([\s\S]*?)<\/main\s*>/i,
    /<[a-z]+\b[^>]*\srole\s*=\s*["']main["'][^>]*>([\s\S]*?)<\/[a-z]+\s*>/i
  ];
  for (const re of candidates) {
    const m = html.match(re);
    if (m && m[1] && textOf(m[1]).length > 200) {
      return m[1];
    }
  }
  return html;
}

/**
 * Extract the document title, preferring `<title>` then the first `<h1>`.
 * @param {string} html
 * @returns {string}
 */
export function extractTitle(html) {
  const t = String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  if (t && textOf(t[1])) {
    return textOf(t[1]);
  }
  const h1 = String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i);
  return h1 ? textOf(h1[1]) : '';
}

/**
 * Lift content the flat block scan cannot reach into reachable text:
 * - `<img alt>` — the tag (and attribute) is stripped whole, so a
 *   descriptive alt is inlined as ` [img: …] ` inside its paragraph.
 * - `<ol>` items — each `<li>` gets its ordinal baked in, or a numbered
 *   procedure silently renders as an unordered list.
 * - `<table>` — no cell lands inside a p/li, so tables vanished entirely.
 *   Each row becomes a paragraph of `cell | cell` (already-decoded text).
 * - `<rt>`/`<rp>` — ruby annotations are furigana rendered *above* the base
 *   text; inlined they duplicate it (`漢字 ( かんじ ) を読む`). Stripped.
 *
 * Text lifted into markup is decoded already; a literal `<`/`&` inside it
 * would restart tag scanning, so it is re-encoded (the block scan decodes
 * it back via textOf).
 */
const reEncode = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function liftUnreachable(html) {
  return String(html)
    .replace(/<(rt|rp)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const m = tag.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/);
      const alt = m ? decodeEntities(m[1] || m[2] || m[3] || '').trim() : '';
      return alt ? ` [img: ${reEncode(alt)}] ` : ' ';
    })
    .replace(/<ol\b[^>]*>([\s\S]*?)<\/ol\s*>/gi, (whole, inner) => {
      let n = 0;
      return inner.replace(/<li\b([^>]*)>([\s\S]*?)<\/li\s*>/gi, (mm, attrs, content) => {
        n += 1;
        return `<li${attrs}>${n}. ${content}</li>`;
      });
    })
    .replace(/<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi, (whole, inner) => {
      const rows = [];
      const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi;
      let r;
      while ((r = trRe.exec(inner)) !== null) {
        const cells = [];
        const cellRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]\s*>/gi;
        let c;
        while ((c = cellRe.exec(r[1])) !== null) {
          const t = textOf(c[1]);
          if (t) {
            cells.push(t);
          }
        }
        if (cells.length) {
          rows.push(`<p>${reEncode(cells.join(' | '))}</p>`);
        }
      }
      return rows.join('');
    });
}

/**
 * Extract readable blocks from an HTML document.
 *
 * @param {string} html
 * @returns {{title: string, blocks: Array<{type: 'h'|'p'|'pre', text: string}>}}
 */
export function extractReadableText(html) {
  const src = String(html === null || html === undefined ? '' : html);
  const title = extractTitle(src);
  const body = liftUnreachable(mainRegion(stripNonContent(src)));

  const blocks = [];
  // Headings, prose and preformatted code, in document order. Without `pre`
  // in the alternation a tech article's code samples silently vanished —
  // fatal for exactly the Qiita/Zenn posts this reader exists for.
  const re = /<(h[1-6]|p|li|blockquote|pre|figcaption|dt|dd|summary)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
  let m;
  while ((m = re.exec(body)) !== null) {
    const tag = m[1].toLowerCase();
    const text = tag === 'pre' ? preTextOf(m[2]) : textOf(m[2]);
    if (!text) {
      continue;
    }
    // Drop one-word nav crumbs that survived stripping.
    if (tag === 'li' && text.length < 3) {
      continue;
    }
    blocks.push({ type: tag === 'pre' ? 'pre' : (tag.startsWith('h') ? 'h' : 'p'), text });
  }

  return { title, blocks };
}
