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

/**
 * Longest run of characters one element may hold. A "paragraph" longer than
 * this is not prose, and letting a lazy match run to the end of the document
 * is what makes an unclosed tag quadratic.
 */
export const MAX_ELEMENT_CHARS = 20000;

/**
 * Most markup the reader will process. Measured: a realistic 5 MB article takes
 * ~860 ms to extract, and extraction runs synchronously — in a headset that is
 * a freeze of the world, not merely a dropped frame, so it is a comfort problem
 * as much as a performance one. The proxy caps responses at 5 MB but a direct
 * CORS fetch has no cap at all, so the reader imposes its own. Longer input is
 * truncated rather than refused: the start of a huge page is still worth
 * reading, and far more text than this never fits the viewport anyway.
 */
export const MAX_MARKUP_CHARS = 2 * 1024 * 1024;

/** Most blocks laid out. Beyond this the reader is paging through noise. */
export const MAX_BLOCKS = 2000;

/**
 * Body pattern for an element that may not swallow another opening tag of the
 * same kind, bounded in length.
 *
 * Both properties matter, and one of them is a correctness fix rather than a
 * performance one:
 *
 *  - **Non-crossing.** `</p>` is optional in HTML, so `<p>A<p>B</p>` is ordinary
 *    real-world markup. A lazy `[\s\S]*?` matched it as ONE block whose text
 *    was "A" plus "B" run together, and B never appeared as a paragraph of its
 *    own — structure silently lost on a very common shape.
 *  - **Bounded.** With an unclosed tag the lazy form rescans to the end of the
 *    document from every start position, which is quadratic: measured, 40,000
 *    unclosed `<p>` (117 KB) took 10.8 s in the block regex alone, and the
 *    reader runs on untrusted markup. The same input takes 1 ms here, with an
 *    identical match count on well-formed articles.
 *
 * @param {string} alternation regex alternation of the tag names to exclude
 * @returns {string} a regex source fragment for the element's body
 */
function elementBody(alternation) {
  return `((?:(?!<\\/?(?:${alternation})\\b)[\\s\\S]){0,${MAX_ELEMENT_CHARS}})`;
}

/**
 * Longest attribute run inside one tag.
 *
 * `[^>]*` looks harmless but is the second source of quadratic behaviour: on
 * input containing no `>` at all — `'<p'.repeat(20000)`, or a truncated
 * `<a href=` — it rescans to the end of the document from every start
 * position. Measured, those took 3.4 s and over 15 s respectively. A tag
 * carrying more than this many characters of attributes is not markup the
 * reader needs to understand.
 *
 * It also excludes `<`. An attribute value cannot legitimately contain a raw
 * `<` (it has to be `&lt;`), and forbidding it means a `>`-less run stops at
 * the next tag instead of at the bound — which matters because the anchor
 * pattern has two attribute runs, and two bounded runs multiply: with `[^>]`
 * the truncated `'<a href='.repeat(20000)` still ran past 15 s.
 */
const MAX_ATTR_CHARS = 2000;
const ATTRS = `[^<>]{0,${MAX_ATTR_CHARS}}`;

/** Block-level elements the reader turns into paragraphs and headings. */
const BLOCK_TAGS = 'h[1-3]|p|li|blockquote';

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

/** Remove tags and collapse whitespace to a single-line string. */
function textOf(html) {
  return decodeEntities(String(html).replace(/<[^<>]{0,2000}>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip elements whose contents are never prose (with their contents). */
function stripNonContent(html) {
  let out = String(html).replace(/<!--[\s\S]*?-->/g, ' ');
  for (const tag of STRIP_ELEMENTS) {
    // Non-greedy, case-insensitive, tolerant of attributes.
    out = out.replace(new RegExp(`<${tag}\\b${ATTRS}>${elementBody(tag)}<\\/${tag}\\s*>`, 'gi'), ' ');
    // Self-closing / unclosed variants.
    out = out.replace(new RegExp(`<${tag}\\b${ATTRS}\\/?>`, 'gi'), ' ');
  }
  return out;
}

/**
 * Narrow to the main content region when the markup declares one. Falls back
 * to the whole document, which is why boilerplate stripping runs first.
 */
function mainRegion(html) {
  const candidates = [
    /<article\b[^<>]{0,2000}>([\s\S]*?)<\/article\s*>/i,
    /<main\b[^<>]{0,2000}>([\s\S]*?)<\/main\s*>/i,
    /<[a-z]+\b[^<>]{0,2000}\srole\s*=\s*["']main["'][^<>]{0,2000}>([\s\S]*?)<\/[a-z]+\s*>/i
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
  const t = String(html).match(/<title\b[^<>]{0,2000}>([\s\S]*?)<\/title\s*>/i);
  if (t && textOf(t[1])) {
    return textOf(t[1]);
  }
  const h1 = String(html).match(/<h1\b[^<>]{0,2000}>([\s\S]*?)<\/h1\s*>/i);
  return h1 ? textOf(h1[1]) : '';
}

/** Most links carried out of one page. Beyond this the list stops being usable. */
export const MAX_LINKS = 40;

/**
 * Extract the followable links from a document.
 *
 * The reader used to discard every `<a href>`, which left the browser unable
 * to do the one thing hypertext is for: a user could reach a page and read it,
 * but the only way to follow a link was to retype its URL on a gaze keyboard
 * at roughly 8–10 WPM. Atom ④ of the core loop (navigate → display → read →
 * *interact* → back → save) was simply missing.
 *
 * Runs over the same stripped main region as the prose, so navigation
 * chrome, footers and asides do not flood the list with boilerplate.
 *
 * @param {string} html
 * @param {string} [baseUrl] page URL, for resolving relative hrefs
 * @returns {Array<{text: string, href: string}>} deduped, in document order
 */
export function extractLinks(html, baseUrl) {
  const body = mainRegion(stripNonContent(String(html === null || html === undefined ? '' : html)));
  const re = new RegExp(
    `<a\\b${ATTRS}\\shref\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))${ATTRS}>${elementBody('a')}<\\/a\\s*>`,
    'gi');
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(body)) !== null && out.length < MAX_LINKS) {
    const raw = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '').trim();
    const text = textOf(m[5]);
    if (!raw || !text) {
      continue; // an empty href, or an icon-only link with no readable label
    }
    let href;
    try {
      // Resolve against the page. Without a base a relative href is
      // unusable, so it is dropped rather than guessed at.
      href = baseUrl ? new URL(raw, baseUrl).href : new URL(raw).href;
    } catch {
      continue;
    }
    // Only what the panel can actually navigate to. javascript:, mailto:,
    // data: and friends would fail resolveInput anyway; dropping them here
    // keeps them off a list that promises every row is followable.
    if (!/^https?:$/i.test(new URL(href).protocol)) {
      continue;
    }
    if (seen.has(href)) {
      continue;
    }
    seen.add(href);
    out.push({ text, href });
  }
  return out;
}

/**
 * Extract readable blocks from an HTML document.
 *
 * @param {string} html
 * @param {string} [baseUrl] page URL, for resolving relative link hrefs
 * @returns {{title: string, blocks: Array<{type: 'h'|'p', text: string}>,
 *            links: Array<{text: string, href: string}>}}
 */
export function extractReadableText(html, baseUrl) {
  const raw = String(html === null || html === undefined ? '' : html);
  // Truncate rather than refuse: the start of an enormous page is still worth
  // reading, and extraction is synchronous, so an unbounded page freezes the
  // headset rather than merely dropping frames.
  const src = raw.length > MAX_MARKUP_CHARS ? raw.slice(0, MAX_MARKUP_CHARS) : raw;
  const title = extractTitle(src);
  const body = mainRegion(stripNonContent(src));

  const blocks = [];
  // Headings and prose, in document order.
  // Ends at a real closing tag, at the next opening tag of the same family, or
  // at end of input. HTML makes `</p>` and `</li>` optional, so requiring a
  // close would silently DROP every unclosed block — and matching lazily past
  // one merged two paragraphs into a single run of text. Both were wrong on
  // markup that is entirely valid.
  const re = new RegExp(
    `<(${BLOCK_TAGS})\\b${ATTRS}>${elementBody(BLOCK_TAGS)}`
    + `(?:<\\/\\1\\s*>|(?=<(?:${BLOCK_TAGS})\\b)|$)`,
    'gi');
  let m;
  while ((m = re.exec(body)) !== null) {
    if (m.index === re.lastIndex) {
      re.lastIndex++; // a zero-length match would otherwise spin forever
    }
    if (blocks.length >= MAX_BLOCKS) {
      break;
    }
    const tag = m[1].toLowerCase();
    const text = textOf(m[2]);
    if (!text) {
      continue;
    }
    // Drop one-word nav crumbs that survived stripping.
    if (tag === 'li' && text.length < 3) {
      continue;
    }
    blocks.push({ type: tag.startsWith('h') ? 'h' : 'p', text });
  }

  return { title, blocks, links: extractLinks(src, baseUrl) };
}
