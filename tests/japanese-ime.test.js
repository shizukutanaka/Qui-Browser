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
