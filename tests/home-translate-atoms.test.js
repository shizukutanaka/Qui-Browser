/**
 * Round 47 atoms — home navigation (Chrome Home button → new-tab surface),
 * translate-page (Chrome translate bubble → Google Translate wrapper),
 * question-form misroute fixes (back/forward status must not navigate),
 * and a fourth alias pass on high-frequency commands.
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

global.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(t) {
  this.text = t;
};

const flush = () => new Promise((r) => setTimeout(r, 0));

function makeVC(opts = {}) {
  const vc = new VoiceCommands();
  const spoken = [];
  vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: () => {}, speaking: false };
  const tabs = opts.tabs || [
    {
      currentTitle: 'ニュース', currentUrl: 'https://news.jp',
      goBack: jest.fn(() => opts.canBack ?? true),
      goForward: jest.fn(() => opts.canForward ?? false),
      historyIdx: opts.canBack === false ? 0 : 1, history: ['https://old.jp', 'https://news.jp'],
      reload: jest.fn(),
      scrollContentPage: jest.fn(),
      scrollToTop: jest.fn(),
      scrollToBottom: jest.fn(),
      getReaderToc: jest.fn(() => ['はじめに', '本論', '結論']),
      onUrlInputRequested: jest.fn()
    }
  ];
  const state = { activeIndex: 0 };
  const tabManager = {
    tabs,
    get activeIndex() { return state.activeIndex; },
    setActive: jest.fn((i) => { state.activeIndex = i; }),
    getActiveTab: () => tabs[state.activeIndex],
    newTab: jest.fn(() => (opts.maxTabs ? null : tabs[0])),
    newPrivateTab: jest.fn(() => (opts.maxTabs ? null : {}))
  };
  const goTo = jest.fn();
  vc.connectBrowser({ tabManager, onGoTo: goTo, ...opts });
  return { vc, spoken, tabManager, goTo };
}

describe('home: Chrome Home button → new-tab surface', () => {
  test.each(['ホームに戻る', 'ホームへ', 'ホームページ', 'go home', 'home page'])(
    '"%s" opens the home surface', (phrase) => {
      const { vc, spoken, tabManager } = makeVC();
      vc.processCommand(phrase);
      expect(tabManager.newTab).toHaveBeenCalled();
      expect(spoken[0]).toBe('ホームに戻りました');
    });
  test('"ホームに戻る" does not trigger back navigation', () => {
    const { vc, tabManager } = makeVC();
    vc.processCommand('ホームに戻る');
    expect(tabManager.getActiveTab().goBack).not.toHaveBeenCalled();
  });
  test('at the tab cap it announces honestly', () => {
    const { vc, spoken } = makeVC({ maxTabs: true });
    vc.processCommand('ホーム');
    expect(spoken[0]).toBe('タブをこれ以上開けません');
  });
  test('bare "戻る" still goes back', () => {
    const { vc, tabManager } = makeVC();
    vc.processCommand('戻る');
    expect(tabManager.getActiveTab().goBack).toHaveBeenCalled();
  });
});

describe('question forms must answer status, not navigate', () => {
  test.each(['戻ることができますか', 'もっと戻れる', '前に戻れますか'])(
    '"%s" answers back-status without navigating', (phrase) => {
      const { vc, spoken, tabManager } = makeVC();
      vc.processCommand(phrase);
      expect(tabManager.getActiveTab().goBack).not.toHaveBeenCalled();
      expect(spoken[0]).toBe('戻れます');
    });
  test.each(['進むことができますか', '前に進めますか'])(
    '"%s" answers forward-status without navigating', (phrase) => {
      const { vc, spoken, tabManager } = makeVC();
      vc.processCommand(phrase);
      expect(tabManager.getActiveTab().goForward).not.toHaveBeenCalled();
      expect(spoken[0]).toBe('進めません');
    });
  test('status reflects the real history edge', () => {
    const { vc, spoken } = makeVC({ canBack: false });
    vc.processCommand('戻ることができますか');
    expect(spoken[0]).toBe('戻れません');
  });
});

describe('translate-page: Chrome translate bubble parity', () => {
  test.each(['翻訳して', 'このページを翻訳', 'ページを翻訳して', 'translate this page'])(
    '"%s" opens a Google Translate wrapper for the URL', (phrase) => {
      const { vc, spoken, goTo } = makeVC();
      vc.processCommand(phrase);
      expect(goTo).toHaveBeenCalledTimes(1);
      const url = goTo.mock.calls[0][0];
      expect(url).toContain('translate.google.com/translate');
      expect(url).toContain(`u=${encodeURIComponent('https://news.jp')}`);
      expect(url).toContain('tl=ja');
      expect(spoken[0]).toBe('翻訳ページを開きます');
    });
  test('"英語に翻訳" targets English', () => {
    const { vc, goTo } = makeVC();
    vc.processCommand('英語に翻訳');
    expect(goTo.mock.calls[0][0]).toContain('tl=en');
  });
  test('no page loaded announces honestly', () => {
    const { vc, spoken, goTo } = makeVC({ tabs: [{ currentTitle: '', currentUrl: '' }] });
    vc.processCommand('翻訳して');
    expect(goTo).not.toHaveBeenCalled();
    expect(spoken[0]).toBe('ページを開いていません');
  });
});

describe('alias pass IV', () => {
  test.each(['新しいプライベートタブ', 'プライベートタブを開いて'])(
    '"%s" opens a private tab', (phrase) => {
      const { vc, tabManager } = makeVC();
      vc.processCommand(phrase);
      expect(tabManager.newPrivateTab).toHaveBeenCalled();
    });
  test('"次のページへ"/"前のページへ" scroll a page', () => {
    const { vc, tabManager } = makeVC();
    vc.processCommand('次のページへ');
    expect(tabManager.getActiveTab().scrollContentPage).toHaveBeenCalledWith(1);
    vc.processCommand('前のページへ');
    expect(tabManager.getActiveTab().scrollContentPage).toHaveBeenCalledWith(-1);
  });
  test('"最初のページ"/"最後のページ" jump to the ends', () => {
    const { vc, tabManager } = makeVC();
    vc.processCommand('最初のページ');
    expect(tabManager.getActiveTab().scrollToTop).toHaveBeenCalled();
    vc.processCommand('最後のページ');
    expect(tabManager.getActiveTab().scrollToBottom).toHaveBeenCalled();
    vc.processCommand('last page');
    expect(tabManager.getActiveTab().scrollToBottom).toHaveBeenCalledTimes(2);
  });
  test.each(['ページを更新', '更新して', 'refresh page', 'reload this page'])(
    '"%s" reloads the active tab', (phrase) => {
      const { vc, tabManager } = makeVC();
      vc.processCommand(phrase);
      expect(tabManager.getActiveTab().reload).toHaveBeenCalled();
    });
  test('"ページを保存して"/"save this page" bookmarks', () => {
    const onBookmarkPage = jest.fn();
    const { vc } = makeVC({ onBookmarkPage });
    vc.processCommand('ページを保存して');
    vc.processCommand('save this page');
    expect(onBookmarkPage).toHaveBeenCalledTimes(2);
  });
  test('"セッションを保存" still saves the session, not a bookmark', () => {
    const onBookmarkPage = jest.fn();
    const onSessionSave = jest.fn(() => 3);
    const { vc } = makeVC({ onBookmarkPage, onSessionSave });
    vc.processCommand('セッションを保存');
    expect(onSessionSave).toHaveBeenCalled();
    expect(onBookmarkPage).not.toHaveBeenCalled();
  });
  test.each(['要約して', 'このページを要約', 'summarize'])(
    '"%s" reads the article summary', (phrase) => {
      const onArticleSummary = jest.fn(() => ({ title: 'T', headings: 2, paragraphs: 4, chars: 100 }));
      const { vc, spoken } = makeVC({ onArticleSummary });
      vc.processCommand(phrase);
      expect(spoken[0]).toContain('見出し2個');
    });
  test.each(['見出しを全部読んで', '章一覧', 'read all headings'])(
    '"%s" reads the outline', (phrase) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(phrase);
      expect(spoken[0]).toContain('はじめに');
    });
  test('"フォーカスはどこ" announces position', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('フォーカスはどこ');
    expect(spoken[0]).not.toContain('認識できません');
  });
  test.each(['ツイートして', 'メールで送って', 'リンクを送って', 'tweet this', 'email this'])(
    '"%s" shares via the share surface', async (phrase) => {
      const onShare = jest.fn(() => Promise.resolve('共有しました'));
      const { vc, spoken } = makeVC({ onShare });
      vc.processCommand(phrase);
      await flush();
      expect(onShare).toHaveBeenCalled();
      expect(spoken[0]).toBe('共有しました');
    });
  test.each(['読み上げをスキップ', 'skip ahead'])(
    '"%s" skips to the next paragraph', (phrase) => {
      const onParagraphStep = jest.fn(() => ({ index: 2, total: 5 }));
      const { vc, spoken } = makeVC({ onParagraphStep });
      vc.processCommand(phrase);
      expect(onParagraphStep).toHaveBeenCalledWith(1);
      expect(spoken[0]).toContain('2番目の段落');
    });
  test.each(['検索バー', 'search bar'])(
    '"%s" focuses the omnibox', (phrase) => {
      const { vc, tabManager } = makeVC();
      vc.processCommand(phrase);
      expect(tabManager.getActiveTab().onUrlInputRequested).toHaveBeenCalled();
    });
});
