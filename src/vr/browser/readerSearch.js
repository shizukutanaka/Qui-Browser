/**
 * Find-in-page over the reader's laid-out lines.
 *
 * Why line indices and not character offsets: the reader's whole interaction
 * model is line-based — scrolling, hit-testing and link rows all address lines
 * (see readerLayout.js), so a match is "a line to scroll to and highlight",
 * which reuses that machinery instead of inventing substring geometry on a
 * canvas.
 *
 * Matching follows the repo's established normalisation discipline (Sessions
 * 11/18): NFC + case-insensitive, so an NFD query from an IME (か + combining
 * dakuten) matches NFC-stored text, and ASCII case never matters.
 *
 * Pure and dependency-free so it is testable headless.
 */

const norm = (s) => String(s).normalize('NFC').toLowerCase();

/**
 * Indices of the lines containing the query.
 *
 * @param {Array<{text?: string, style?: string}>} lines laid-out reader lines
 * @param {string} query
 * @returns {number[]} match indices, ascending; empty for no/blank query
 */
export function findMatches(lines, query) {
  if (!Array.isArray(lines) || typeof query !== 'string') {
    return [];
  }
  const q = norm(query.trim());
  if (!q) {
    return [];
  }
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line && line.style !== 'blank' && typeof line.text === 'string'
      && norm(line.text).includes(q)) {
      out.push(i);
    }
  }
  return out;
}

/**
 * Position of `current` within `matches`, for a "3/7" style label.
 * @returns {number} 1-based ordinal, or 0 when current is not a match
 */
export function matchOrdinal(matches, current) {
  const i = Array.isArray(matches) ? matches.indexOf(current) : -1;
  return i === -1 ? 0 : i + 1;
}

/**
 * The next match after `current`, wrapping — a cycle, like every browser's
 * find. With no matches returns -1.
 *
 * @param {number[]} matches ascending match indices
 * @param {number} current the line index the focus is on now
 * @returns {number} the line index of the next match, or -1
 */
export function nextMatch(matches, current) {
  if (!Array.isArray(matches) || !matches.length) {
    return -1;
  }
  for (const m of matches) {
    if (m > current) {
      return m;
    }
  }
  return matches[0]; // wrap
}

/**
 * The previous match before `current`, wrapping backwards.
 * @param {number[]} matches
 * @param {number} current
 * @returns {number}
 */
export function prevMatch(matches, current) {
  if (!Array.isArray(matches) || !matches.length) {
    return -1;
  }
  for (let i = matches.length - 1; i >= 0; i--) {
    if (matches[i] < current) {
      return matches[i];
    }
  }
  return matches[matches.length - 1]; // wrap
}
