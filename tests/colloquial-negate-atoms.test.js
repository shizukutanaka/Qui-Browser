/**
 * Colloquial/imperative/negate atoms (round 67).
 *
 * Probe-driven: the 〜てよ/てね/てな sentence-final particle family was a
 * systematic NO-MATCH across every command ('閉じてよ', '進んでよ',
 * '教えてよ'…), imperative stems ('閉じろ', '読め', '黙れ', '早くしろ')
 * were unrecognized, and negative requests ('閉じないで',
 * 'やめておいて', 'never mind') answered with the recognition error even
 * though they ask for NO action.
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
    closeAllTabs: jest.fn(() => 1),
    newTab: jest.fn(() => ({ id: 'new' })),
  };
  const vc = new VoiceCommands({ enabled: true });
  vc.onGoTo = jest.fn();
  vc._onVolume = jest.fn();
  vc._onMute = jest.fn(() => true);
  vc._onSettingToggle = jest.fn(() => false);
  vc.connectBrowser({ tabManager: tm, onGoTo: vc.onGoTo });
  vc.speak = jest.fn((s) => spoken.push(s));
  vc._spoken = spoken;
  vc._tm = tm;
  return vc;
}
const run = (vc, phrase) => vc.processCommand(phrase);
const key = (vc) => vc.lastCommand?.key;
const last = (vc) => vc._spoken[vc._spoken.length - 1] || '';

describe('sentence-final particle strip (〜てよ/てね/てな)', () => {
  test.each(['閉じてよ', '閉じてね', '閉じてな'])('"%s" closes the tab', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('close-tab');
    expect(vc._tm.closeTab).toHaveBeenCalledWith(0);
  });
  test.each([['進んでよ', 'navigate'], ['戻ってよ', 'back'], ['見せてよ', 'tabs-list'],
    ['教えてよ', 'help'], ['読んでよ', 'read-aloud']])(
    '"%s" routes to %s after the particle strip', (p, k) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe(k);
    });
});

describe('imperative stems', () => {
  test.each(['閉じろ', '消えろ', 'とじろ'])('"%s" closes the tab', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('close-tab');
    expect(vc._tm.closeTab).toHaveBeenCalledWith(0);
  });
  test.each(['読め', '読み上げろ'])('"%s" reads aloud', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('read-aloud');
  });
  test.each(['黙れ', '黙って', 'だまって', 'うるさいから止めて'])(
    '"%s" stops the narration', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('stop-reading');
    });
  test.each([['早くしろ', 'speech-faster'], ['速くしろ', 'speech-faster'],
    ['遅くしろ', 'speech-slower'], ['ゆっくりしろ', 'speech-slower']])(
    '"%s" adjusts speech rate via %s', (p, k) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe(k);
    });
  test('"静かにしろ" lowers volume (not narration stop)', () => {
    const vc = makeVC();
    run(vc, '静かにしろ');
    expect(key(vc)).toBe('volume-down');
    expect(vc._onVolume).toHaveBeenCalledWith(-0.1);
  });
  test.each(['音消して', '声を消して'])('"%s" toggles mute', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('mute-toggle');
    expect(vc._onMute).toHaveBeenCalled();
  });
  test.each(['字幕消して', 'キャプション消して', '字幕出して', 'キャプション出して'])(
    '"%s" toggles captions directionally', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('captions-toggle');
      expect(vc._onSettingToggle).toHaveBeenCalled();
    });
});

describe('negate atom', () => {
  // 'cancel that' is already owned by stop-everything (a cancel IS a stop).
  test.each(['閉じないで', '消さないで', '進まないで', 'やめておいて', 'やめといて',
    'しなくていい', 'なくていい', 'never mind', 'forget it', "don't do that"])(
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

describe('question/に-form atoms', () => {
  test.each(['何が開いてる', '何が開いてますか', 'ぜんぶのタブ', 'すべてのタブは'])(
    '"%s" reads the tab list', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('tabs-list');
      expect(last(vc)).toContain('ニュース');
    });
  test.each(['どこにいるの', '今どこにいるの', 'どこだっけ'])(
    '"%s" answers where-am-i', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('where-am-i');
      expect(last(vc)).toContain('ニュース');
    });
  test.each(['どんなサイト', 'どんなタブ'])('"%s" describes the tab', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('describe-tab');
  });
});

describe('coexistence guards', () => {
  test('"読まないで" still stops narration (not negate)', () => {
    const vc = makeVC();
    run(vc, '読まないで');
    expect(key(vc)).toBe('stop-reading');
  });
  test('"聞かないで" stops listening via stop (not negate)', () => {
    const vc = makeVC();
    run(vc, '聞かないで');
    expect(key(vc)).toBe('stop');
  });
  test('"ニュースのタブ" still switches by name', () => {
    const vc = makeVC();
    run(vc, 'ニュースのタブ');
    expect(key(vc)).toBe('tab-by-name');
  });
  test('bare "mute" still toggles, "mute the mic" still stops', () => {
    const vc = makeVC();
    run(vc, 'mute');
    expect(key(vc)).toBe('mute-toggle');
    run(vc, 'mute the mic');
    expect(key(vc)).toBe('stop');
  });
});

describe('prohibitive 〜るな is not stripped into a command', () => {
  test.each(['閉じるな', 'タブを閉じるな'])('"%s" does not close the tab', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(vc._tm.closeTab).not.toHaveBeenCalled();
  });
});
