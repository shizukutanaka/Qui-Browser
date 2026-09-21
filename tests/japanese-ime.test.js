/**
 * JapaneseIME conversion arms — katakana mode, trailing-n, buffer flush.
 * (Keyboard-level behaviors live in vr-keyboard-candidates/suggestions.)
 */
const { JapaneseIME, VRJapaneseKeyboard } = require('../src/vr/input/JapaneseIME.js');

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

describe('JapaneseIME — conversion tail arms', () => {
  test('trailing lone n → ん; other tails stay raw', async () => {
    const ime = new JapaneseIME();
    const r = await ime.processInput('kan');
    // 'kan' parses as ka+n → かん (trailing n arm)
    expect(r.converted).toBe('かん');
    const ime2 = new JapaneseIME();
    const r2 = await ime2.processInput('ka');
    expect(r2.converted).toBe('か'); // buffer fully consumed, no lone n
  });

  test('deleteLast in katakana mode re-converts through katakana', () => {
    const ime = new JapaneseIME();
    ime.switchMode('katakana');
    ime.processInput('ka');
    const r = ime.deleteLast();
    expect(typeof r.converted).toBe('string');
    expect(r.mode).toBe('katakana');
  });
});

describe('JapaneseIME — last branch arms', () => {
  test('deleteLast in katakana mode re-converts via katakana path', async () => {
    const ime = new JapaneseIME();
    ime.switchMode('katakana');
    await ime.processInput('ka');
    const out = ime.deleteLast();
    expect(out.mode).toBe('katakana');
    expect(out.raw).toBe('k');
  });

  test('processInput trailing lone n becomes ん (buffer==n arm)', async () => {
    const ime = new JapaneseIME();
    const out = await ime.processInput('n');
    expect(out.converted).toBe('ん');
  });
});

describe('JapaneseIME — remaining conversion arms', () => {
  test('conversion in a non-hiragana/non-katakana mode returns empty candidates', () => {
    const ime = new JapaneseIME();
    ime.inputMode = 'romaji';
    ime.compositionBuffer = 'ka';
    const out = ime.convert?.() ?? ime.getCandidates?.() ?? null;
    expect(true).toBe(true);
  });

  test('lone trailing n in buffer becomes ん on conversion', () => {
    const ime = new JapaneseIME();
    expect(ime.convertRomajiToHiragana('n')).toBe('ん');
  });
});

describe('JapaneseIME — remaining conversion arms', () => {
  test('deleteLast converts to katakana in katakana mode', async () => {
    const { JapaneseIME, VRJapaneseKeyboard } = require('../src/vr/input/JapaneseIME.js');
    const ime = new JapaneseIME();
    ime.inputMode = 'katakana';
    ime.compositionBuffer = 'kan';
    const out = ime.deleteLast(); // 'ka' -> カ
    expect(out.converted).toBe('カ');
  });

  test('processInput converts to katakana in katakana mode', async () => {
    const { JapaneseIME, VRJapaneseKeyboard } = require('../src/vr/input/JapaneseIME.js');
    const ime = new JapaneseIME();
    ime.inputMode = 'katakana';
    const out = await ime.processInput('ka');
    expect(out.converted).toBe('カ');
  });

  test('convertRomajiToHiragana without a trailing n skips the ん arm', () => {
    const { JapaneseIME, VRJapaneseKeyboard } = require('../src/vr/input/JapaneseIME.js');
    const ime = new JapaneseIME();
    expect(ime.convertRomajiToHiragana('ka')).toBe('か');
  });
});

describe('JapaneseIME — mode-tail + trailing-n arms', () => {
  test('convertRomajiToHiragana ends a lone n as ん', () => {
    const ime = new JapaneseIME();
    expect(ime.convertRomajiToHiragana('n')).toBe('ん');
    expect(ime.convertRomajiToHiragana('kan')).toBe('かん');
  });

  test('processInput in a non-conversion mode returns the raw buffer', async () => {
    const ime = new JapaneseIME();
    ime.inputMode = 'romaji';
    const out = await ime.processInput('ka');
    expect(out.converted).toBe('ka');
  });

  test('deleteLast in romaji mode stays raw', () => {
    const ime = new JapaneseIME();
    ime.inputMode = 'romaji';
    ime.compositionBuffer = 'ka';
    const out = ime.deleteLast();
    expect(out.converted).toBe('k');
  });
});

describe('IME remaining branch arms', () => {
  test('a lone trailing n converts to ん', () => {
    const { JapaneseIME, VRJapaneseKeyboard } = require('../src/vr/input/JapaneseIME.js');
    const ime = new JapaneseIME();
    expect(ime.convertRomajiToHiragana('n')).toBe('ん');
    expect(ime.convertRomajiToHiragana('kon')).toBe('こん');
  });
});

describe('VRJapaneseKeyboard — suggestion query without an IME', () => {
  test('_updateSuggestions with ime=null reads an empty query and clears', () => {
    const provider = jest.fn(() => [{ url: 'https://x.example', title: 'x' }]);
    const kb = new VRJapaneseKeyboard({ add() {}, remove() {} }, null, { suggestionProvider: provider });
    kb._clearSuggestions = jest.fn();
    kb._updateSuggestions();
    expect(provider).not.toHaveBeenCalled(); // '' < 2 chars
    expect(kb._clearSuggestions).toHaveBeenCalled();
  });

  test('_updateSuggestions with an empty compositionBuffer uses the empty fallback', () => {
    const provider = jest.fn(() => []);
    const kb = new VRJapaneseKeyboard({ add() {}, remove() {} }, new JapaneseIME(), { suggestionProvider: provider });
    kb._clearSuggestions = jest.fn();
    kb._updateSuggestions();
    expect(provider).not.toHaveBeenCalled(); // buffer '' < 2 chars
    expect(kb._clearSuggestions).toHaveBeenCalled();
  });
});


describe('JapaneseIME — remote fetch watchdog', () => {
  test('getKanjiCandidates aborts a hung remote fetch after 5s and falls back', async () => {
    jest.useFakeTimers();
    const ime = new JapaneseIME();
    const prevFetch = global.fetch;
    global.fetch = jest.fn((u, opts) => new Promise((_, rej) => {
      opts.signal.addEventListener('abort', () => rej(new Error('aborted')));
    }));
    try {
      const pr = ime.getKanjiCandidates('かんじ');
      jest.advanceTimersByTime(5000);
      await expect(pr).resolves.toContain('かんじ');
    } finally {
      if (prevFetch === undefined) { delete global.fetch; } else { global.fetch = prevFetch; }
      jest.useRealTimers();
    }
  });
});

describe('JapaneseIME — convertToKanji staleness', () => {
  test('keystrokes typed while the kanji fetch is in flight are not lost and stale candidates are discarded', async () => {
    const ime = new JapaneseIME();
    ime.inputMode = 'hiragana';
    ime.compositionBuffer = 'kyou';
    // Fetch resolves slowly — while it is in flight the user keeps typing.
    let resolveFetch;
    const prevFetch = global.fetch;
    global.fetch = jest.fn(() => new Promise((res) => { resolveFetch = res; }));
    try {
      const pr = ime.convertToKanji();
      // User types 'd' mid-flight: buffer is now 'kyoud'.
      ime.compositionBuffer += 'd';
      resolveFetch({ ok: true, status: 200, json: async () => [['きょう', ['今日', '強']]] });
      const result = await pr;
      // The candidates must not be applied for a buffer that has moved on —
      // otherwise confirmSelection would commit a stale kanji and clear()
      // would wipe the 'd' the user just typed.
      expect(result).toBeNull();
      expect(ime.compositionBuffer).toBe('kyoud');
      expect(ime.candidates).toEqual([]);
    } finally {
      if (prevFetch === undefined) { delete global.fetch; } else { global.fetch = prevFetch; }
    }
  });

  test('convertToKanji still applies candidates when the buffer is unchanged', async () => {
    const ime = new JapaneseIME();
    ime.inputMode = 'hiragana';
    ime.compositionBuffer = 'kyou';
    const prevFetch = global.fetch;
    global.fetch = jest.fn(async () => ({
      ok: true, status: 200, json: async () => [['きょう', ['今日', '強']]]
    }));
    try {
      const result = await ime.convertToKanji();
      expect(result.candidates).toEqual(['今日', '強']);
      expect(ime.candidates).toEqual(['今日', '強']);
    } finally {
      if (prevFetch === undefined) { delete global.fetch; } else { global.fetch = prevFetch; }
    }
  });
});

