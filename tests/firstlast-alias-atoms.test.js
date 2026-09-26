/**
 * Round 45 atoms — misroute fixes ('このタブの位置'/'何個目のタブ' → tab-status,
 * '左/右に移動' → move-tab, 'read the previous line' → prev-line,
 * 'incognito tabs' → private-list) plus first/last reader-line atoms and
 * JA 'を読んで' aliases on the first/last collection commands.
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

global.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(t) {
  this.text = t;
};

function tab(title, url, extra = {}) {
  return {
    currentTitle: title, currentUrl: url, pinned: false, loading: false,
    headingAt: jest.fn(() => ({ index: 1, total: 3 })),
    lastHeading: jest.fn(() => ({ index: 3, total: 3 })),
    firstSentence: jest.fn(() => ({ index: 1, total: 9, sentence: '文1' })),
    lastSentence: jest.fn(() => ({ index: 9, total: 9, sentence: '文9' })),
    lineStatus: jest.fn(() => ({ index: 1, total: 20 })),
    currentLine: jest.fn(() => '行のテキスト'),
    scrollContentTo: jest.fn(), scrollContent: jest.fn(() => true),
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
    moveTab: jest.fn(() => true),
    nextTab: jest.fn(), prevTab: jest.fn()
  } : opts.tabManager;
  const goTo = jest.fn();
  vc.connectBrowser({ tabManager, onGoTo: goTo, ...opts });
  return { vc, spoken, tabManager, goTo };
}

describe('misroute fixes: tab position questions', () => {
  for (const phrase of ['このタブの位置', '何個目のタブ', 'タブは何番目', 'タブの順番']) {
    test(`"${phrase}" announces position, not a tab lookup`, () => {
      const { vc, spoken } = makeVC({ onTabStatus: () => ({ index: 1, total: 3 }) });
      vc.processCommand(phrase);
      expect(spoken[0]).toBe('3個のタブの1枚目を表示中');
    });
  }
  test('"このニュースのタブ" still routes to tab-by-name', () => {
    const { vc, spoken, tabManager } = makeVC({
      tabs: [tab('このニュース', 'https://a.jp'), tab('他', 'https://b.jp')]
    });
    vc.processCommand('このニュースのタブ');
    expect(tabManager.setActive).toHaveBeenCalledWith(0);
    expect(spoken[0]).toContain('切り替えました');
  });
});

describe('misroute fixes: move the active tab', () => {
  test.each([['このタブを左へ', -1], ['左に移動', -1]])('"%s" moves left', (phrase, dir) => {
    const { vc, tabManager, goTo } = makeVC();
    vc.processCommand(phrase);
    expect(tabManager.moveTab).toHaveBeenCalledWith(0, dir);
    expect(goTo).not.toHaveBeenCalled();
  });
  test.each([['このタブを右へ', 1], ['右に移動', 1]])('"%s" moves right', (phrase, dir) => {
    const { vc, tabManager, goTo } = makeVC();
    vc.processCommand(phrase);
    expect(tabManager.moveTab).toHaveBeenCalledWith(0, dir);
    expect(goTo).not.toHaveBeenCalled();
  });
});

describe('misroute fixes: previous line vs jump-back', () => {
  test('"read the previous line" reads the previous reader line', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('read the previous line');
    const panel = vc._tabManager.getActiveTab();
    expect(panel.scrollContent).toHaveBeenCalledWith(-1);
    expect(spoken[0]).toBe('行のテキスト');
  });
  test('"previous position" still routes to jump-back', () => {
    const onJumpBack = jest.fn(() => true);
    const { vc, spoken } = makeVC({ onJumpBack });
    vc.processCommand('previous position');
    expect(onJumpBack).toHaveBeenCalled();
    expect(spoken[0]).toBe('元の場所に戻りました');
  });
});

describe('misroute fixes: incognito/private tab queries', () => {
  test.each(['incognito tabs', 'private tabs', 'プライベートのみ'])(
    '"%s" lists private tabs instead of toggling private mode', (phrase) => {
      const onTogglePrivateMode = jest.fn();
      const { vc, spoken } = makeVC({ onTogglePrivateMode });
      vc.processCommand(phrase);
      expect(onTogglePrivateMode).not.toHaveBeenCalled();
      expect(spoken[0]).toBe('プライベートタブはありません');
    });
  test('"incognito mode" still toggles private mode', () => {
    const onTogglePrivateMode = jest.fn();
    const { vc } = makeVC({ onTogglePrivateMode });
    vc.processCommand('incognito mode');
    expect(onTogglePrivateMode).toHaveBeenCalled();
  });
  test('private-list names private tabs when present', () => {
    const { vc, spoken } = makeVC({
      tabs: [tab('通常', 'https://a.jp'), tab('秘密', 'https://s.jp', { isPrivate: true })]
    });
    vc.processCommand('incognito tabs');
    expect(spoken[0]).toContain('1個のプライベートタブ');
    expect(spoken[0]).toContain('秘密');
  });
});

describe('first/last reader line', () => {
  test.each(['最初の行', 'first line', '最初の行を読んで'])('"%s" reads line 1', (phrase) => {
    const onReaderLine = jest.fn(() => 1);
    const { vc, spoken } = makeVC({ onReaderLine });
    vc.processCommand(phrase);
    expect(onReaderLine).toHaveBeenCalledWith(1);
    expect(spoken[0]).toBe('1行目。行のテキスト');
  });
  test.each(['最後の行', 'last line', '最後の行を読んで'])('"%s" reads the last line', (phrase) => {
    const onReaderLine = jest.fn(() => 20);
    const { vc, spoken } = makeVC({ onReaderLine });
    vc.processCommand(phrase);
    expect(onReaderLine).toHaveBeenCalledWith(20);
    expect(spoken[0]).toBe('20行目。行のテキスト');
  });
  test('no article answers honestly', () => {
    const { vc, spoken } = makeVC({
      panel: tab('a', 'b', { lineStatus: () => null }),
      onReaderLine: () => null
    });
    vc.processCommand('最初の行');
    expect(spoken[0]).toBe('記事を開いていません');
  });
});

describe('JA read-form aliases on first/last collections', () => {
  test('"最初の段落を読んで" narrates paragraph 1', () => {
    const onReadParagraphAt = jest.fn(() => ['段落1の文']);
    const { vc, spoken } = makeVC({ onReadParagraphAt });
    vc.processCommand('最初の段落を読んで');
    expect(onReadParagraphAt).toHaveBeenCalledWith(1);
    expect(spoken).toContain('段落1の文');
  });
  test('"最後の段落を読んで" narrates the last paragraph', () => {
    const onReadParagraphAt = jest.fn(() => ['最後の段落']);
    const { vc, spoken } = makeVC({
      onReadParagraphAt,
      onParagraphStatus: () => ({ index: 1, total: 4 })
    });
    vc.processCommand('最後の段落を読んで');
    expect(onReadParagraphAt).toHaveBeenCalledWith(4);
    expect(spoken).toContain('最後の段落');
  });
  test('"最初の文を読んで" speaks sentence 1', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('最初の文を読んで');
    expect(spoken[0]).toContain('文1');
  });
  test('"最後の文を読んで" speaks the last sentence', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('最後の文を読んで');
    expect(spoken[0]).toContain('文9');
  });
  test('"最初の見出しを読んで" jumps to heading 1', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('最初の見出しを読んで');
    const panel = vc._tabManager.getActiveTab();
    expect(panel.headingAt).toHaveBeenCalledWith(1);
    expect(spoken[0]).toBe('1番目の見出し（全3）');
  });
  test('"最後の見出しを読んで" jumps to the last heading', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('最後の見出しを読んで');
    const panel = vc._tabManager.getActiveTab();
    expect(panel.lastHeading).toHaveBeenCalled();
    expect(spoken[0]).toBe('最後の見出し（全3）');
  });
});
