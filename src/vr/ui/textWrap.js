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
 * Greedy word-wrap into rows no longer than `maxChars` code points.
 * Words longer than a row are hard-split at code-point boundaries.
 *
 * @param {string} text
 * @param {number} maxChars
 * @returns {string[]} always at least one row (`['']` for empty input)
 */
export function wrapTextToLines(text, maxChars) {
  const limit = Math.max(1, Math.floor(maxChars) || 1);
  const words = String(text === null || text === undefined ? '' : text).trim().split(/\s+/);
  const rows = [];
  let cur = '';
  const cpLen = (s) => Array.from(s).length; // code points, not UTF-16 units
  for (const w of words) {
    const wChars = Array.from(w);
    if (wChars.length > limit) {
      if (cur) {
        rows.push(cur);
        cur = '';
      }
      let start = 0;
      while (wChars.length - start > limit) {
        rows.push(wChars.slice(start, start + limit).join(''));
        start += limit;
      }
      cur = wChars.slice(start).join('');
    } else if (!cur) {
      cur = w;
    } else if (cpLen(cur + ' ' + w) <= limit) {
      cur += ' ' + w;
    } else {
      rows.push(cur);
      cur = w;
    }
  }
  if (cur) {
    rows.push(cur);
  }
  return rows.length ? rows : [''];
}
