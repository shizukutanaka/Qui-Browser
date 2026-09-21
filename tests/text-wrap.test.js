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

  it('kinsoku: closing punctuation never opens a row (ぶら下げ)', () => {
    // limit 4 em: 'あいうえ' fills row 1 — '、' would land at row 2's head
    // without kinsoku; it must overhang row 1 instead.
    const rows = wrapTextToWidth('あいうえ、おかき', 4);
    expect(rows[0]).toBe('あいうえ、');
    expect(rows[1]).toBe('おかき');
  });

  it('kinsoku: small kana and prolonged marks also never open a row', () => {
    // 'ちいさな' + 'っ' at the boundary — sokuon must not start a line.
    const rows = wrapTextToWidth('きょうはっぴょう', 5);
    expect(rows[0].endsWith('っ')).toBe(true);
  });

  it('kinsoku: an open bracket never ends a row (追い出し)', () => {
    // 'あいう「' fills row 1 exactly; 'か' would break after '「' — instead the
    // bracket is carried down to open the next row.
    const rows = wrapTextToWidth('あいう「かきく', 4);
    expect(rows).toEqual(['あいう', '「かきく']);
  });

  it('kinsoku: a lone bracket chunk cannot split into an empty row', () => {
    // At a 1-em budget the bracket is alone on its row — the only options are
    // a line-end violation or an empty row; the violation is the lesser evil.
    const rows = wrapTextToWidth('「あい', 1);
    expect(rows.every((r) => r.length > 0)).toBe(true);
    expect(rows.join('')).toBe('「あい');
  });

  it('kinsoku: a space-split word starting with closing punct overhangs too', () => {
    // 'aa' fits row 1 (1.2 em); '、bb' would open row 2 with '、'.
    const rows = wrapTextToWidth('aa 、bb', 3);
    expect(rows[0].startsWith('、')).toBe(false);
    expect(rows.length).toBe(1);
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

  it('kinsoku: closing punctuation never opens a row (ぶら下げ)', () => {
    const rows = wrapTextToLines('あいうえ、おかき', 4);
    expect(rows[0]).toBe('あいうえ、');
    expect(rows[1]).toBe('おかき');
  });

  it('kinsoku: an open bracket never ends a row (追い出し)', () => {
    const rows = wrapTextToLines('あいう「かきく', 4);
    expect(rows).toEqual(['あいう', '「かきく']);
  });
});

describe('grapheme-cluster integrity (UAX #29)', () => {
  it('never severs a combining mark from its base (NFD input)', () => {
    const { wrapTextToWidth } = require('../src/vr/ui/textWrap.js');
    const nfd = 'か\u3099'.repeat(6); // が decomposed × 6
    const rows = wrapTextToWidth(nfd, 3);
    for (const row of rows) {
      // Every row must contain whole clusters — no orphaned combining dakuten.
      expect(row).toMatch(/^(か\u3099)+$/);
    }
    expect(rows.join('')).toBe(nfd);
  });

  it('never severs a flag or ZWJ emoji sequence', () => {
    const { wrapTextToWidth } = require('../src/vr/ui/textWrap.js');
    const flag = '🇯🇵'.repeat(4); // regional-indicator pairs
    for (const row of wrapTextToWidth(flag, 3)) {
      expect(row).toMatch(/^(🇯🇵)+$/);
    }
    const family = '👨‍👩‍👧'.repeat(4); // ZWJ sequence
    for (const row of wrapTextToWidth(family, 3)) {
      expect(row).toMatch(/^(👨‍👩‍👧)+$/);
    }
  });

  it('truncateToWidth keeps clusters whole before the ellipsis', () => {
    const { truncateToWidth } = require('../src/vr/ui/textWrap.js');
    const out = truncateToWidth('か\u3099'.repeat(10), 3);
    expect(out).toMatch(/^(か\u3099)+…$/);
  });

  it('wrapTextToLines splits on cluster boundaries too', () => {
    const rows = wrapTextToLines('か\u3099'.repeat(6), 4); // 2 cps per cluster
    for (const row of rows) {
      expect(row).toMatch(/^(か\u3099)+$/);
    }
  });
});

describe('wrapTextToLines — long-word split flushes the pending row first', () => {
  test('an over-long word pushes the accumulated row before splitting', () => {
    // 'ab' sits in cur when 'cdefg' (5 > 3) needs splitting → 232-233 arm
    expect(wrapTextToLines('ab cdefg', 3)).toEqual(['ab', 'cde', 'fg']);
  });
});

describe('textWrap — complementary arms', () => {
  test('CJK characters measure wider than ASCII', () => {
    const { charWidthEm } = require('../src/vr/ui/textWrap.js');
    expect(charWidthEm('あ'.codePointAt(0))).toBeGreaterThan(charWidthEm('a'.codePointAt(0)));
    expect(charWidthEm('中'.codePointAt(0))).toBeGreaterThan(charWidthEm('a'.codePointAt(0)));
  });

  test('wrapTextToWidth with NaN/zero maxEm falls back to 1', () => {
    const { wrapTextToWidth } = require('../src/vr/ui/textWrap.js');
    expect(Array.isArray(wrapTextToWidth('a b c', NaN))).toBe(true);
    expect(Array.isArray(wrapTextToWidth('a b c', 0))).toBe(true);
  });

  test('wrapTextToWidth on null/undefined text returns empty rows', () => {
    const { wrapTextToWidth } = require('../src/vr/ui/textWrap.js');
    expect(wrapTextToWidth(null, 10).join('')).toBe('');
    expect(wrapTextToWidth(undefined, 10).join('')).toBe('');
  });

  test('truncateToWidth with null text returns empty string', () => {
    const { truncateToWidth } = require('../src/vr/ui/textWrap.js');
    expect(truncateToWidth(null, 10)).toBe('');
  });
});

describe('textWrap — width/lines sliver arms', () => {
  test('truncateToWidth clips CJK glyphs by em budget', () => {
    const { truncateToWidth } = require('../src/vr/ui/textWrap.js');
    const out = truncateToWidth('あいうえおかきくけこ', 3);
    expect(out.endsWith('…')).toBe(true);
    expect(truncateToWidth('hi', 10)).toBe('hi');
    expect(truncateToWidth(null, 5)).toBe('');
  });

  test('wrapTextToLines splits long words at code-point boundaries', () => {
    const { wrapTextToLines } = require('../src/vr/ui/textWrap.js');
    expect(wrapTextToLines('', 5)).toEqual(['']);
    const rows = wrapTextToLines('abcdefghij', 4);
    expect(rows.every((r) => Array.from(r).length <= 4)).toBe(true);
  });
});

describe('textWrap — remaining wide-char ranges', () => {
  test('Hangul syllables, Yi, compat ideographs, vertical and fullwidth forms are wide', () => {
    expect(charWidthEm(0xac00)).toBe(1); // 한 Hangul syllable
    expect(charWidthEm(0xa000)).toBe(1); // Yi syllable
    expect(charWidthEm(0xf900)).toBe(1); // CJK compat ideograph
    expect(charWidthEm(0xfe10)).toBe(1); // vertical form
    expect(charWidthEm(0xfe30)).toBe(1); // CJK compat form
    expect(charWidthEm(0xff21)).toBe(1); // Ａ fullwidth A
    expect(charWidthEm(0xffe5)).toBe(1); // ￥ fullwidth sign
    expect(charWidthEm(0x2e80)).toBe(1); // CJK radical
    expect(charWidthEm(0x3400)).toBe(1); // CJK Ext A
    expect(charWidthEm(0x20000)).toBe(1); // 𠀀 CJK Ext B
    expect(charWidthEm(0x30000)).toBe(1); // 𰀀 CJK Ext G
  });
});
