import {
  charWidthEm,
  textWidthEm,
  wrapTextToWidth,
  safeMeasureEm,
  truncateToWidth,
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

describe('textWidthEm — cluster-aware widths (measured NFD/emoji overcount)', () => {
  test('combining marks, variation selectors and format chars cost no width', () => {
    // Code-point sums measured ink that never renders: ゙ (U+3099) sits inside
    // the kana range and scored a whole em; a ZWSP added 0.6 for nothing.
    expect(charWidthEm(0x3099)).toBe(0);   // combining dakuten — inside kana block
    expect(charWidthEm(0x309a)).toBe(0);   // combining handakuten
    expect(charWidthEm(0x0301)).toBe(0);   // combining acute accent
    expect(charWidthEm(0x20e3)).toBe(0);   // combining enclosing keycap
    expect(charWidthEm(0xfe0f)).toBe(0);   // VS16
    expect(charWidthEm(0xe0100)).toBe(0);  // VS supplement
    expect(charWidthEm(0x200d)).toBe(0);   // ZWJ
    expect(charWidthEm(0x200c)).toBe(0);   // ZWNJ
    expect(charWidthEm(0x200b)).toBe(0);   // ZWSP
    expect(charWidthEm(0x00ad)).toBe(0);   // soft hyphen
    expect(charWidthEm(0xfeff)).toBe(0);   // BOM / ZWNBSP
    expect(charWidthEm(0xe0020)).toBe(0);  // tag char (subdivision flags)
    expect(charWidthEm(0x202e)).toBe(0);   // bidi override
    expect(textWidthEm('a​b')).toBeCloseTo(2 * HALFWIDTH_EM); // a ZWSP b
    expect(textWidthEm('x️y')).toBeCloseTo(2 * HALFWIDTH_EM); // VS16 invisible on non-emoji
  });

  test('measures per grapheme: NFD kana, flags, ZWJ sequences, conjoined jamo', () => {
    // Pre-fix measured values (code-point sums): NFD が 2 for 1 em of ink,
    // 👨‍👩‍👧 5.1 for ~1.3, 🇯🇵 1.2 (RI sits below the emoji range), 한 2.2
    // for a single 1-em syllable block.
    expect(textWidthEm('が')).toBe(1);
    expect(textWidthEm('👨‍👩‍👧')).toBe(EMOJI_EM);
    expect(textWidthEm('🇯🇵')).toBe(EMOJI_EM);
    expect(charWidthEm(0x1f1ef)).toBe(EMOJI_EM); // regional indicator J — Wide per UAX #11
    expect(charWidthEm(0x1f1f5)).toBe(EMOJI_EM); // regional indicator P
    expect(textWidthEm('한')).toBe(1);
  });

  test('NFD Japanese wraps at the same grapheme count as NFC', () => {
    // macOS paste favours NFD; the 2× inflated word width wrapped it at half
    // the glyphs a reader actually sees.
    const nfd = 'が'.normalize('NFD').repeat(40);
    const rows = wrapTextToWidth(nfd, 34);
    expect(rows).toEqual([
      'が'.normalize('NFD').repeat(34),
      'が'.normalize('NFD').repeat(6)
    ]);
  });

  test('NFD text joins prior words on the same row instead of overflowing early', () => {
    // 'ab'(1.2)+space(0.5)+'が'×10: pre-fix measured the word at 20 em and
    // refused the join (1.2+0.5+20 > 15 → two rows); post-fix measures the
    // rendered 10 em and joins into one.
    const nfd = 'が'.normalize('NFD').repeat(10);
    expect(wrapTextToWidth(`ab ${nfd}`, 15)).toEqual([`ab ${nfd}`]);
  });

  test('truncateToWidth passes NFD text that fits instead of halving it', () => {
    // The fit check scored 'が'×10 as 20 em and truncated at a 15 budget —
    // the string renders 10 em and already fits.
    const nfd = 'が'.repeat(10);
    expect(truncateToWidth(nfd, 15)).toBe(nfd);
  });

  test('a ZWJ-emoji word still splits on cluster boundaries when too wide', () => {
    const rows = wrapTextToWidth('👨‍👩‍👧'.repeat(4), 3);
    for (const row of rows) {
      expect(row).toMatch(/^(👨‍👩‍👧)+$/);
    }
  });
});
