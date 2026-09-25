/**
 * Round 40 atoms — new-tab-with named open, reload aliases, lines-left,
 * tabs-remaining, private-list, line-chars, voice-name EN.
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

global.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(t) {
  this.text = t;
};

function tab(title, url, extra = {}) {
  return {
    currentTitle: title, currentUrl: url, pinned: false, isPrivate: false,
    reload: jest.fn(),
    lineStatus: jest.fn(() => ({ index: 5, total: 40 })),
    currentLine: jest.fn(() => 'サンプルの行です'),
    ...extra
  };
}

function makeVC(opts = {}) {
  const vc = new VoiceCommands();
  const spoken = [];
  vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: () => {}, speaking: false };
  const panel = opts.panel || (opts.tabs ? opts.tabs[opts.activeIndex ?? 0] : tab('ニュース', 'https://news.jp'));
  const tabManager = opts.tabManager === undefined ? {
    tabs: opts.tabs || [panel],
    activeIndex: opts.activeIndex ?? 0,
    setActive: jest.fn(),
    getActiveTab: () => panel,
    nextTab: jest.fn(),
    newTab: jest.fn(() => tab('blank', '')),
    previousActiveIndex: () => 0
  } : opts.tabManager;
  const goTo = jest.fn();
  vc.connectBrowser({ tabManager, onGoTo: goTo, ...opts });
  return { vc, spoken, tabManager, panel, goTo };
}

describe('new-tab-with', () => {
  test('"ニュースで新しいタブ" opens a tab and resolves the term', () => {
    const { vc, spoken, tabManager, goTo } = makeVC();
    vc.processCommand('ニュースで新しいタブ');
    expect(tabManager.newTab).toHaveBeenCalled();
    expect(goTo).toHaveBeenCalledWith('ニュース');
    expect(spoken).toContain('「ニュース」で新しいタブを開きました');
  });
  test('"new tab with google" resolves through onGoTo', () => {
    const { vc, goTo } = makeVC();
    vc.processCommand('new tab with google');
    expect(goTo).toHaveBeenCalledWith('google');
  });
  test('at the tab cap it announces honestly (no navigation)', () => {
    const { vc, spoken, goTo, tabManager } = makeVC();
    tabManager.newTab.mockReturnValue(null);
    vc.processCommand('検索で新しいタブ');
    expect(goTo).not.toHaveBeenCalled();
    expect(spoken).toContain('タブをこれ以上開けません');
  });
  test('"プライベートで新しいタブ" does not hit new-tab-with', () => {
    const { vc, goTo } = makeVC();
    vc.processCommand('プライベートで新しいタブ');
    expect(goTo).not.toHaveBeenCalled();
  });
});

describe('reload aliases', () => {
  test('"リロード" reloads the active tab', () => {
    const { vc, panel } = makeVC();
    vc.processCommand('リロード');
    expect(panel.reload).toHaveBeenCalled();
  });
  test('"reload the page" reloads; "reload tab 2" still indexes', () => {
    const tabs = [tab('a', 'https://a'), tab('b', 'https://b')];
    const { vc, panel } = makeVC({ tabs });
    vc.processCommand('reload the page');
    expect(panel.reload).toHaveBeenCalled();
    vc.processCommand('reload tab 2');
    expect(tabs[1].reload).toHaveBeenCalled();
    expect(tabs[0].reload).toHaveBeenCalledTimes(1); // not refreshed twice
  });
});

describe('status/list twins', () => {
  test('"あと何行" announces remaining lines', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('あと何行');
    expect(spoken).toContain('あと35行です');
  });
  test('last line announces edge', () => {
    const { vc, spoken } = makeVC({
      panel: tab('n', 'https://x', { lineStatus: jest.fn(() => ({ index: 40, total: 40 })) })
    });
    vc.processCommand('lines left');
    expect(spoken).toContain('最後の行です');
  });
  test('"あと何タブ" counts tabs to the right', () => {
    const { vc, spoken } = makeVC({ tabs: [tab('a', '1'), tab('b', '2'), tab('c', '3')], activeIndex: 1 });
    vc.processCommand('あと何タブ');
    expect(spoken).toContain('あと1タブです');
  });
  test('rightmost tab announces last', () => {
    const { vc, spoken } = makeVC({ tabs: [tab('a', '1'), tab('b', '2')], activeIndex: 1 });
    vc.processCommand('tabs remaining');
    expect(spoken).toContain('最後のタブです');
  });
  test('"プライベートタブ一覧" names private tabs', () => {
    const tabs = [
      tab('公開', 'https://a'),
      tab('秘密A', 'https://p1', { isPrivate: true }),
      tab('秘密B', 'https://p2', { isPrivate: true })
    ];
    const { vc, spoken } = makeVC({ tabs });
    vc.processCommand('プライベートタブ一覧');
    expect(spoken[0]).toContain('2個のプライベートタブ');
    expect(spoken[0]).toContain('秘密A');
    expect(spoken[0]).toContain('秘密B');
  });
  test('no private tabs announces honestly', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('private tab list');
    expect(spoken).toContain('プライベートタブはありません');
  });
  test('"この行は何文字" announces the line length', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('この行は何文字');
    expect(spoken).toContain('この行は8文字です');
  });
  test('"what voice" reaches voice-name', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('what voice');
    expect(spoken).toContain('声は未選択です');
  });
});
