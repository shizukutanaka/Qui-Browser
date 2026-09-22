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

import { NAMED_ENTITIES } from './namedEntities.js';

/** Elements whose contents are never reader text. */
const STRIP_ELEMENTS = [
  'script', 'style', 'noscript', 'template', 'svg', 'canvas',
  'nav', 'header', 'footer', 'aside', 'form', 'iframe'
];

/**
 * Named character references. Names are **case-sensitive** per the HTML
 * entity table (`&Dagger;` ‡ is not `&dagger;` †, `&Eacute;` É is not
 * `&eacute;` é) — a case-insensitive lookup silently decodes the wrong
 * letter. The set is the **complete HTML5 named-reference repertoire**
 * (2125 names, machine-generated into ./namedEntities.js from the WHATWG
 * entities.json) so anything a real page can emit decodes here, while
 * invented names like `&fake;` are still left untouched.
 */
const ENTITIES = {
  ...NAMED_ENTITIES,
  // Canvas-normalization overrides the hand table already applied: soft
  // hyphen/joiners/directional marks have no glyph in canvas, and the
  // Unicode space flavors render as ASCII space.
  nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ', shy: '', zwnj: '', zwj: '',
  lrm: '', rlm: '', NewLine: ' ', Tab: ' '
};

/**
 * Decode the standard named entities plus numeric ones. Unknown entities are
 * left as-is rather than mangled.
 * @param {string} s
 * @returns {string}
 */
export function decodeEntities(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => {
      const v = ENTITIES[name];
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
 *
 * `<title>` carries the site name on nearly every real page — measured:
 * `WebXR - Wikipedia`, `<article> #Rhodonite - Qiita`, `WebXR 機器 API -
 * Web API | MDN`. Mozilla Readability's `getArticleTitle` resolves this by
 * splitting on the conventional "article | site" separators and keeping the
 * piece that covers the `<h1>`; this does the same, conservatively — when no
 * `<h1>` can arbitrate, the raw `<title>` is returned unmodified rather than
 * guessing which segment is the site name.
 * @param {string} html
 * @returns {string}
 */
export function extractTitle(html) {
  const src = String(html);
  const raw = src.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  const h1m = src.match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i);
  const h1 = h1m ? textOf(h1m[1]) : '';
  const rawTitle = raw ? textOf(raw[1]) : '';
  if (!rawTitle) {
    return h1;
  }
  // Separators must be space-padded: hyphens/slashes inside a word are not
  // site-name joins ("well-being", "and/or").
  const parts = rawTitle
    .split(/\s+[|»·>«›‹–—/\\]\s+|\s+[-_]\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length > 1 && h1) {
    const hit = parts.find((p) => p === h1 || p.includes(h1) || h1.includes(p));
    if (hit) {
      return hit;
    }
  }
  return rawTitle;
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

/** Integer attribute of a tag (`start`, `value`) — absent/invalid → null. */
function intAttr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  if (!m) {
    return null;
  }
  const v = parseInt(m[1] || m[2] || m[3], 10);
  return Number.isFinite(v) ? v : null;
}

/**
 * Bake ordered-list ordinals into every `<li>` that is a direct child of an
 * `<ol>`, honouring `start`, `value` and `reversed` (WHATWG HTML §4.4.7–8).
 *
 * A flat regex cannot do this: `<ol><li>a<ol><li>x</li></ol></li><li>b</li></ol>`
 * has the nested list's items interleaved with the parent's `<li>` stream, so
 * the previous per-`<ol>` counter numbered inner items as if they were the
 * parent's own and then **dropped the parent's following item's number
 * entirely** (measured: `1. outer inner1 / 2. inner2 / outer2`). Scanning the
 * list tags with a depth stack attributes each `<li>` to its own list: every
 * level keeps correct numbering and the parent's counter is not consumed by
 * its children. `start="5"` begins at 5, `<li value="7">` restarts the run,
 * `reversed` counts down to `start` (first item = start + count − 1).
 */
function liftOrderedLists(html) {
  const TAG = /<\/?(?:ol|ul|li)\b[^>]*>/gi;
  const stack = []; // { type:'ol'|'ul', tag, items:[{pos, value}] }
  const ols = [];
  let m;
  while ((m = TAG.exec(html)) !== null) {
    const t = m[0];
    if (t[1] === '/') {
      // Pop through the matching open list (interleaved closes in malformed
      // markup simply never match and are ignored).
      const name = t.slice(2, -1).toLowerCase();
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].type === name) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    if (/^<li\b/i.test(t)) {
      const top = stack[stack.length - 1];
      if (top && top.type === 'ol') {
        top.items.push({ pos: m.index + t.length, value: intAttr(t, 'value') });
      }
      continue;
    }
    const entry = { type: /^<ol\b/i.test(t) ? 'ol' : 'ul', tag: t, items: [] };
    stack.push(entry);
    if (entry.type === 'ol') {
      ols.push(entry);
    }
  }

  const insertions = [];
  for (const ol of ols) {
    const start = intAttr(ol.tag, 'start');
    const reversed = /\breversed\b/i.test(ol.tag);
    let next = start === null ? 1 : start;
    if (reversed) {
      next = next + ol.items.length - 1;
    }
    for (const it of ol.items) {
      if (it.value !== null) {
        next = it.value;
      }
      insertions.push({ pos: it.pos, text: `${next}. ` });
      next = reversed ? next - 1 : next + 1;
    }
  }
  // Right-to-left so earlier positions stay valid while splicing.
  insertions.sort((a, b) => b.pos - a.pos);
  let out = String(html);
  for (const ins of insertions) {
    out = out.slice(0, ins.pos) + ins.text + out.slice(ins.pos);
  }
  return out;
}

function liftUnreachable(html) {
  return liftOrderedLists(
    String(html)
      .replace(/<(rt|rp)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
      .replace(/<img\b[^>]*>/gi, (tag) => {
        const m = tag.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/);
        const alt = m ? decodeEntities(m[1] || m[2] || m[3] || '').trim() : '';
        return alt ? ` [img: ${reEncode(alt)}] ` : ' ';
      })
  ).replace(/<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi, (whole, inner) => {
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
    if (tag === 'pre') {
      const text = preTextOf(m[2]);
      if (text) {
        blocks.push({ type: 'pre', text });
      }
      continue;
    }
    // `<br>` is a hard line break — browsers' innerText yields '\n' for it.
    // Merging `line one<br>line two` into one run-on paragraph loses the
    // break entirely (measured), so each br-separated piece becomes its own
    // block, keeping source order and the existing one-block-per-piece model.
    for (const piece of m[2].split(/<br\s*\/?>/gi)) {
      const text = textOf(piece);
      if (!text) {
        continue;
      }
      // Drop one-word nav crumbs that survived stripping.
      if (tag === 'li' && text.length < 3) {
        continue;
      }
      blocks.push({ type: tag.startsWith('h') ? 'h' : 'p', text });
    }
  }

  return { title, blocks };
}
