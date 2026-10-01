/**
 * Verb/status atoms (round 78): る-form volume verbs, explicit caption
 * show/hide forms (with want-detection — '字幕を表示' must request ON, not
 * blind-toggle), narration position queries ('今の文'/'今の行'/'今の段落'),
 * help discoverability ('コマンドは'/'操作方法は'), history-depth complaint
 * forms ('もう戻れない'/'これ以上進めない'), existence queries ('履歴はある'),
 * performance complaints (trouble) + '読むのが遅い' → speech-faster.
 */
const VC = require('../src/vr/input/VoiceCommands').VoiceCommands;

function makeVC() {
  const vc = new VC({ enabled: true });
  const tm = {
    tabs: [{ currentTitle: 't', currentUrl: 'u', pinned: false, history: ['a', 'b'], historyIdx: 1 }],
    activeIndex: 0,
    getActiveTab() {
      return this.tabs[this.activeIndex];
    }
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.said = [];
  vc.speak = (s) => vc.said.push(s);
  return vc;
}
const run = (vc, p) => {
  vc.lastCommand = null; vc.processCommand(p); return vc.lastCommand ? vc.lastCommand.key : null;
};

describe('volume る-forms', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['ボリュームを上げる', '音量をあげる', '音量を上げる', '音を上げる', '声を上げる'])(
    '「%s」 raises volume', (p) => {
      const spy = jest.fn();
      vc._onVolume = spy;
      expect(run(vc, p)).toBe('volume-up');
      expect(spy).toHaveBeenCalledWith(0.1);
    });
  test.each(['ボリュームを下げる', '音量をさげる', '音量を下げる', '音を下げる', '声を下げる'])(
    '「%s」 lowers volume', (p) => {
      const spy = jest.fn();
      vc._onVolume = spy;
      expect(run(vc, p)).toBe('volume-down');
      expect(spy).toHaveBeenCalledWith(-0.1);
    });
});

describe('captions explicit show/hide (want-detection)', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['字幕を表示', '字幕を出す', 'キャプション表示', '字幕あり', 'show captions'])(
    '「%s」 requests captions ON', (p) => {
      const spy = jest.fn(() => true);
      vc._onSettingToggle = spy;
      expect(run(vc, p)).toBe('captions-toggle');
      expect(spy).toHaveBeenCalledWith('enableCaptions', true);
    });
  test.each(['字幕を非表示', '字幕なし', 'キャプションなし', 'hide captions', '字幕を消す', '字幕を消して'])(
    '「%s」 requests captions OFF', (p) => {
      const spy = jest.fn(() => false);
      vc._onSettingToggle = spy;
      expect(run(vc, p)).toBe('captions-toggle');
      expect(spy).toHaveBeenCalledWith('enableCaptions', false);
    });
  test('字幕をオン still ON / キャプションをオフ still OFF (regression)', () => {
    const spy = jest.fn(() => true);
    vc._onSettingToggle = spy;
    run(vc, '字幕をオン');
    expect(spy).toHaveBeenCalledWith('enableCaptions', true);
    spy.mockClear();
    run(vc, 'キャプションをオフ');
    expect(spy).toHaveBeenCalledWith('enableCaptions', false);
  });
});

describe('narration position queries', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['今の文', 'この文', '読み上げ中の文', '現在の文章', 'この文章'])(
    '「%s」 reads the current sentence', (p) => {
      expect(run(vc, p)).toBe('read-sentence');
    });
  test.each(['今の行', '読んでるところ', '今読んでるところ'])(
    '「%s」 reports the current line', (p) => {
      expect(run(vc, p)).toBe('line-status');
    });
  test('「今の段落」 reports the current paragraph', () => {
    expect(run(vc, '今の段落')).toBe('paragraph-status');
  });
  test('読み上げ中の行 stays line-status (coexistence)', () => {
    expect(run(vc, '読み上げ中の行')).toBe('line-status');
  });
});

describe('help discoverability', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['コマンドは', 'どんなコマンド', '操作方法は', 'ヘルプは', '命令一覧', '命令を教えて'])(
    '「%s」 opens help', (p) => {
      expect(run(vc, p)).toBe('help');
    });
});

describe('nav possibility complaint forms', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['もう戻れない', 'これ以上戻れない', '戻れるページは', '戻れるかな'])(
    '「%s」 answers back-status without navigating', (p) => {
      const spy = jest.fn();
      const tab = vc._tabManager.getActiveTab();
      tab.goBack = spy;
      expect(run(vc, p)).toBe('back-status');
      expect(spy).not.toHaveBeenCalled();
    });
  test.each(['もう進めない', 'これ以上進めない', '進めるページは', '進めるかな'])(
    '「%s」 answers forward-status without navigating', (p) => {
      const spy = jest.fn();
      const tab = vc._tabManager.getActiveTab();
      tab.goForward = spy;
      expect(run(vc, p)).toBe('forward-status');
      expect(spy).not.toHaveBeenCalled();
    });
});

describe('history existence + performance complaints', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['履歴はある', '履歴はあるか', '履歴を教えて'])(
    '「%s」 reads history list', (p) => {
      expect(run(vc, p)).toBe('history-list');
    });
  test.each(['反応が遅い', '重たい', 'もたつく', '反応が悪い', '動作がもたつく'])(
    '「%s」 is a trouble complaint', (p) => {
      expect(run(vc, p)).toBe('trouble');
    });
  test.each(['読むのが遅い', '読むのが遅すぎる'])(
    '「%s」 speeds up narration', (p) => {
      expect(run(vc, p)).toBe('speech-faster');
    });
});

describe('coexistence guards', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test('戻る still navigates back', () => {
    expect(run(vc, '戻る')).toBe('back');
  });
  test('進んで still navigates forward', () => {
    expect(run(vc, '進んで')).toBe('navigate');
  });
  test('音量を半分 still sets volume to 50', () => {
    const spy = jest.fn(() => 50);
    vc._onVolumeStatus = spy;
    vc._onVolume = jest.fn();
    expect(run(vc, '音量を半分')).toBe('volume-set');
  });
  test('履歴を読んで still reads history', () => {
    expect(run(vc, '履歴を読んで')).toBe('history-list');
  });
  test('ヘルプ still opens help', () => {
    expect(run(vc, 'ヘルプ')).toBe('help');
  });
  test('遅い still a trouble complaint', () => {
    expect(run(vc, '遅い')).toBe('trouble');
  });
});
