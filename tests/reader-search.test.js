/**
 * Find-in-page match semantics (pure module).
 *
 * The reader can show a several-hundred-line article, but the only way to
 * locate anything in it was to page through the whole thing — and for a gaze
 * user every page turn is a dwell. Matching is line-index-based because the
 * reader's whole interaction model (scroll, hit-test, links) addresses lines.
 */

const { findMatches, matchOrdinal, nextMatch, prevMatch } = require('../src/vr/browser/readerSearch.js');

const L = (...texts) => texts.map((text) => ({ style: 'p', text }));

describe('findMatches', () => {
  test('finds every line containing the query', () => {
    const lines = L('the cat sat', 'on the mat', 'a cat again');
    expect(findMatches(lines, 'cat')).toEqual([0, 2]);
  });

  test('is case-insensitive', () => {
    expect(findMatches(L('The CAT'), 'cat')).toEqual([0]);
  });

  test('matches Japanese text', () => {
    const lines = L('東京の天気は晴れ', '大阪は雨', '明日の天気'); 
    expect(findMatches(lines, '天気')).toEqual([0, 2]);
  });

  test('NFC-normalises both sides — an IME NFD query matches NFC text', () => {
    // が as base か + combining dakuten (U+304B U+3099) vs precomposed U+304C.
    const nfdQuery = 'が';
    expect(nfdQuery.length).toBe(2); // really decomposed, not silently NFC
    expect(findMatches(L('ひらがな'), nfdQuery)).toEqual([0]);
  });

  test('blank rows and lines without text never match', () => {
    const lines = [{ style: 'blank' }, { style: 'p' }, { style: 'p', text: 'x cat' }];
    expect(findMatches(lines, 'cat')).toEqual([2]);
  });

  test('an empty or whitespace query matches nothing', () => {
    expect(findMatches(L('anything'), '')).toEqual([]);
    expect(findMatches(L('anything'), '   ')).toEqual([]);
  });

  test('degenerate input does not throw', () => {
    expect(findMatches(null, 'x')).toEqual([]);
    expect(findMatches(L('a'), null)).toEqual([]);
    expect(findMatches(undefined, undefined)).toEqual([]);
  });
});

describe('nextMatch / prevMatch cycle like a browser find', () => {
  const M = [2, 5, 9];

  test('next advances and wraps', () => {
    expect(nextMatch(M, 2)).toBe(5);
    expect(nextMatch(M, 5)).toBe(9);
    expect(nextMatch(M, 9)).toBe(2);   // wrap
    expect(nextMatch(M, -1)).toBe(2);  // before the first
  });

  test('prev goes back and wraps', () => {
    expect(prevMatch(M, 9)).toBe(5);
    expect(prevMatch(M, 5)).toBe(2);
    expect(prevMatch(M, 2)).toBe(9);   // wrap backwards
  });

  test('no matches means -1', () => {
    expect(nextMatch([], 3)).toBe(-1);
    expect(prevMatch(null, 3)).toBe(-1);
  });
});

describe('matchOrdinal', () => {
  test('is 1-based, 0 when not a match', () => {
    expect(matchOrdinal([2, 5, 9], 5)).toBe(2);
    expect(matchOrdinal([2, 5, 9], 4)).toBe(0);
    expect(matchOrdinal([], 4)).toBe(0);
  });
});
