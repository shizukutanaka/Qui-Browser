/**
 * Round 44 atoms — misroute fixes ('close this tab', 'find first/last',
 * '前/次のタブに移動') plus wide alias coverage on high-frequency commands.
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
    nextTab: jest.fn(), prevTab: jest.fn(),
    newTab: jest.fn(), duplicateTab: jest.fn(),
    closeTab: jest.fn(() => true)
  } : opts.tabManager;
  const goTo = jest.fn();
  vc.connectBrowser({ tabManager, onGoTo: goTo, ...opts });
  return { vc, spoken, tabManager, goTo };
}

describe('misroute fixes', () => {
  test('"close this tab" closes the active tab, not a "this"-named tab', () => {
    const { vc, spoken, tabManager } = makeVC();
    vc.processCommand('close this tab');
    expect(tabManager.closeTab).toHaveBeenCalledWith(0);
    expect(spoken[0]).not.toContain('がありません');
  });
  test('"close the news tab" still routes to close-tab-by-name', () => {
    const closeTab = jest.fn(() => true);
    const { vc, spoken } = makeVC({ tabManager: {
      tabs: [tab('ニュース', 'https://news.jp')], activeIndex: 0,
      getActiveTab: () => tab('ニュース', 'https://news.jp'),
      closeTab
    }});
    vc.processCommand('close the news tab');
    expect(closeTab).toHaveBeenCalledWith(0);
    expect(spoken[0]).toContain('タブを閉じました');
  });
  test('"find first" jumps to hit 1, not a literal "first" search', () => {
    const onFindMatch = jest.fn(() => ({ index: 1, total: 4 }));
    const { vc, spoken } = makeVC({ onFindMatch });
    vc.processCommand('find first');
    expect(onFindMatch).toHaveBeenCalledWith(1);
    expect(spoken[0]).toContain('1件目');
  });
  test('"find last" jumps to the last hit', () => {
    const onFindLast = jest.fn(() => ({ index: 4, total: 4 }));
    const { vc, spoken } = makeVC({ onFindLast });
    vc.processCommand('find last');
    expect(onFindLast).toHaveBeenCalled();
    expect(spoken[0]).toContain('4件目');
  });
  test('"find banana" still searches the literal term', () => {
    const findInReader = jest.fn(() => 2);
    const { vc, spoken } = makeVC({
      panel: tab('a', 'https://a', { findInReader })
    });
    vc.processCommand('find banana');
    expect(findInReader).toHaveBeenCalledWith('banana');
    expect(spoken[0]).toContain('2件見つかりました');
  });
  test('"前のタブに移動" switches tabs instead of navigating', () => {
    const { vc, tabManager, goTo } = makeVC();
    vc.processCommand('前のタブに移動');
    expect(tabManager.prevTab).toHaveBeenCalled();
    expect(goTo).not.toHaveBeenCalled();
  });
  test('"次のタブに移動" switches tabs instead of navigating', () => {
    const { vc, tabManager, goTo } = makeVC();
    vc.processCommand('次のタブに移動');
    expect(tabManager.nextTab).toHaveBeenCalled();
    expect(goTo).not.toHaveBeenCalled();
  });
  test('"このタブを閉じて" closes the active tab', () => {
    const { vc, tabManager } = makeVC();
    vc.processCommand('このタブを閉じて');
    expect(tabManager.closeTab).toHaveBeenCalledWith(0);
  });
});

describe('alias coverage', () => {
  test('"このページを読んで" reaches read-aloud', () => {
    const onReadAloud = jest.fn(() => ['chunk']);
    const { vc } = makeVC({ onReadAloud });
    vc.processCommand('このページを読んで');
    expect(onReadAloud).toHaveBeenCalled();
  });
  test('"read this" reaches read-aloud', () => {
    const onReadAloud = jest.fn(() => ['chunk']);
    const { vc } = makeVC({ onReadAloud });
    vc.processCommand('read this');
    expect(onReadAloud).toHaveBeenCalled();
  });
  test('"ブックマークして" reaches bookmark-page', () => {
    const onBookmarkPage = jest.fn();
    const { vc, spoken } = makeVC({ onBookmarkPage });
    vc.processCommand('ブックマークして');
    expect(onBookmarkPage).toHaveBeenCalled();
    expect(spoken[0]).toContain('ブックマーク');
  });
  test('"スペルで読んで" reaches spell-word', () => {
    const onSpellWord = jest.fn(() => ({ spelled: 'a-b-c' }));
    const { vc, spoken } = makeVC({ onSpellWord });
    vc.processCommand('スペルで読んで');
    expect(spoken[0]).toContain('a-b-c');
  });
  test('"この単語" reaches read-word', () => {
    const onWord = jest.fn(() => ({ word: 'こんにちは' }));
    const { vc, spoken } = makeVC({ onWord });
    vc.processCommand('この単語');
    expect(spoken[0]).toContain('こんにちは');
  });
  test('"前のヒット" reaches find-prev', () => {
    const findPrevMatch = jest.fn(() => ({ index: 1, total: 3 }));
    const { vc, spoken } = makeVC({
      panel: tab('a', 'https://a', { findPrevMatch })
    });
    vc.processCommand('前のヒット');
    expect(findPrevMatch).toHaveBeenCalled();
    expect(spoken[0]).toContain('1/3件目');
  });
  test('"prev match" reaches find-prev', () => {
    const findPrevMatch = jest.fn(() => ({ index: 2, total: 3 }));
    const { vc } = makeVC({ panel: tab('a', 'https://a', { findPrevMatch }) });
    vc.processCommand('prev match');
    expect(findPrevMatch).toHaveBeenCalled();
  });
  test('"現在の文" reaches read-sentence', () => {
    const onSentence = jest.fn(() => ({ sentence: '現在の文です' }));
    const { vc, spoken } = makeVC({ onSentence });
    vc.processCommand('現在の文');
    expect(spoken[0]).toContain('現在の文です');
  });
  test('"この文は" reaches sentence-status', () => {
    const onSentenceStatus = jest.fn(() => ({ index: 3, total: 9 }));
    const { vc, spoken } = makeVC({ onSentenceStatus });
    vc.processCommand('この文は');
    expect(spoken[0]).toContain('3文目');
  });
  test('"この段落は" reaches paragraph-status', () => {
    const onParagraphStatus = jest.fn(() => ({ index: 2, total: 5 }));
    const { vc, spoken } = makeVC({ onParagraphStatus });
    vc.processCommand('この段落は');
    expect(spoken[0]).toContain('2段落目');
  });
  test('"この行は" reaches line-status', () => {
    const onLineStatus = jest.fn(() => ({ index: 4, total: 40 }));
    const { vc, spoken } = makeVC({ onLineStatus });
    vc.processCommand('この行は');
    expect(spoken[0]).toContain('4行目');
  });
  test('"ここはどこ" reaches where-am-i', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('ここはどこ');
    expect(spoken[0]).toContain('ニュース');
  });
  test('"what is here" reaches where-am-i', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('what is here');
    expect(spoken[0]).toContain('ニュース');
  });
  test('"このタブは" reaches describe-tab', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('このタブは');
    expect(spoken[0]).toContain('ニュース');
  });
  test('"新しいウィンドウ" reaches new-tab', () => {
    const { vc, tabManager } = makeVC();
    vc.processCommand('新しいウィンドウ');
    expect(tabManager.newTab).toHaveBeenCalled();
  });
  test('"new window" reaches new-tab', () => {
    const { vc, tabManager } = makeVC();
    vc.processCommand('new window');
    expect(tabManager.newTab).toHaveBeenCalled();
  });
  test('"複製して" reaches duplicate-tab', () => {
    const { vc, tabManager } = makeVC();
    vc.processCommand('複製して');
    expect(tabManager.duplicateTab).toHaveBeenCalled();
  });
  test('"読み込みをやめて" reaches stop-loading', () => {
    const stop = jest.fn();
    const { vc } = makeVC({ panel: tab('a', 'https://a', { stop }) });
    vc.processCommand('読み込みをやめて');
    expect(stop).toHaveBeenCalled();
  });
  test('"stop the page" reaches stop-loading', () => {
    const stop = jest.fn();
    const { vc } = makeVC({ panel: tab('a', 'https://a', { stop }) });
    vc.processCommand('stop the page');
    expect(stop).toHaveBeenCalled();
  });
  test('"top of page" reaches scroll-top', () => {
    const scrollToTop = jest.fn();
    const { vc } = makeVC({ panel: tab('a', 'https://a', { scrollToTop }) });
    vc.processCommand('top of page');
    expect(scrollToTop).toHaveBeenCalled();
  });
  test('"end of page" reaches scroll-bottom', () => {
    const scrollToBottom = jest.fn();
    const { vc } = makeVC({ panel: tab('a', 'https://a', { scrollToBottom }) });
    vc.processCommand('end of page');
    expect(scrollToBottom).toHaveBeenCalled();
  });
  test('"何時" reaches time', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('何時');
    expect(spoken[0]).toContain('現在時刻は');
  });
  test('"この段落を読み上げて" reaches read-paragraph', () => {
    const onReadParagraph = jest.fn(() => ['本文']);
    const { vc } = makeVC({ onReadParagraph });
    vc.processCommand('この段落を読み上げて');
    expect(onReadParagraph).toHaveBeenCalled();
  });
});
