/**
 * Round 994 pins — CaptionSystem carried two dead helpers (`_wrap`, a
 * pass-through to `wrapTextToLines`, and `_truncate`, a divergent duplicate of
 * `truncateToWidth`) that only the test suite ever called. The shipped layout
 * path (`_layoutRows`) wraps with `wrapTextToWidth` and truncates with
 * `truncateToWidth`, so the pinned artefacts were not the ones that ship.
 *
 * These tests pin the surrogate-pair / lossless invariants directly on the
 * shipped functions, and pin the dead helpers absent.
 */

global.document = {
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () => ({
      measureText: (s) => ({ width: String(s).length * 10 }),
      fillText: () => {},
      fillRect: () => {}
    })
  })
};

const { wrapTextToLines, wrapTextToWidth, truncateToWidth, textWidthEm } = require('../src/vr/ui/textWrap.js');
const { CaptionSystem } = require('../src/vr/accessibility/CaptionSystem.js');

describe('CaptionSystem dead helpers removed (round 994)', () => {
  test('_wrap pass-through is gone — shipped path uses wrapTextToWidth directly', () => {
    expect(CaptionSystem.prototype._wrap).toBeUndefined();
  });

  test('_truncate divergent duplicate is gone — shipped path uses truncateToWidth', () => {
    expect(CaptionSystem.prototype._truncate).toBeUndefined();
  });
});

describe('wrapTextToLines surrogate-pair invariants (migrated from dead _wrap pins)', () => {
  test('hard-splits a word longer than a row without losing characters', () => {
    const rows = wrapTextToLines('x'.repeat(80), 34);
    expect(rows.length).toBe(3); // 34 + 34 + 12
    rows.forEach((r) => expect(r.length).toBeLessThanOrEqual(34));
    expect(rows.join('')).toBe('x'.repeat(80));
  });

  test('hard-splits spaceless Japanese losslessly', () => {
    const jp = 'これはとても長い日本語のキャプションでテキストの折り返しを確認します';
    const rows = wrapTextToLines(jp, 10);
    expect(rows.length).toBeGreaterThan(1);
    rows.forEach((r) => expect(Array.from(r).length).toBeLessThanOrEqual(10));
    expect(rows.join('')).toBe(jp);
  });

  test('never splits a surrogate pair at a row boundary (no mojibake)', () => {
    // 12 emoji wrapped at 5 code points per row: UTF-16 slices would sever a
    // surrogate pair at every boundary.
    const rows = wrapTextToLines('😀'.repeat(12), 5);
    expect(rows.join('')).not.toContain('�');
    rows.forEach((r) => expect(Array.from(r).length).toBeLessThanOrEqual(5));
    expect(rows.join('')).toBe('😀'.repeat(12));
  });
});

describe('truncateToWidth surrogate-pair invariants (migrated from dead _truncate pins)', () => {
  test('is code-point-aware (does not split astral chars)', () => {
    const out = truncateToWidth('𠮷'.repeat(10), 4);
    expect(out).not.toContain('�');
    // 3 CJK ideographs (1 em each) + ellipsis (1 em) = 4 em, 4 code points.
    expect(Array.from(out)).toHaveLength(4);
    expect(out.endsWith('…')).toBe(true);
  });

  test('result including the ellipsis never exceeds its em budget', () => {
    for (const limit of [4, 8, 20]) {
      const out = truncateToWidth('日本語のとても長いキャプションテキストです', limit);
      expect(textWidthEm(out)).toBeLessThanOrEqual(limit + 1e-9);
    }
  });
});

describe('wrapTextToWidth surrogate-pair invariants', () => {
  test('never splits a surrogate pair and is lossless on emoji', () => {
    const rows = wrapTextToWidth('😀'.repeat(12), 5);
    expect(rows.join('')).not.toContain('�');
    expect(rows.join('')).toBe('😀'.repeat(12));
  });
});
