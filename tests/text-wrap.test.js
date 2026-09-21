import {
  charWidthEm,
  textWidthEm,
  wrapTextToWidth,
  safeMeasureEm,
  truncateToWidth,
  wrapTextToLines,
  HALFWIDTH_EM,
  EMOJI_EM,
  WIDTH_SAFETY
} from '../src/vr/ui/textWrap.js';

describe('charWidthEm', () => {
  it('assigns full em to CJK, kana, Hangul and fullwidth forms', () => {
    expect(charWidthEm('あ'.codePointAt(0))).toBe(1);
    expect(charWidthEm('本'.codePointAt(0))).toBe(1);
    expect(charWidthEm('한'.codePointAt(0))).toBe(1);
    expect(charWidthEm('Ａ'.codePointAt(0))).toBe(1);
    expect(charWidthEm(0x20bb7)).toBe(1); // 𠮷 — CJK Ext B surrogate pair
  });

  it('assigns the half-width bound to Latin, digits and punctuation', () => {
    expect(charWidthEm('a'.codePointAt(0))).toBe(HALFWIDTH_EM);
    expect(charWidthEm('9'.codePointAt(0))).toBe(HALFWIDTH_EM);
    expect(charWidthEm('.'.codePointAt(0))).toBe(HALFWIDTH_EM);
  });

  it('gives emoji their measured wide value and the ellipsis a full em', () => {
    expect(charWidthEm('😀'.codePointAt(0))).toBe(EMOJI_EM);
    expect(charWidthEm('⚠'.codePointAt(0))).toBe(EMOJI_EM);
    expect(charWidthEm('…'.codePointAt(0))).toBe(1);
  });
});

describe('textWidthEm', () => {
  it('sums per code point, not per UTF-16 unit', () => {
    // 𠮷 is one code point over a surrogate pair — width 1 em, not 2 × 0.6.
    expect(textWidthEm('𠮷')).toBe(1);
    expect(textWidthEm('abc')).toBeCloseTo(3 * HALFWIDTH_EM);
    expect(textWidthEm('日本語')).toBe(3);
  });

  it('tolerates null/undefined as empty', () => {
    expect(textWidthEm(null)).toBe(0);
    expect(textWidthEm(undefined)).toBe(0);
  });
});

describe('wrapTextToWidth', () => {
  it('joins words while the space + next word fits the em budget', () => {
    // 'aa' = 1.2, space 0.5, 'bb' = 1.2 → 2.9 ≤ 3 → one row; 'cc' overflows.
    expect(wrapTextToWidth('aa bb cc', 3)).toEqual(['aa bb', 'cc']);
  });

  it('hard-splits a word wider than a whole row by code point', () => {
    // '日本語abc' = 3 + 3*0.6 = 4.8 em over limit 3 → split inside the word.
    const rows = wrapTextToWidth('日本語abc', 3);
    expect(rows.join('')).toBe('日本語abc');
    expect(rows.every((r) => textWidthEm(r) <= 3)).toBe(true);
  });

  it('never severs a surrogate pair at a row boundary', () => {
    const rows = wrapTextToWidth('𠮷𠮷𠮷𠮷', 2.5);
    expect(rows.join('')).toBe('𠮷𠮷𠮷𠮷');
    expect(rows.every((r) => !/[\ud800-\udfff]/.test(r.replace(/[\ud800-\udbff][\udc00-\udfff]/g, '')))).toBe(true);
  });

  it('gives CJK prose the same em budget as Latin — script-correct measure', () => {
    // 34 em budget: 34 full-width chars fill a row; ~56 half-width do.
    expect(wrapTextToWidth('あ'.repeat(40), 34)).toEqual(['あ'.repeat(34), 'あ'.repeat(6)]);
    const latin = 'x'.repeat(56);
    expect(wrapTextToWidth(latin, 34)[0].length).toBe(56);
  });

  it('returns one empty row for empty input', () => {
    expect(wrapTextToWidth('', 10)).toEqual(['']);
    expect(wrapTextToWidth('   ', 10)).toEqual(['']);
  });
});

describe('safeMeasureEm / truncateToWidth', () => {
  it('converts a pixel budget to em with the safety margin applied', () => {
    expect(safeMeasureEm(920, 20)).toBeCloseTo((920 / 20) * WIDTH_SAFETY);
    expect(safeMeasureEm(0, 20)).toBe(0);
  });

  it('truncates with the ellipsis counted in the budget', () => {
    const out = truncateToWidth('abcdefghij', 5);
    expect(out.endsWith('…')).toBe(true);
    expect(textWidthEm(out)).toBeLessThanOrEqual(5 + 1e-9);
  });

  it('passes text through unchanged when it already fits', () => {
    expect(truncateToWidth('short', 20)).toBe('short');
  });
});

describe('wrapTextToLines', () => {
  it('wraps by code points and hard-splits long words', () => {
    expect(wrapTextToLines('ab cd', 3)).toEqual(['ab', 'cd']);
    const rows = wrapTextToLines('𠮷𠮷𠮷𠮷𠮷', 2);
    expect(rows).toEqual(['𠮷𠮷', '𠮷𠮷', '𠮷']);
  });

  it('returns one empty row for empty input', () => {
    expect(wrapTextToLines('', 5)).toEqual(['']);
  });
});
