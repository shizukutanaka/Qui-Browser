/**
 * Round 59 atoms — close-tab-ordinal (N番目/first/last), unpin-all,
 * pin-active (one-direction twin), private-mode-off, contrast-status
 * question forms, percent-jump '真ん中に移動' misroute fix, and alias
 * pass XVI across find/scroll/toc/read/status surfaces.
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeTab(url, title, extra = {}) {
  return {
    currentUrl: url,
    currentTitle: title || url,
    isPrivate: false,
    pinned: false,
    loading: false,
    history: [],
    historyIdx: -1,
    ...extra
  };
}

function makeVC({ tabs, tabManager, ...hooks } = {}) {
  const vc = new VoiceCommands();
  const spoken = [];
  vc.speak = jest.fn((t) => spoken.push(t));
  const tm = tabManager || {
    tabs: tabs || [makeTab('https://a.jp', 'ニュース'), makeTab('https://b.jp', '天気'), makeTab('https://c.jp', 'メモ')],
    activeIndex: 0,
    _privateMode: false,
    newTab: jest.fn(() => makeTab('about:blank')),
    newPrivateTab: jest.fn(() => makeTab('about:blank', null, { isPrivate: true })),
    setActive: jest.fn(),
    closeTab: jest.fn(function (i) { return !(this.tabs[i] && this.tabs[i].pinned); }),
    togglePin: jest.fn(function (i) {
      const t = this.tabs[i];
      if (!t) { return null; }
      t.pinned = !t.pinned;
      return t.pinned ? 'pinned' : 'unpinned';
    }),
    reopenClosedTab: jest.fn(() => makeTab('https://z.jp', '復帰')),
    getActiveTab() { return this.tabs[this.activeIndex] || null; },
    previousActiveIndex: () => -1,
    serializeSession: () => ({ tabs: [] }),
    moveTab: jest.fn(),
    getBookmarkStore: () => ({ list: () => [] })
  };
  vc.connectBrowser({ tabManager: tm, ...hooks });
  return { vc, tm, spoken };
}

describe('close-tab-ordinal', () => {
  test.each(['2番目のタブを閉じて', '二番目のタブを閉じて'])(
    '"%s" closes tab index 1', (p) => {
      const { vc, tm } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('close-tab-ordinal');
      expect(tm.closeTab).toHaveBeenCalledWith(1);
      expect(vc.speak.mock.calls.at(-1)[0]).toBe('天気を閉じました');
    });
  test.each([['最初のタブを閉じて', 0], ['一番目のタブを閉じて', 0],
    ['先頭のタブを閉じて', 0], ['最後のタブを閉じて', 2], ['末尾のタブを閉じて', 2]])(
    '"%s" closes index %i', (p, idx) => {
      const { vc, tm } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('close-tab-ordinal');
      expect(tm.closeTab).toHaveBeenCalledWith(idx);
    });
  test.each([['close the first tab', 0], ['close the last tab', 2]])(
    '"%s" closes index %i', (p, idx) => {
      const { vc, tm } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('close-tab-ordinal');
      expect(tm.closeTab).toHaveBeenCalledWith(idx);
    });
  test('missing ordinal answers honestly', () => {
    const { vc, tm } = makeVC({ tabs: [makeTab('https://a.jp', 'A')] });
    vc.processCommand('5番目のタブを閉じて');
    expect(vc.lastCommand.key).toBe('close-tab-ordinal');
    expect(tm.closeTab).not.toHaveBeenCalled();
    expect(vc.speak.mock.calls.at(-1)[0]).toBe('タブ5はありません');
  });
  test('pinned tab refuses honestly', () => {
    const tabs = [makeTab('https://a.jp', 'A'), makeTab('https://b.jp', 'B', { pinned: true })];
    const { vc, tm } = makeVC({ tabs });
    vc.processCommand('2番目のタブを閉じて');
    expect(vc.lastCommand.key).toBe('close-tab-ordinal');
    expect(vc.speak.mock.calls.at(-1)[0]).toBe('ピン留めされたタブは閉じられません');
  });
  test('coexistence: named close still works', () => {
    const { vc, tm } = makeVC();
    vc.processCommand('ニュースのタブを閉じて');
    expect(vc.lastCommand.key).toBe('close-tab-by-name');
    expect(tm.closeTab).toHaveBeenCalledWith(0);
  });
});

describe('pin-active / unpin-all', () => {
  test.each(['ピンして', 'ピン留めして', 'ピンを付けてください', 'pin it', 'pin this'])(
    '"%s" pins the active tab', (p) => {
      const { vc, tm } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('pin-active');
      expect(tm.togglePin).toHaveBeenCalledWith(0);
      expect(vc.speak.mock.calls.at(-1)[0]).toBe('ピン留めしました');
    });
  test('already-pinned reports instead of unpinning', () => {
    const tabs = [makeTab('https://a.jp', 'A', { pinned: true })];
    const { vc, tm } = makeVC({ tabs });
    vc.processCommand('ピンして');
    expect(vc.lastCommand.key).toBe('pin-active');
    expect(tm.togglePin).not.toHaveBeenCalled();
    expect(vc.speak.mock.calls.at(-1)[0]).toBe('すでにピン留めされています');
  });
  test.each(['ピンを全部外して', 'ピンをすべて外して', 'すべてのピンを外して',
    'ピン留めを全部解除', 'ピンを全部解除', 'ピンを全解除', 'unpin all tabs'])(
    '"%s" unpins every pinned tab', (p) => {
      const tabs = [makeTab('https://a.jp', 'A', { pinned: true }),
        makeTab('https://b.jp', 'B'), makeTab('https://c.jp', 'C', { pinned: true })];
      const { vc, tm } = makeVC({ tabs });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('unpin-all');
      expect(tm.togglePin).toHaveBeenCalledTimes(2);
      expect(vc.speak.mock.calls.at(-1)[0]).toBe('2個のタブのピンを外しました');
    });
  test('unpin-all with none pinned answers honestly', () => {
    const { vc, tm } = makeVC();
    vc.processCommand('ピンを全部外して');
    expect(vc.lastCommand.key).toBe('unpin-all');
    expect(tm.togglePin).not.toHaveBeenCalled();
    expect(vc.speak.mock.calls.at(-1)[0]).toBe('ピン留めされたタブはありません');
  });
  test.each(['ピンを解除', 'ピン解除', 'ピン留めを解除'])(
    '"%s" unpins only the active tab', (p) => {
      const tabs = [makeTab('https://a.jp', 'A', { pinned: true })];
      const { vc, tm } = makeVC({ tabs });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('unpin-active');
      expect(tm.togglePin).toHaveBeenCalledTimes(1);
    });
});

describe('private-mode-off', () => {
  test.each(['プライベートモードを終了', 'プライベートモードをやめて',
    'シークレットモードを終了', 'シークレットモードをやめて', 'プライベートをやめて',
    '通常モードに戻して', '通常モードに戻る', 'exit private mode', 'private mode off'])(
    '"%s" toggles off when private mode is on', (p) => {
      const onTogglePrivateMode = jest.fn();
      const { vc, tm } = makeVC({ onTogglePrivateMode });
      tm._privateMode = true;
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('private-mode-off');
      expect(onTogglePrivateMode).toHaveBeenCalledTimes(1);
      expect(vc.speak.mock.calls.at(-1)[0]).toBe('プライベートモードをオフにします');
    });
  test('already-off answers honestly without toggling', () => {
    const onTogglePrivateMode = jest.fn();
    const { vc } = makeVC({ onTogglePrivateMode });
    vc.processCommand('プライベートモードを終了');
    expect(vc.lastCommand.key).toBe('private-mode-off');
    expect(onTogglePrivateMode).not.toHaveBeenCalled();
    expect(vc.speak.mock.calls.at(-1)[0]).toBe('プライベートモードはオフです');
  });
  test.each(['シークレットですか', 'プライベートですか', 'プライベートモードは',
    'プライベートモードですか', 'プライベートタブですか'])(
    '"%s" queries privacy status', (p) => {
      const { vc } = makeVC({ onPrivacyStatus: () => true });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('privacy-status');
      expect(vc.speak.mock.calls.at(-1)[0]).toBe('プライベートタブです');
    });
});

describe('contrast question form', () => {
  test.each(['ハイコントラストは', 'ハイコントラストはどう', 'ハイコントラストか',
    'ハイコントラストは今', 'is high contrast on'])(
    '"%s" asks status instead of toggling', (p) => {
      const onHighContrast = jest.fn();
      const { vc } = makeVC({ onHighContrast, onContrastStatus: () => true });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('contrast-status');
      expect(onHighContrast).not.toHaveBeenCalled();
      expect(vc.speak.mock.calls.at(-1)[0]).toContain('オン');
    });
  test('coexistence: setter phrases still toggle', () => {
    const onHighContrast = jest.fn(() => true);
    const { vc } = makeVC({ onHighContrast });
    vc.processCommand('ハイコントラストはオンにして');
    expect(vc.lastCommand.key).toBe('high-contrast');
    vc.processCommand('ハイコントラストをオンにして');
    expect(vc.lastCommand.key).toBe('high-contrast');
    expect(onHighContrast).toHaveBeenCalledTimes(2);
  });
});

describe('percent-jump midpoint misroute fix', () => {
  test.each(['真ん中に移動', '中央に移動', '中間に移動', 'ページの真ん中',
    '真ん中へ', '中間地点', '真ん中'])(
    '"%s" jumps to 50%, never navigates', (p) => {
      const onGoTo = jest.fn();
      const onReaderPercent = jest.fn(() => true);
      const { vc } = makeVC({ onGoTo, onReaderPercent });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('percent-jump');
      expect(onReaderPercent).toHaveBeenCalledWith(50);
      expect(onGoTo).not.toHaveBeenCalled();
    });
});

describe('alias pass XVI', () => {
  test.each([
    ['次のマッチ', 'find-next'], ['次のヒット', 'find-next'],
    ['次の検索結果', 'find-next'],
    ['前のマッチ', 'find-prev'], ['前の検索結果', 'find-prev'],
    ['検索結果は何件', 'find-status'], ['件数は', 'find-status'],
    ['目次一覧', 'toc'], ['目次を見せて', 'toc'], ['アウトライン', 'toc'],
    ['ページ構造', 'toc'], ['このページの構成', 'toc'], ['コンテンツ一覧', 'toc'],
    ['文字を読んで', 'read-word'], ['この漢字', 'read-word'],
    ['読み方を教えて', 'read-word'], ['ふりがな', 'read-word'],
    ['行を読んで', 'read-line'],
    ['ナレーションを止めて', 'stop-reading'], ['ナレーションをやめて', 'stop-reading'],
    ['読書をやめて', 'stop-reading'],
    ['読み上げを再開して', 'resume-reading'], ['読書を再開', 'resume-reading'],
    ['読書を続けて', 'resume-reading'],
    ['読んでいたところ', 'line-status'], ['どこまで読んでた', 'line-status'],
    ['つづきから読んで', 'read-here'], ['途中から読んで', 'read-here'],
    ['もっと下', 'scroll-down'], ['さらに下', 'scroll-down'],
    ['少しスクロール', 'scroll-down'], ['ちょっとスクロール', 'scroll-down'],
    ['もっと上', 'scroll-up'], ['さらに上', 'scroll-up'], ['一気に上', 'scroll-up'],
    ['いくつ開いてる', 'tab-status'], ['何個開いてる', 'tab-status'],
    ['全部で何タブ', 'tab-status'], ['タブ何個', 'tab-status'],
    ['履歴いくつ', 'history-count'], ['ブックマークいくつ', 'bookmark-count'],
    ['履歴を消して', 'clear-history'], ['履歴をリセット', 'clear-history'],
    ['お気に入りを削除', 'unbookmark-page'],
    ['次の章', 'next-heading'], ['前の章', 'prev-heading'],
    ['画面を説明して', 'describe-tab'], ['何が表示されてる', 'describe-tab'],
    ['どんなページ', 'describe-tab'], ['サイト名', 'describe-tab'],
    ['ページの概要', 'article-summary'], ['概要を教えて', 'article-summary'],
    ['今のURL', 'read-url'], ['アドレスは', 'read-url'],
    ['フォントサイズ', 'reader-scale-status']
  ])('"%s" routes to %s', (p, key) => {
    const { vc } = makeVC();
    vc.processCommand(p);
    expect(vc.lastCommand && vc.lastCommand.key).toBe(key);
  });
  test('coexistence: ピンを付けて pins (never unpins) a pinned tab', () => {
    const tabs = [makeTab('https://a.jp', 'A', { pinned: true })];
    const { vc, tm } = makeVC({ tabs });
    vc.processCommand('ピンを付けて');
    expect(vc.lastCommand.key).toBe('pin-active');
    expect(tm.togglePin).not.toHaveBeenCalled();
  });
  test('coexistence: プライベートモード bare still toggles', () => {
    const onTogglePrivateMode = jest.fn();
    const { vc } = makeVC({ onTogglePrivateMode });
    vc.processCommand('プライベートモード');
    expect(vc.lastCommand.key).toBe('private-mode');
    expect(onTogglePrivateMode).toHaveBeenCalled();
  });
});
