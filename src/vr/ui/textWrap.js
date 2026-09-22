/**
 * Shared code-point-aware text wrapping for canvas-rendered UI.
 *
 * Extracted from `CaptionSystem._wrap` so the caption system and the reader
 * viewport share one hardened implementation rather than forking it. The
 * hardening this preserves is not cosmetic:
 *
 * Counts and splits by Unicode **code point** (`Array.from`), not UTF-16 code
 * unit. This matters most for Japanese: with no spaces the whole line is one
 * "word" that always takes the hard-split path, and a slice on UTF-16 units
 * would sever a surrogate pair (emoji, CJK Extension kanji such as 𠮷 U+20BB7)
 * at the row boundary, leaving a broken �.
 *
 * Char-count based, not `ctx.measureText` based — consistent with the rest of
 * the codebase's canvas layout, and the reason this stays pure and testable
 * without a canvas (no `measureText` exists in the test stubs).
 */

/**
 * Advance width of a character in em units, per Unicode UAX #11 East Asian
 * Width. CJK ideographs, kana, Hangul and fullwidth forms occupy a full em;
 * Latin, digits and punctuation occupy roughly half.
 *
 * Why this matters here: a plain code-point count silently assumes every
 * character is the same width, which is false for the two scripts this app
 * targets. At the reader's 20px body font in a 928px-wide text column, a
 * 58-character budget is ~580px of Latin (fine) but ~1160px of Japanese —
 * 25% wider than the panel, so Japanese prose ran off the edge. Measuring in
 * em makes one budget correct for both scripts.
 *
 * The half-width figure is a BOUND, not an average. Measured with real fonts
 * (tools/verify-text-layout.mjs): lowercase sans prose is 0.453 em, but bold
 * caps/digits — product names, URLs, "W3C" — reach 0.584, and monospace is
 * 0.602. A 0.5 "average" therefore under-counts exactly the content these
 * surfaces carry: URLs in the bookmark rows and the IME input overflowed by
 * ~13%. 0.6 bounds all three.
 *
 * @param {number} cp code point
 * @returns {number} 1 for full-width, 0.5 otherwise
 */
export const HALFWIDTH_EM = 0.6;
/** Emoji are Wide per UAX #11 but render wider than one em (measured 1.248). */
export const EMOJI_EM = 1.3;
/** Appended by truncateToWidth; a full em in sans-serif (measured 1.000). */
const ELLIPSIS = '…';

/**
 * Grapheme-cluster segmentation (UAX #29). Code-point splitting still severs
 * real glyphs — a decomposed が (base + combining dakuten, common from macOS
 * paste which favours NFD), a flag's regional-indicator pair, or a ZWJ emoji
 * sequence. Intl.Segmenter keeps each rendered glyph whole. Supported on every
 * engine this ships to (Chromium ≥87, Safari ≥14.1, Node ≥16); the code-point
 * iterator is the fallback.
 */
const graphemeSegmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

function* graphemes(s) {
  if (graphemeSegmenter) {
    for (const { segment } of graphemeSegmenter.segment(s)) {
      yield segment;
    }
  } else {
    yield* s; // string iteration is already code-point-wise
  }
}

function firstChar(s) {
  return s[Symbol.iterator]().next().value;
}

/** Width of one rendered glyph: the widest member of its cluster. */
function graphemeWidthEm(cluster) {
  let w = 0;
  for (const ch of cluster) {
    w = Math.max(w, charWidthEm(ch.codePointAt(0)));
  }
  return w;
}

/**
 * Kinsoku (UAX #14 line-break prohibitions) for the hard-split path.
 *
 * Japanese has no spaces, so a paragraph of it always takes the
 * char-by-char split below — without these sets, a break could put a closing
 * punctuation mark at the head of a row or an open bracket at its tail.
 *
 * KIN_START (行頭禁則): chars that must not open a row — closing punctuation
 * and brackets, small kana, prolonged-sound and iteration marks, etc.
 * KIN_END (行末禁則): chars that must not end a row — opening brackets/quotes.
 *
 * The set is the common Japanese subset (JIS X 4051 style); it is deliberately
 * not the whole UAX #14 table — canvas layout here uses an approximate em
 * model anyway, so the 95% WIDTH_SAFETY budget absorbs the occasional
 * one-char overhang this strategy produces (ぶら下げ).
 */
export const KIN_START = new Set(Array.from(
  '、。，．！？：；…‥・ー〜～ゝゞ々〻' +            // closes/punct/prolonged/iteration
  'ぁぃぅぇぉゃゅょゎっゕゖ' +                  // small hiragana
  'ァィゥェォャュョヮッヵヶ' +                  // small katakana
  '）］｝〉》」』】〕〗〙〛' +                  // closing brackets
  '”),.!?;:%'                                 // ASCII closes + inline punct
));
const KIN_END = new Set(Array.from(
  '（［｛〈《「『【〔〖〘〚' +                  // opening brackets
  '“('                                        // ASCII opens
));

export function charWidthEm(cp) {
  // Zero rendered width, checked before the width ranges below — some of
  // these code points sit inside a wide range (0x3099 combining dakuten is
  // inside the kana block) and would otherwise count a full em for ink they
  // never draw. Combining marks, variation selectors, joiners, bidi/format
  // controls and tag characters all consume no advance of their own.
  if (
    (cp >= 0x0300 && cp <= 0x036f) ||   // combining diacritical marks
    cp === 0x3099 || cp === 0x309a ||   // combining dakuten/handakuten (inside kana range)
    cp === 0x00ad || cp === 0x061c ||   // soft hyphen, Arabic letter mark
    cp === 0x180e || cp === 0xfeff ||   // Mongolian vowel sep, BOM/ZWNBSP
    (cp >= 0x1ab0 && cp <= 0x1aff) ||   // combining marks extended
    (cp >= 0x1dc0 && cp <= 0x1dff) ||   // combining marks supplement
    (cp >= 0x20d0 && cp <= 0x20ff) ||   // combining marks for symbols (keycap 20E3)
    (cp >= 0xfe20 && cp <= 0xfe2f) ||   // combining half marks
    (cp >= 0xfe00 && cp <= 0xfe0f) ||   // variation selectors 1-16
    (cp >= 0x200b && cp <= 0x200f) ||   // ZWSP, ZWNJ, ZWJ, LRM, RLM
    (cp >= 0x202a && cp <= 0x202e) ||   // bidi embeddings/overrides
    (cp >= 0x2060 && cp <= 0x2064) ||   // word joiner, invisible operators
    (cp >= 0x2066 && cp <= 0x2069) ||   // bidi isolates
    (cp >= 0xe0020 && cp <= 0xe007f) || // tag characters (subdivision flags)
    (cp >= 0xe0100 && cp <= 0xe01ef)    // variation selectors supplement
  ) {
    return 0;
  }
  if ((cp >= 0x1f300 && cp <= 0x1faff) || (cp >= 0x2600 && cp <= 0x27bf) ||
      (cp >= 0x1f1e6 && cp <= 0x1f1ff)) { // regional indicators — below 1F300, Wide per UAX #11
    return EMOJI_EM;
  }
  // U+2026 is not East Asian but renders a full em in sans-serif. Every
  // truncation appends it, so under-counting it pushed labels past their box.
  if (cp === 0x2026) {
    return 1;
  }
  if (
    (cp >= 0x1100 && cp <= 0x115f) ||   // Hangul Jamo initial
    (cp >= 0x2e80 && cp <= 0x303e) ||   // CJK radicals, Kangxi, CJK punctuation
    (cp >= 0x3041 && cp <= 0x33ff) ||   // Kana, Bopomofo, Hangul compat, enclosed CJK
    (cp >= 0x3400 && cp <= 0x4dbf) ||   // CJK Ext A
    (cp >= 0x4e00 && cp <= 0x9fff) ||   // CJK Unified
    (cp >= 0xa000 && cp <= 0xa4cf) ||   // Yi
    (cp >= 0xac00 && cp <= 0xd7a3) ||   // Hangul syllables
    (cp >= 0xf900 && cp <= 0xfaff) ||   // CJK compatibility ideographs
    (cp >= 0xfe10 && cp <= 0xfe19) ||   // Vertical forms
    (cp >= 0xfe30 && cp <= 0xfe6f) ||   // CJK compatibility forms
    (cp >= 0xff00 && cp <= 0xff60) ||   // Fullwidth forms
    (cp >= 0xffe0 && cp <= 0xffe6) ||   // Fullwidth signs
    (cp >= 0x20000 && cp <= 0x2fffd) || // CJK Ext B..F
    (cp >= 0x30000 && cp <= 0x3fffd)
  ) {
    return 1;
  }
  return HALFWIDTH_EM;
}

/**
 * Total advance width of a string in em units.
 *
 * Summed per grapheme cluster, not per code point — a code-point sum measures
 * ink that does not exist: NFD kana (base + combining dakuten, which macOS
 * paste favours) measured 2 em for 1 em of rendered glyph, a ZWJ family emoji
 * measured 5.1 for ~1.3, a conjoined Hangul jamo block measured 2.2 for 1,
 * and a bare ZWSP/format mark added 0.6 for nothing. The over-count was not
 * theoretical: `truncateToWidth`'s fit check and `wrapTextToWidth`'s join
 * budget both run on this, so NFD/emoji text truncated and wrapped at half
 * its real capacity.
 */
export function textWidthEm(text) {
  let w = 0;
  for (const g of graphemes(String(text === null || text === undefined ? '' : text))) {
    w += graphemeWidthEm(g);
  }
  return w;
}

/**
 * Wrap text to lines no wider than `maxEm` em units.
 *
 * Unlike a code-point budget this is script-correct: at a 34 em measure a
 * Latin line holds ~68 characters (inside the classic 45–75 measure) while a
 * Japanese line holds 34 (inside the 15–35 comfortable range for horizontal
 * Japanese, and close to the ~30 chars/line found fastest to read). One
 * number, both scripts.
 *
 * Splits by code point, so surrogate pairs are never severed.
 *
 * @param {string} text
 * @param {number} maxEm
 * @returns {string[]} always at least one row
 */
export function wrapTextToWidth(text, maxEm) {
  const limit = Math.max(1, Number(maxEm) || 1);
  const words = String(text === null || text === undefined ? '' : text).trim().split(/\s+/);
  const rows = [];
  let cur = '';
  let curW = 0;

  const pushCur = () => {
    if (cur) {
      rows.push(cur);
      cur = '';
      curW = 0;
    }
  };

  for (const w of words) {
    const wW = textWidthEm(w);
    if (wW > limit) {
      // Word wider than a whole row: hard-split it by accumulated em width,
      // honouring kinsoku — a KIN_START char overhangs the current row
      // (ぶら下げ) rather than opening the next, and a KIN_END char is
      // carried down to open the next row (追い出し).
      pushCur();
      let chunk = '';
      let chunkW = 0;
      for (const ch of graphemes(w)) {
        const cw = graphemeWidthEm(ch);
        if (chunkW + cw > limit && chunk) {
          if (KIN_START.has(firstChar(ch))) {
            chunk += ch;
            chunkW += cw;
            continue;
          }
          const gs = Array.from(graphemes(chunk));
          const last = gs.pop();
          // Move the open bracket down only if a real char stays behind —
          // a chunk that is only the bracket can't split without an empty row.
          if (gs.length > 0 && KIN_END.has(firstChar(last))) {
            rows.push(gs.join(''));
            chunk = last + ch;
            chunkW = graphemeWidthEm(last) + cw;
            continue;
          }
          rows.push(chunk);
          chunk = '';
          chunkW = 0;
        }
        chunk += ch;
        chunkW += cw;
      }
      cur = chunk;
      curW = chunkW;
    } else if (!cur) {
      cur = w;
      curW = wW;
    } else if (curW + 0.5 + wW <= limit) { // 0.5 em for the joining space
      cur += ' ' + w;
      curW += 0.5 + wW;
    } else if (cur && KIN_START.has(firstChar(w))) {
      // A space-split word beginning with closing punctuation must not open a
      // row either — let it overhang the current one (ぶら下げ).
      cur += ' ' + w;
      curW += 0.5 + wW;
    } else {
      pushCur();
      cur = w;
      curW = wW;
    }
  }
  pushCur();
  return rows.length ? rows : [''];
}

/**
 * Fraction of a geometry-derived budget to actually use.
 *
 * `charWidthEm` models full-width as exactly 1 em and Latin as 0.5, which is
 * the UAX #11 semantic — but real fonts do not match it exactly. Measured in
 * headless Chromium (`tools/measure-text-metrics.mjs`): full-width advance is
 * **1.012 em** (本 = 1.000 but あ = 1.023), Latin 0.458–0.496, monospace 0.602.
 * So the model slightly UNDER-estimates full-width text.
 *
 * Where a budget is computed from pixel geometry — `usable_px / font_px` — a
 * 1% under-estimate means a line exactly fills, then overflows. Reserving 5%
 * absorbs that, plus the larger unknown: a Quest headset resolves
 * `sans-serif` to a different family than this Linux container, so the exact
 * measured figures are not portable and the budget should not be tuned to them.
 *
 * Budgets that already sit well inside their box (e.g. the reader's fixed
 * 34 em in a 46 em column) do not need it.
 */
export const WIDTH_SAFETY = 0.95;

/**
 * Largest safe em budget for `fontPx` within `availablePx`, including the
 * safety margin above. Use this instead of dividing by hand.
 */
export function safeMeasureEm(availablePx, fontPx) {
  return (Math.max(0, availablePx) / Math.max(1, fontPx)) * WIDTH_SAFETY;
}

/**
 * Truncate to `maxEm` em units, appending an ellipsis that is itself counted.
 * The em model matters for the same reason as wrapping: a code-point budget
 * lets full-width text overrun the box it was meant to fit.
 *
 * @param {string} text
 * @param {number} maxEm
 * @returns {string}
 */
export function truncateToWidth(text, maxEm) {
  const limit = Math.max(0.5, Number(maxEm) || 0.5);
  const s = String(text === null || text === undefined ? '' : text);
  if (textWidthEm(s) <= limit) {
    return s;
  }
  // Reserve the ellipsis's REAL modeled width, not a guessed 0.5: it is a full
  // em in sans-serif, so a fixed 0.5 left every truncated string over budget.
  const budget = limit - charWidthEm(ELLIPSIS.codePointAt(0));
  let out = '';
  let w = 0;
  for (const ch of graphemes(s)) {
    const cw = graphemeWidthEm(ch);
    if (w + cw > budget) {
      break;
    }
    out += ch;
    w += cw;
  }
  return out + ELLIPSIS;
}

