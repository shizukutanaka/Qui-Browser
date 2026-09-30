/**
 * Caret-edge & granularity atoms (round 76).
 *
 * Probe-driven: '行頭に戻る'/'一文字戻る'/'単語を戻る'/'頭に戻る' were claimed
 * by back's raw /戻る|戻れ/ (navigated a page back — real harm). Line/sentence/
 * word/char edge phrases ('行頭','文頭','語尾','最初の文字') had no surface;
 * '一行目'/'二行目' (kanji ordinals) didn't parse in read-line-n.
 */

let VoiceCommands;
try {
  VoiceCommands = require('../src/vr/input/VoiceCommands').VoiceCommands;
} catch {
  VoiceCommands = null;
}

function makeVC() {
  const spoken = [];
  const tm = {
    tabs: [{ id: 'a', currentUrl: 'https://news.jp', currentTitle: 'ニュース', pinned: false }],
    activeIndex: 0,
    setActive: jest.fn(function (i) {
      this.activeIndex = i;
    }),
    getActiveTab: jest.fn(function () {
      return this.tabs[this.activeIndex];
    })
  };
  const vc = new VoiceCommands({ enabled: true });
  vc.onGoTo = jest.fn();
  vc.connectBrowser({ tabManager: tm, onGoTo: vc.onGoTo });
  vc.speak = jest.fn((s) => spoken.push(s));
  vc._spoken = spoken;
  return vc;
}
const run = (vc, phrase) => vc.processCommand(phrase);
const key = (vc) => vc.lastCommand?.key;
const last = (vc) => vc._spoken[vc._spoken.length - 1] || '';

describe('caret-edge honest atom', () => {
  test.each(['行頭', '行末', '行頭に戻る', '行の先頭', '行の最後',
    '行の頭から', '行の途中', '行の始まり', '行の終わり',
    '文頭', '文末', '文の先頭', '文の末尾', '文の頭', '文の終わり',
    '段落の先頭', '段落の最後', '段落の頭', '段落の終わり',
    '単語の先頭', '単語の最後', '語頭', '語尾',
    '最初の文字', '最後の文字', '最初の単語', '最後の単語',
    '文字の前', '一文字ずつ',
    'beginning of line', 'end of line', 'word by word',
    'character by character', 'caret to start'])(
    '"%s" explains honestly and points at steppers', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('caret-edge');
      expect(last(vc)).toContain('一文字戻る');
      expect(vc.onGoTo).not.toHaveBeenCalled();
    });
});

describe('char steppers — back-misroute fix', () => {
  test.each(['一文字戻る', '一文字戻って', '一文字前', 'ひと文字戻る',
    'ひと文字前', '前の文字へ', '文字を一つ戻る'])(
    '"%s" steps one char back (no page nav)', (p) => {
      const vc = makeVC();
      const spy = jest.fn(() => ({ char: 'あ' }));
      vc._onCharStep = spy;
      run(vc, p);
      expect(key(vc)).toBe('prev-char');
      expect(spy).toHaveBeenCalledWith(-1);
    });
  test.each(['一文字進んで', '一文字進む', '一文字次', 'ひと文字',
    'ひと文字進んで', '次の文字へ', '一文字ずつ進んで'])(
    '"%s" steps one char forward', (p) => {
      const vc = makeVC();
      const spy = jest.fn(() => ({ char: 'い' }));
      vc._onCharStep = spy;
      run(vc, p);
      expect(key(vc)).toBe('next-char');
      expect(spy).toHaveBeenCalledWith(1);
    });
});

describe('word steppers — back-misroute fix', () => {
  test.each(['単語を戻る', '単語を戻って', '前の単語へ', '一単語戻る',
    '単語を一つ戻る'] )('"%s" steps one word back', (p) => {
    const vc = makeVC();
    const nw = jest.fn(() => ({ word: 'テスト' }));
    vc._tm = null;
    vc._tabManager.getActiveTab = jest.fn(() => ({ nextWord: nw }));
    run(vc, p);
    expect(key(vc)).toBe('prev-word');
    expect(nw).toHaveBeenCalledWith(-1);
  });
  test.each(['単語を進んで', '次の単語へ', '次の単語に', '単語単位',
    '語を飛ばす', '単語を飛ばす', '一単語進んで'])(
    '"%s" steps one word forward', (p) => {
      const vc = makeVC();
      const nw = jest.fn(() => ({ word: 'テスト' }));
      vc._tabManager.getActiveTab = jest.fn(() => ({ nextWord: nw }));
      run(vc, p);
      expect(key(vc)).toBe('next-word');
      expect(nw).toHaveBeenCalledWith(1);
    });
});

describe('indexed/edge reader lines', () => {
  test.each(['一行目', '二行目', '五行目', '3行目'])(
    '"%s" routes to reader-goto-line (kanji ordinals)', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('reader-goto-line');
    });
  test.each(['最終行', '最後の行目'])('"%s" reads the last line', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('last-line');
  });
});

describe('scroll edge additions', () => {
  test.each(['頭に戻る', '先頭に飛んで', '頭まで戻る', 'トップに飛んで'])(
    '"%s" scrolls to top', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('scroll-top');
    });
  test.each(['末尾に飛んで', '末端まで', '末端に飛んで', '最後まで飛んで'])(
    '"%s" scrolls to bottom', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('scroll-bottom');
    });
  test.each(['spell that', 'spell this'])('"%s" spells the word', (p) => {
    const vc = makeVC();
    vc._onSpellWord = jest.fn(() => ({ spelled: 'a-b-c' }));
    run(vc, p);
    expect(key(vc)).toBe('spell-word');
  });
});

describe('coexistence guards', () => {
  test.each([['戻る', 'back'], ['戻って', 'back'], ['一つ戻って', 'back'],
    ['先頭に戻る', 'scroll-top'], ['最初の段落', 'first-paragraph'],
    ['最後の段落', 'last-paragraph'], ['次の文字', 'next-char'],
    ['次の単語', 'next-word'], ['末尾まで', 'scroll-bottom']])(
    '"%s" stays with %s', (p, want) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe(want);
    });
});
