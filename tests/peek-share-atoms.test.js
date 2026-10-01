/**
 * Round 46 atoms — peek-tab (announce the adjacent tab without switching),
 * share-page (Web Share API / clipboard fallback), and a third alias pass on
 * high-frequency commands. External basis: screen-reader "what's next"
 * announces, Chrome share sheet, VoiceOver say-title/status twins.
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

global.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(t) {
  this.text = t;
};

function tab(title, url, extra = {}) {
  return {
    currentTitle: title, currentUrl: url, pinned: false, loading: false,
    ...extra
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function makeVC(opts = {}) {
  const vc = new VoiceCommands();
  const spoken = [];
  vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: () => {}, speaking: false };
  const tabs = opts.tabs || [
    tab('ニュース', 'https://news.jp'), tab('天気', 'https://weather.jp')
  ];
  const state = { activeIndex: opts.activeIndex ?? 0 };
  const tabManager = opts.tabManager === undefined ? {
    tabs,
    get activeIndex() { return state.activeIndex; },
    setActive: jest.fn((i) => { state.activeIndex = i; }),
    getActiveTab: () => tabs[state.activeIndex],
    moveTab: jest.fn(() => true),
    nextTab: jest.fn(() => { state.activeIndex = (state.activeIndex + 1) % tabs.length; }),
    prevTab: jest.fn()
  } : opts.tabManager;
  const goTo = jest.fn();
  vc.connectBrowser({ tabManager, onGoTo: goTo, ...opts });
  return { vc, spoken, tabManager, goTo };
}

describe('peek-tab: announce adjacent tab without switching', () => {
  test.each(['次のタブを読んで', '次のタブは', 'read next tab', "what's the next tab"])(
    '"%s" announces the next tab title', (phrase) => {
      const { vc, spoken, tabManager } = makeVC();
      vc.processCommand(phrase);
      expect(spoken[0]).toContain('天気');
      expect(tabManager.setActive).not.toHaveBeenCalled();
      expect(tabManager.nextTab).not.toHaveBeenCalled();
    });
  test.each(['前のタブを読んで', '前のタブは', 'read previous tab'])(
    '"%s" announces the previous tab title', (phrase) => {
      const { vc, spoken, tabManager } = makeVC({ activeIndex: 1 });
      vc.processCommand(phrase);
      expect(spoken[0]).toContain('ニュース');
      expect(tabManager.setActive).not.toHaveBeenCalled();
    });
  test('wraps around like nextTab does', () => {
    const { vc, spoken } = makeVC({ activeIndex: 1 });
    vc.processCommand('次のタブを読んで');
    expect(spoken[0]).toContain('ニュース');
  });
  test('single tab announces honestly', () => {
    const { vc, spoken } = makeVC({ tabs: [tab('a', 'b')] });
    vc.processCommand('次のタブを読んで');
    expect(spoken[0]).toBe('他のタブはありません');
  });
  test('bare "next tab" still switches', () => {
    const { vc, tabManager } = makeVC();
    vc.processCommand('next tab');
    expect(tabManager.nextTab).toHaveBeenCalled();
  });
});

describe('share-page', () => {
  test("'共有して' shares via the host hook", async () => {
    const onShare = jest.fn(() => Promise.resolve('共有しました'));
    const { vc, spoken } = makeVC({ onShare });
    vc.processCommand('共有して');
    await flush();
    expect(onShare).toHaveBeenCalled();
    expect(spoken[0]).toBe('共有しました');
  });
  test("'share this page' routes in English", async () => {
    const onShare = jest.fn(() => Promise.resolve('URLをコピーしました'));
    const { vc, spoken } = makeVC({ onShare });
    vc.processCommand('share this page');
    await flush();
    expect(spoken[0]).toBe('URLをコピーしました');
  });
  test('no hook announces honestly', async () => {
    const { vc, spoken } = makeVC({ onShare: undefined });
    vc.processCommand('このページを共有');
    await flush();
    expect(spoken[0]).toBe('共有できません');
  });
});

describe('alias pass III', () => {
  test.each(['ページの名前', 'ページタイトル', '今のページ', 'this page', 'current page'])(
    '"%s" announces the title', (phrase) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(phrase);
      expect(spoken[0]).toBe('ニュース');
    });
  test('"履歴を見せて" opens history', () => {
    const bookmarkPanel = { setMode: jest.fn(), show: jest.fn(), visible: false };
    const { vc } = makeVC({ bookmarkPanel });
    vc.processCommand('履歴を見せて');
    expect(bookmarkPanel.setMode).toHaveBeenCalledWith('history');
  });
  test('"ブックマークを見せて" opens bookmarks', () => {
    const bookmarkPanel = { setMode: jest.fn(), show: jest.fn(), visible: false };
    const { vc } = makeVC({ bookmarkPanel });
    vc.processCommand('ブックマークを見せて');
    expect(bookmarkPanel.setMode).toHaveBeenCalledWith('bookmarks');
  });
  test.each(['ブックマークに入ってる', 'ブックマークしたか', 'did i bookmark', 'is it in bookmarks'])(
    '"%s" answers bookmark status', (phrase) => {
      const p = tab('a', 'b', { isBookmarked: () => true });
      const { vc, spoken } = makeVC({ panel: p, tabs: [p] });
      vc.processCommand(phrase);
      expect(spoken[0]).toBe('ブックマークされています');
    });
  test.each(['reading speed', 'voice speed'])('"%s" announces speech rate', (phrase) => {
    const { vc, spoken } = makeVC();
    vc.processCommand(phrase);
    expect(spoken[0]).toContain('読み上げ速度');
  });
  test.each(['音量はいくつ', 'what volume'])('"%s" announces volume', (phrase) => {
    const { vc, spoken } = makeVC({ onVolumeStatus: () => 70 });
    vc.processCommand(phrase);
    expect(spoken[0]).toBe('音量は70%です');
  });
  test.each(['読み上げ言語', 'reading language'])('"%s" announces language', (phrase) => {
    const { vc, spoken } = makeVC();
    vc.processCommand(phrase);
    expect(spoken[0]).toContain('言語は');
  });
  test('"vr mode" enters VR', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('vr mode');
    expect(spoken[0]).toBe('VRモードを開始します');
  });
  test.each(['文字を大きく', '拡大して', 'もっと大きく'])('"%s" grows reader text', (phrase) => {
    const onReaderScale = jest.fn(() => 1.25);
    const { vc, spoken } = makeVC({ onReaderScale });
    vc.processCommand(phrase);
    expect(onReaderScale).toHaveBeenCalledWith(0.25);
    expect(spoken[0]).toContain('1.25');
  });
  test.each(['文字を小さく', '縮小して', 'もっと小さく'])('"%s" shrinks reader text', (phrase) => {
    const onReaderScale = jest.fn(() => 0.75);
    const { vc, spoken } = makeVC({ onReaderScale });
    vc.processCommand(phrase);
    expect(onReaderScale).toHaveBeenCalledWith(-0.25);
    expect(spoken[0]).toContain('0.75');
  });
  test.each(['設定を見せて', 'show settings'])('"%s" toggles the settings panel', (phrase) => {
    const onSettingsPanel = jest.fn(() => true);
    const { vc } = makeVC({ onSettingsPanel });
    vc.processCommand(phrase);
    expect(onSettingsPanel).toHaveBeenCalled();
  });
  test.each(['ヘルプを見せて', 'コマンド一覧を表示'])('"%s" lists commands', (phrase) => {
    const { vc, spoken } = makeVC();
    vc.processCommand(phrase);
    expect(spoken[0]).toContain('使用可能なコマンド');
  });
  test.each(['閲覧履歴を消して', '検索履歴を消して', 'clear browsing history'])(
    '"%s" clears history', (phrase) => {
      const onClearHistory = jest.fn();
      const { vc } = makeVC({ onClearHistory });
      vc.processCommand(phrase);
      expect(onClearHistory).toHaveBeenCalled();
    });
  test.each(['ページ情報', 'このサイトの情報', 'page info', 'site info'])(
    '"%s" describes the tab, not the article', (phrase) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(phrase);
      expect(spoken[0]).toContain('タブ1');
      expect(spoken[0]).toContain('ニュース');
    });
  test.each(['証明書は', 'certificate'])('"%s" answers security status', (phrase) => {
    const { vc, spoken } = makeVC();
    vc.processCommand(phrase);
    expect(spoken[0]).toContain('https');
  });
  test.each([['タブを右に', 1], ['move it right', 1], ['タブを左に', -1], ['move it left', -1]])(
    '"%s" moves the tab', (phrase, dir) => {
      const { vc, tabManager } = makeVC();
      vc.processCommand(phrase);
      expect(tabManager.moveTab).toHaveBeenCalledWith(0, dir);
    });
});
