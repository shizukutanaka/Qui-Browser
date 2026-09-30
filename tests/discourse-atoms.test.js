/**
 * Discourse/colloquial atoms (round 68).
 *
 * Probe-driven: social acknowledgements ('ありがとう', 'わかった', 'OK',
 * 'got it'), corrections ('違う', '間違えた', 'そうじゃない'), dismissals
 * ('もういい', '結構です', 'ほっといて'), colloquial request forms
 * ('閉じてもいい', '閉じたいんだけど', '閉じちゃって', '閉じといて',
 * '閉じたまえ'), discourse/urgency prefixes ('えっと閉じて',
 * '今すぐ閉じて', 'ちょっと閉じて'), and EN casual wrappers ('i wanna',
 * 'let me', 'ok go back') all answered 認識できませんでした. And
 * 'どうやって戻る' — a HOW question — actually navigated back.
 */

let VoiceCommands;
try { VoiceCommands = require('../src/vr/input/VoiceCommands').VoiceCommands; }
catch { VoiceCommands = null; }

function makeVC() {
  const spoken = [];
  const tm = {
    tabs: [
      { id: 'a', currentUrl: 'https://news.jp', currentTitle: 'ニュース', pinned: false, goBack: jest.fn(() => true), goForward: jest.fn(() => true) },
      { id: 'b', currentUrl: 'https://weather.jp', currentTitle: '天気', pinned: false },
    ],
    activeIndex: 0,
    setActive: jest.fn(function (i) { this.activeIndex = i; }),
    getActiveTab: jest.fn(function () { return this.tabs[this.activeIndex]; }),
    closeTab: jest.fn(function (i) { return !this.tabs[i].pinned; }),
    newTab: jest.fn(() => ({ id: 'new' })),
  };
  const vc = new VoiceCommands({ enabled: true });
  vc.onGoTo = jest.fn();
  vc.connectBrowser({ tabManager: tm, onGoTo: vc.onGoTo });
  vc.speak = jest.fn((s) => spoken.push(s));
  vc._spoken = spoken;
  vc._tm = tm;
  return vc;
}
const run = (vc, phrase) => vc.processCommand(phrase);
const key = (vc) => vc.lastCommand?.key;
const last = (vc) => vc._spoken[vc._spoken.length - 1] || '';

describe('ack atom (social acknowledgement)', () => {
  test.each(['ありがとう', 'ありがとうございます', 'ありがと', 'サンキュー',
    'thank you', 'thanks'])('thanks "%s" gets どういたしまして', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('ack');
    expect(last(vc)).toBe('どういたしまして');
  });
  test.each(['わかった', 'わかりました', '了解', 'りょうかい', 'OK', 'オーケー',
    'got it', 'understood'])('confirm "%s" gets 承知しました', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('ack');
    expect(last(vc)).toBe('承知しました');
  });
});

describe('negate atom — corrections & dismissals', () => {
  test.each(['違う', 'そうじゃない', 'そうじゃなくて', '間違えた', '間違い', 'ちがう',
    'ええよ', 'もういい', 'いいよ', 'いいから', 'もういいから', '結構です',
    'もう結構', '大丈夫です', 'もう大丈夫', 'いらない', 'もういらない',
    'ほっといて', '放っといて', 'そのままで', 'そのまま',
    'leave it', 'leave it be', 'keep it'])(
    '"%s" acknowledges without acting', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('negate');
      expect(last(vc)).toContain('実行しません');
      expect(vc._tm.closeTab).not.toHaveBeenCalled();
      expect(vc._tm.newTab).not.toHaveBeenCalled();
      expect(vc.onGoTo).not.toHaveBeenCalled();
    });
});

describe('colloquial request forms', () => {
  test.each(['閉じてもいい', '閉じていいかな', '閉じてもいいかな', '閉じたい',
    '閉じたいんだけど', '閉じちゃって', '閉じといて', '閉じといてね', '閉じたまえ'])(
    '"%s" closes the tab', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('close-tab');
      expect(vc._tm.closeTab).toHaveBeenCalledWith(0);
    });
  test.each(['今すぐ閉じて', 'すぐ閉じて', 'ちょっと閉じて', 'とりあえず閉じて',
    '一応閉じて', 'えっと閉じて', 'あの閉じて'])(
    '"%s" closes the tab (prefix strip)', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('close-tab');
      expect(vc._tm.closeTab).toHaveBeenCalledWith(0);
    });
  test('"何が開いてるかな" reads the tab list (かな tail)', () => {
    const vc = makeVC();
    run(vc, '何が開いてるかな');
    expect(key(vc)).toBe('tabs-list');
  });
});

describe('EN casual wrappers', () => {
  test.each(['i want to close', 'i wanna go back', "i'm gonna close the tab",
    'let me close the tab', 'ok go back', 'now go back', 'so close it'])(
    '"%s" unwraps to a real command', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).not.toBeUndefined();
      expect(last(vc)).not.toContain('認識できません');
    });
  test('"i want to close" closes the tab', () => {
    const vc = makeVC();
    run(vc, 'i want to close');
    expect(key(vc)).toBe('close-tab');
    expect(vc._tm.closeTab).toHaveBeenCalledWith(0);
  });
});

describe('how-questions route to help, not navigation', () => {
  test.each(['どうやって戻る', 'どうやって進む', 'どうすればいい', 'なんとかして',
    'how do i go back'])('"%s" → help (no navigation)', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('help');
    expect(vc._tm.getActiveTab().goBack).not.toHaveBeenCalled();
    expect(vc._tm.getActiveTab().goForward).not.toHaveBeenCalled();
    expect(vc.onGoTo).not.toHaveBeenCalled();
  });
});

describe('coexistence guards', () => {
  test('bare 戻る/進む still navigate', () => {
    const vc = makeVC();
    run(vc, '戻る');
    expect(key(vc)).toBe('back');
    run(vc, '進む');
    expect(key(vc)).toBe('navigate');
  });
  test('"読まないで" still stops narration (not negate)', () => {
    const vc = makeVC();
    run(vc, '読まないで');
    expect(key(vc)).toBe('stop-reading');
  });
  test('"待って" still pauses reading', () => {
    const vc = makeVC();
    run(vc, '待って');
    expect(key(vc)).toBe('pause-reading');
  });
  test('"閉じてよ" still closes via particle strip', () => {
    const vc = makeVC();
    run(vc, '閉じてよ');
    expect(key(vc)).toBe('close-tab');
    expect(vc._tm.closeTab).toHaveBeenCalledWith(0);
  });
  test('"痛い" stays NO-MATCH (たい strip must not fabricate commands)', () => {
    const vc = makeVC();
    run(vc, '痛い');
    expect(last(vc)).toContain('認識できません');
  });
});
