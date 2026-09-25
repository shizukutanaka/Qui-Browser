/**
 * Round 42 atoms — open-tab-n misroute fix, position-query stoplist,
 * loading-status, bookmark-latest, heading-count, volume/zoom/alias coverage.
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

global.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(t) {
  this.text = t;
};

function tab(title, url, extra = {}) {
  return {
    currentTitle: title, currentUrl: url, pinned: false, loading: false,
    headingHere: jest.fn(() => ({ index: 1, total: 7, text: 'h' })),
    ...extra
  };
}

function makeVC(opts = {}) {
  const vc = new VoiceCommands();
  const spoken = [];
  vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: () => {}, speaking: false };
  const tabs = opts.tabs || [opts.panel || tab('ニュース', 'https://news.jp')];
  const state = { activeIndex: opts.activeIndex ?? 0 };
  const tabManager = opts.tabManager === undefined ? {
    tabs,
    get activeIndex() { return state.activeIndex; },
    setActive: jest.fn((i) => { state.activeIndex = i; }),
    getActiveTab: () => tabs[state.activeIndex],
    previousActiveIndex: () => 0
  } : opts.tabManager;
  const goTo = jest.fn();
  vc.connectBrowser({ tabManager, onGoTo: goTo, ...opts });
  return { vc, spoken, tabManager, goTo };
}

describe('open-tab-n misroute fix', () => {
  test('"open tab 2" switches, never navigates', () => {
    const { vc, spoken, tabManager, goTo } = makeVC({
      tabs: [tab('a', 'https://a'), tab('b', 'https://b')]
    });
    vc.processCommand('open tab 2');
    expect(tabManager.setActive).toHaveBeenCalledWith(1);
    expect(goTo).not.toHaveBeenCalled();
    expect(spoken[0]).toContain('タブ2に切り替えました');
  });
  test('"タブ2を開いて" switches', () => {
    const { vc, tabManager, goTo } = makeVC({
      tabs: [tab('a', 'https://a'), tab('b', 'https://b')]
    });
    vc.processCommand('タブ2を開いて');
    expect(tabManager.setActive).toHaveBeenCalledWith(1);
    expect(goTo).not.toHaveBeenCalled();
  });
  test('out of range announces honestly', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('open tab 9');
    expect(spoken).toContain('タブ9はありません');
  });
});

describe('position queries reach tab-status (not name-lookup)', () => {
  test('"何枚目のタブ" answers the strip position', () => {
    const onTabStatus = jest.fn(() => ({ index: 1, total: 3 }));
    const { vc, spoken } = makeVC({ onTabStatus });
    vc.processCommand('何枚目のタブ');
    expect(spoken[0]).toContain('3個のタブの1枚目を表示中');
  });
  test('"現在のタブ番号" answers the strip position', () => {
    const onTabStatus = jest.fn(() => ({ index: 2, total: 4 }));
    const { vc, spoken } = makeVC({ onTabStatus });
    vc.processCommand('現在のタブ番号');
    expect(spoken[0]).toContain('4個のタブの2枚目を表示中');
  });
});

describe('loading-status / bookmark-latest / heading-count', () => {
  test('"読み込み中ですか" answers the flag', () => {
    const { vc, spoken } = makeVC({ panel: tab('n', 'x', { loading: true }) });
    vc.processCommand('読み込み中ですか');
    expect(spoken).toContain('読み込み中です');
    const { vc: vc2, spoken: sp2 } = makeVC({ panel: tab('n', 'x', { loading: false }) });
    vc2.processCommand('is it loading');
    expect(sp2).toContain('読み込みは完了しています');
  });
  test('"最新のブックマーク" reads the newest', () => {
    const onBookmarkList = jest.fn(() => [{ title: '保存したページ', url: 'https://s' }]);
    const { vc, spoken } = makeVC({ onBookmarkList });
    vc.processCommand('最新のブックマーク');
    expect(spoken).toContain('最新のブックマークは「保存したページ」です');
  });
  test('empty bookmarks announces honestly', () => {
    const { vc, spoken } = makeVC({ onBookmarkList: jest.fn(() => []) });
    vc.processCommand('latest bookmark');
    expect(spoken).toContain('ブックマークがありません');
  });
  test('"見出しの数" announces the total', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('見出しの数');
    expect(spoken).toContain('7個の見出しがあります');
  });
  test('no headings announces honestly', () => {
    const { vc, spoken } = makeVC({ panel: tab('n', 'x', { headingHere: jest.fn(() => null) }) });
    vc.processCommand('heading count');
    expect(spoken).toContain('見出しがありません');
  });
});

describe('alias coverage', () => {
  test('"音量を上げて"/"volume up" call the hook', () => {
    const onVolume = jest.fn();
    const { vc } = makeVC({ onVolume });
    vc.processCommand('音量を上げて');
    vc.processCommand('volume up');
    expect(onVolume).toHaveBeenCalledWith(0.1);
    expect(onVolume).toHaveBeenCalledTimes(2);
  });
  test('"volume down" calls the hook', () => {
    const onVolume = jest.fn();
    const { vc } = makeVC({ onVolume });
    vc.processCommand('volume down');
    expect(onVolume).toHaveBeenCalledWith(-0.1);
  });
  test('"ズームイン"/"zoom in" scale the reader text', () => {
    const onReaderScale = jest.fn(() => 1.25);
    const { vc, spoken } = makeVC({ onReaderScale });
    vc.processCommand('ズームイン');
    vc.processCommand('zoom in');
    expect(onReaderScale).toHaveBeenCalledWith(0.25);
    expect(onReaderScale).toHaveBeenCalledTimes(2);
    expect(spoken[1]).toContain('記事の文字サイズ');
  });
  test('"続きを読んで" reaches read-here', () => {
    const onReadHere = jest.fn(() => ['chunk']);
    const { vc } = makeVC({ onReadHere });
    vc.processCommand('続きを読んで');
    expect(onReadHere).toHaveBeenCalled();
  });
  test('"どこまで読んだ" reaches reader-progress', () => {
    const onReaderProgress = jest.fn(() => 42);
    const { vc, spoken } = makeVC({ onReaderProgress });
    vc.processCommand('どこまで読んだ');
    expect(spoken).toContain('記事の42%を読みました');
  });
  test('"タブのタイトルは" announces the title', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('タブのタイトルは');
    expect(spoken).toContain('ニュース');
  });
  test('"再読み上げ" replays the last utterance', () => {
    const { vc, spoken } = makeVC();
    vc._lastSpoken = '前の発話';
    vc.processCommand('再読み上げ');
    expect(spoken).toContain('前の発話');
  });
});
