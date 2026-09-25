/**
 * Round 41 atoms — read-line-n, pin-count, mic-status, history-latest,
 * search-engine bare-query fix, JA alias coverage.
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

global.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(t) {
  this.text = t;
};

function tab(title, url, extra = {}) {
  return {
    currentTitle: title, currentUrl: url, pinned: false, isPrivate: false,
    reload: jest.fn(), duplicateTab: jest.fn(), scrollToTop: jest.fn(),
    scrollToBottom: jest.fn(),
    lineStatus: jest.fn(() => ({ index: 1, total: 40 })),
    currentLine: jest.fn(() => '行のテキスト'),
    scrollContentTo: jest.fn(),
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
    duplicateTab: jest.fn(),
    previousActiveIndex: () => 0
  } : opts.tabManager;
  const goTo = jest.fn();
  vc.connectBrowser({ tabManager, onGoTo: goTo, ...opts });
  return { vc, spoken, tabManager, panel, goTo };
}

describe('read-line-n', () => {
  test('"3行目を読んで" scrolls to line 3 and reads the text', () => {
    const { vc, spoken, panel } = makeVC();
    vc.processCommand('3行目を読んで');
    expect(panel.scrollContentTo).toHaveBeenCalledWith(2);
    expect(spoken[0]).toContain('3行目。行のテキスト');
  });
  test('out of range announces honestly without scrolling', () => {
    const { vc, spoken, panel } = makeVC();
    vc.processCommand('99行目を読んで');
    expect(panel.scrollContentTo).not.toHaveBeenCalled();
    expect(spoken).toContain('99行目はありません');
  });
  test('no article announces honestly', () => {
    const { vc, spoken } = makeVC({ panel: tab('n', 'x', { lineStatus: jest.fn(() => null) }) });
    vc.processCommand('1行目を読んで');
    expect(spoken).toContain('記事を開いていません');
  });
});

describe('pin-count / mic-status / history-latest', () => {
  test('"ピン留めは何個" counts pinned tabs', () => {
    const tabs = [tab('a', '1', { pinned: true }), tab('b', '2', { pinned: true }), tab('c', '3')];
    const { vc, spoken } = makeVC({ tabs });
    vc.processCommand('ピン留めは何個');
    expect(spoken).toContain('2個のピン留めタブがあります');
  });
  test('no pins announces honestly', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('pinned count');
    expect(spoken).toContain('ピン留めタブはありません');
  });
  test('"マイクの状態" answers isListening', () => {
    const { vc, spoken } = makeVC();
    vc.isListening = true;
    vc.processCommand('マイクの状態');
    expect(spoken).toContain('マイクはオンです');
    vc.isListening = false;
    vc.processCommand('mic status');
    expect(spoken).toContain('マイクはオフです');
  });
  test('"最新の履歴" reads the newest entry', () => {
    const onHistoryList = jest.fn(() => [{ title: '昨日のページ', url: 'https://a' }]);
    const { vc, spoken } = makeVC({ onHistoryList });
    vc.processCommand('最新の履歴');
    expect(spoken).toContain('最新の履歴は「昨日のページ」です');
  });
  test('empty history announces honestly', () => {
    const { vc, spoken } = makeVC({ onHistoryList: jest.fn(() => []) });
    vc.processCommand('latest history');
    expect(spoken).toContain('履歴がありません');
  });
});

describe('search-engine bare query fix', () => {
  test('"検索エンジンは" answers status, not a setter rejection', () => {
    const onSearchEngineStatus = jest.fn(() => 'google');
    const onSearchEngine = jest.fn(() => 'google');
    const { vc, spoken } = makeVC({ onSearchEngineStatus, onSearchEngine });
    vc.processCommand('検索エンジンは');
    expect(onSearchEngineStatus).toHaveBeenCalled();
    expect(spoken).toContain('検索エンジンはgoogleです');
  });
  test('"検索エンジンをGoogleに" still sets', () => {
    const onSearchEngine = jest.fn(() => 'google');
    const { vc, spoken } = makeVC({ onSearchEngine });
    vc.processCommand('検索エンジンをGoogleに');
    expect(onSearchEngine).toHaveBeenCalledWith('google');
    expect(spoken).toContain('検索エンジンをgoogleにしました');
  });
});

describe('JA aliases', () => {
  test('"一番上へ"/"一番下へ" reach scroll-top/bottom', () => {
    const { vc, panel } = makeVC();
    vc.processCommand('一番上へ');
    expect(panel.scrollToTop).toHaveBeenCalled();
    vc.processCommand('一番下へ');
    expect(panel.scrollToBottom).toHaveBeenCalled();
  });
  test('"前の文を読んで" reaches prev-sentence', () => {
    const onSentenceStep = jest.fn(() => ({ sentence: '前の文です', index: 1, total: 3 }));
    const { vc, spoken } = makeVC({ onSentenceStep });
    vc.processCommand('前の文を読んで');
    expect(onSentenceStep).toHaveBeenCalledWith(-1);
    expect(spoken).toContain('前の文です');
  });
  test('"タブを複製して" duplicates', () => {
    const { vc, tabManager } = makeVC();
    vc.processCommand('タブを複製して');
    expect(tabManager.duplicateTab).toHaveBeenCalled();
  });
  test('"現在の読み上げ速度"/"現在のピッチ" answer status', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('現在の読み上げ速度');
    expect(spoken[0]).toContain('読み上げ速度は');
    vc.processCommand('現在のピッチ');
    expect(spoken[1]).toContain('声の高さは');
  });
});
