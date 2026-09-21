/**
 * JapaneseIME conversion arms — katakana mode, trailing-n, buffer flush.
 * (Keyboard-level behaviors live in vr-keyboard-candidates/suggestions.)
 */
const { JapaneseIME } = require('../src/vr/input/JapaneseIME.js');

describe('JapaneseIME raw conversion arms', () => {
  test('convertRomajiToHiragana maps syllables and handles trailing lone n', () => {
    const ime = new JapaneseIME();
    expect(ime.convertRomajiToHiragana('konnichiwa')).toBe('こんにちわ'); // literal wa->わ (particles use 'ha')
    expect(ime.convertRomajiToHiragana('kon')).toBe('こん'); // trailing n -> ん
  });

  test('katakana mode: processInput converts romaji through hiragana to katakana', async () => {
    const ime = new JapaneseIME();
    ime.activate();
    ime.inputMode = 'katakana';
    for (const ch of 'konnichiwa') await ime.processInput(ch);
    // The converted text is surfaced via the composition path; assert the
    // two-hop conversion itself.
    const hira = ime.convertRomajiToHiragana(ime.compositionBuffer);
    expect(ime.convertHiraganaToKatakana(hira)).toBe('コンニチワ');
  });

  test('an unmatched long buffer flushes its first char as-is instead of swallowing it', () => {
    const ime = new JapaneseIME();
    expect(ime.convertRomajiToHiragana('xyzq')).toContain('x');
  });

  test('processInput counts typed characters in stats', async () => {
    const ime = new JapaneseIME();
    ime.activate();
    await ime.processInput('k');
    await ime.processInput('a');
    expect(ime.getState().stats.charactersTyped).toBe(2);
  });
});

describe('kunrei-shiki (JIS-style) romanization — Japanese users type si/ti/tu/hu', () => {
  const ime = new JapaneseIME();
  test.each([
    ['si', 'し'], ['ti', 'ち'], ['tu', 'つ'], ['hu', 'ふ'], ['zi', 'じ'],
    ['sya', 'しゃ'], ['syu', 'しゅ'], ['syo', 'しょ'],
    ['tya', 'ちゃ'], ['tyu', 'ちゅ'], ['tyo', 'ちょ'],
    ['zya', 'じゃ'], ['zyu', 'じゅ'], ['zyo', 'じょ'],
    ['cya', 'ちゃ'], ['cyu', 'ちゅ'], ['cyo', 'ちょ'],
    ['tyokoreeto', 'ちょこれえと'], ['sigoto', 'しごと']
  ])('%s => %s', (romaji, expected) => {
    expect(ime.convertRomajiToHiragana(romaji)).toBe(expected);
  });
});

describe('JapaneseIME — deleteLast katakana arm + getStats', () => {
  test('deleteLast converts through katakana when inputMode is katakana', () => {
    const ime = new JapaneseIME();
    ime.inputMode = 'katakana';
    ime.compositionBuffer = 'kana';
    const r = ime.deleteLast();
    expect(r.mode).toBe('katakana');
    expect(r.raw).toBe('kan');
    expect(r.converted).toBe('カン');
  });
});

describe('JapaneseIME — remaining branch arms (fallbacks)', () => {
  test('getOfflineKanjiCandidates falls back to [hiragana] for a word outside the dict', () => {
    const ime = new JapaneseIME();
    expect(ime.getOfflineKanjiCandidates('ぬぬぬ')).toEqual(['ぬぬぬ']);
    expect(ime.getOfflineKanjiCandidates('かみ')).toEqual(['神', '紙', '髪', '上']);
  });

  test('suggestionLabel: empty hostname falls back to the raw URL; unparseable hits the catch arm', () => {
    const { suggestionLabel } = require('../src/vr/input/JapaneseIME.js');
    // 'about:blank' parses but has an empty hostname → `|| url` arm.
    expect(suggestionLabel({ url: 'about:blank' })).toBe('about:blank');
    // Unparseable → catch → truncateToWidth(raw url).
    expect(suggestionLabel({ url: ':::bad' })).toBe(':::bad');
    expect(suggestionLabel(null)).toBe('');
    expect(suggestionLabel({ title: 'タイトル', url: 'https://x' })).toBe('タイトル');
    expect(suggestionLabel({ url: 'https://example.com/path' })).toBe('example.com');
  });

  test('processInput/deleteLast convert through the katakana path', async () => {
    const ime = new JapaneseIME();
    ime.inputMode = 'katakana';
    const r = await ime.processInput('ka');
    expect(r.converted).toBe('カ');
    ime.inputMode = 'hiragana';
    const r2 = await ime.processInput('n');
    expect(r2.converted).toContain('ん');
  });
});
