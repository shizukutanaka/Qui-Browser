/**
 * Invariant: a voice command's announce must match what the action really did.
 * Dispatch speaks `confirmationText` unconditionally, so a command whose
 * action can no-op (empty closed-stack, zero tabs closed, idle panel, unwired
 * handler, nothing being narrated, already inside VR) must NOT carry a static
 * success confirmation — it announces the real outcome inside the action,
 * like the close-duplicate-tabs / navigate / back siblings.
 *
 * Pre-fix every pin below hears the unconditional success claim while
 * nothing happened — a lying announce (WCAG 4.1.3 Status Messages).
 */

const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

// Node env has no TTS surface — once a test sets vc.synthesis, speak()
// proceeds to construct an utterance instead of early-returning.
global.SpeechSynthesisUtterance = class {
  constructor(text) {
    this.text = text;
  }
};

function makeVC() {
  const vc = new VoiceCommands();
  const spoken = [];
  vc.callbacks.onSpeak = (t) => spoken.push(t);
  return [vc, spoken];
}

function makeBrowserTabManager(overrides = {}) {
  return {
    reopenClosedTab: () => null,
    closeOtherTabs: () => 0,
    closeTabsToRight: () => 0,
    closeTabsToLeft: () => 0,
    duplicateTab: () => null,
    newTab: () => null,
    getActiveTab: () => null,
    ...overrides
  };
}

describe('voice announce honesty — tab operations', () => {
  test('reopen-tab announces the failure when nothing was closed before', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.processCommand('開き直す', 0.9);
    expect(spoken).toContain('開き直せるタブがありません');
    expect(spoken).not.toContain('閉じたタブを開き直します');
  });

  test('reopen-tab announces the reopen when a closed tab exists', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({
      tabManager: makeBrowserTabManager({ reopenClosedTab: () => 'https://example.com' })
    });
    vc.processCommand('開き直す', 0.9);
    expect(spoken).toContain('閉じたタブを開き直します');
  });

  test('close-other-tabs announces zero when only one tab is open', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.processCommand('他のタブを閉じて', 0.9);
    expect(spoken).toContain('他のタブはありません');
    expect(spoken).not.toContain('他のタブを閉じます');
  });

  test('close-other-tabs reports the real count', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({
      tabManager: makeBrowserTabManager({ closeOtherTabs: () => 2 })
    });
    vc.processCommand('他のタブを閉じて', 0.9);
    expect(spoken).toContain('2個のタブを閉じました');
  });

  test('close-tabs-right announces zero when nothing is to the right', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.processCommand('右のタブを閉じて', 0.9);
    expect(spoken).toContain('右側にタブはありません');
    expect(spoken).not.toContain('右側のタブを閉じます');
  });

  test('close-tabs-left announces zero when nothing is to the left', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.processCommand('左のタブを閉じて', 0.9);
    expect(spoken).toContain('左側にタブはありません');
    expect(spoken).not.toContain('左側のタブを閉じます');
  });

  test('duplicate-tab announces the refusal at the tab cap', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.processCommand('タブを複製', 0.9);
    expect(spoken).toContain('タブを複製できません');
    expect(spoken).not.toContain('タブを複製します');
  });

  test('duplicate-tab announces the duplicate when it worked', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({
      tabManager: makeBrowserTabManager({ duplicateTab: () => ({ url: 'https://example.com' }) })
    });
    vc.processCommand('タブを複製', 0.9);
    expect(spoken).toContain('タブを複製します');
  });

  test('new-tab announces the refusal at MAX_TABS', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.processCommand('新しいタブ', 0.9);
    expect(spoken).toContain('タブを開けません');
    expect(spoken).not.toContain('新しいタブを開きます');
  });

  test('new-tab announces the open when a panel was created', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({
      tabManager: makeBrowserTabManager({ newTab: () => ({ url: '' }) })
    });
    vc.processCommand('新しいタブ', 0.9);
    expect(spoken).toContain('新しいタブを開きます');
  });
});

describe('voice announce honesty — page state', () => {
  test('stop-loading announces idle when nothing is loading', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({
      tabManager: makeBrowserTabManager({
        getActiveTab: () => ({ loading: false, _loadController: null })
      })
    });
    vc.processCommand('読み込みを中止', 0.9);
    expect(spoken).toContain('読み込んでいません');
    expect(spoken).not.toContain('読み込みを中止します');
  });

  test('stop-loading announces the abort when a load is in flight', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({
      tabManager: makeBrowserTabManager({
        getActiveTab: () => ({ loading: true, _loadController: { abort() {} } })
      })
    });
    vc.processCommand('読み込みを中止', 0.9);
    expect(spoken).toContain('読み込みを中止します');
  });

  test('top-sites announces the gap when there is no top site', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({
      tabManager: makeBrowserTabManager(),
      onTopSites: () => false
    });
    vc.processCommand('トップサイト', 0.9);
    expect(spoken).toContain('よく使うサイトがありません');
    expect(spoken).not.toContain('よく使うサイトを開きます');
  });

  test('top-sites announces the open when a site exists', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({
      tabManager: makeBrowserTabManager(),
      onTopSites: () => true
    });
    vc.processCommand('トップサイト', 0.9);
    expect(spoken).toContain('よく使うサイトを開きます');
  });

  test('clear-history announces the write failure honestly', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({
      tabManager: makeBrowserTabManager(),
      onClearHistory: () => false
    });
    vc.processCommand('履歴を消去', 0.9);
    expect(spoken).toContain('履歴を消去できませんでした');
    expect(spoken).not.toContain('履歴を消去します');
  });

  test('clear-history announces the clear on success', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({
      tabManager: makeBrowserTabManager(),
      onClearHistory: () => true
    });
    vc.processCommand('履歴を消去', 0.9);
    expect(spoken).toContain('履歴を消去します');
  });
});

describe('voice announce honesty — VR mode + input method', () => {
  test('vr-enter announces "already in VR" inside a session', () => {
    const [vc, spoken] = makeVC();
    vc._onVREnter = () => true;
    vc.processCommand('enter vr', 0.9);
    expect(spoken).toContain('すでにVRモードです');
    expect(spoken).not.toContain('VRモードを開始します');
  });

  test('vr-enter announces it cannot start without a session', () => {
    const [vc, spoken] = makeVC();
    vc.processCommand('enter vr', 0.9);
    expect(spoken).toContain('VRモードを開始できません');
    expect(spoken).not.toContain('VRモードを開始します');
  });

  test('vr-exit announces "not in VR" when there is no session', () => {
    const [vc, spoken] = makeVC();
    vc._onVRExit = () => false;
    vc.processCommand('exit vr', 0.9);
    expect(spoken).toContain('VRモードではありません');
    expect(spoken).not.toContain('VRモードを終了します');
  });

  test('vr-exit announces the exit when the session ends', () => {
    const [vc, spoken] = makeVC();
    vc._onVRExit = () => true;
    vc.processCommand('exit vr', 0.9);
    expect(spoken).toContain('VRモードを終了します');
  });

  test('ime-toggle announces unavailable without a keyboard', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.processCommand('日本語入力', 0.9);
    expect(spoken).toContain('キーボードが利用できません');
    expect(spoken).not.toContain('日本語入力モードです');
  });

  test('ime-toggle announces the open/close it actually performed', () => {
    const [vc, spoken] = makeVC();
    const kb = {
      visible: false,
      show() {
        this.visible = true;
      },
      hide() {
        this.visible = false;
      }
    };
    vc.connectBrowser({ tabManager: makeBrowserTabManager(), vrKeyboard: kb });
    vc.processCommand('日本語入力', 0.9);
    expect(kb.visible).toBe(true);
    expect(spoken).toContain('日本語入力モードです');
    spoken.length = 0;
    vc.processCommand('日本語入力', 0.9);
    expect(kb.visible).toBe(false);
    expect(spoken).toContain('日本語入力を閉じます');
  });
});

describe('voice announce honesty — narration state', () => {
  const synth = (over = {}) => ({
    speaking: false,
    paused: false,
    pending: false,
    cancel() {},
    pause() {},
    resume() {},
    speak() {},
    ...over
  });

  test('stop-reading announces silence when nothing is being read', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.synthesis = synth();
    vc.processCommand('stop reading', 0.9);
    expect(spoken).toContain('読み上げていません');
    expect(spoken).not.toContain('読み上げを止めます');
  });

  test('stop-reading announces the stop while narrating', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.synthesis = synth({ speaking: true });
    vc.processCommand('stop reading', 0.9);
    expect(spoken).toContain('読み上げを止めます');
  });

  test('pause-reading announces silence when nothing is being read', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.synthesis = synth();
    vc.processCommand('pause the narration', 0.9);
    expect(spoken).toContain('読み上げていません');
    expect(spoken).not.toContain('読み上げを一時停止します');
  });

  test('pause-reading announces it is already paused', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.synthesis = synth({ speaking: true, paused: true });
    vc.processCommand('pause the narration', 0.9);
    expect(spoken).toContain('すでに一時停止しています');
    expect(spoken).not.toContain('読み上げを一時停止します');
  });

  test('pause-reading announces the pause while narrating', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.synthesis = synth({ speaking: true });
    vc.processCommand('pause the narration', 0.9);
    expect(spoken).toContain('読み上げを一時停止します');
  });

  test('resume-reading announces it is not paused', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.synthesis = synth({ speaking: true, paused: false });
    vc.processCommand('読み上げを再開', 0.9);
    expect(spoken).toContain('一時停止していません');
    expect(spoken).not.toContain('読み上げを再開します');
  });

  test('resume-reading announces the resume while paused', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.synthesis = synth({ speaking: true, paused: true });
    vc.processCommand('読み上げを再開', 0.9);
    expect(spoken).toContain('読み上げを再開します');
  });
});

describe('voice announce honesty — strip cycling + scrolling + panels', () => {
  test('keyboard announces unavailable without a vrKeyboard', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.processCommand('キーボード', 0.9);
    expect(spoken).toContain('キーボードが利用できません');
    expect(spoken).not.toContain('キーボードを開きます');
  });

  test('keyboard announces the open/close it actually performed', () => {
    const [vc, spoken] = makeVC();
    const kb = {
      visible: false,
      show() {
        this.visible = true;
      },
      hide() {
        this.visible = false;
      }
    };
    vc.connectBrowser({ tabManager: makeBrowserTabManager(), vrKeyboard: kb });
    vc.processCommand('キーボード', 0.9);
    expect(kb.visible).toBe(true);
    expect(spoken).toContain('キーボードを開きます');
    spoken.length = 0;
    vc.processCommand('キーボード', 0.9);
    expect(kb.visible).toBe(false);
    expect(spoken).toContain('キーボードを閉じます');
  });

  test('next-tab announces the edge when there is nothing to switch to', () => {
    const [vc, spoken] = makeVC();
    const tm = makeBrowserTabManager({
      activeIndex: 0,
      nextTab() {
        return this.activeIndex;
      }
    });
    vc.connectBrowser({ tabManager: tm });
    vc.processCommand('次のタブ', 0.9);
    expect(spoken).toContain('次のタブはありません');
    expect(spoken).not.toContain('次のタブに切り替えます');
  });

  test('next-tab announces the switch when the tab moves', () => {
    const [vc, spoken] = makeVC();
    const tm = makeBrowserTabManager({
      activeIndex: 0,
      nextTab() {
        this.activeIndex = 1;
        return 1;
      }
    });
    vc.connectBrowser({ tabManager: tm });
    vc.processCommand('次のタブ', 0.9);
    expect(spoken).toContain('次のタブに切り替えます');
  });

  test('prev-tab announces the edge when there is nothing to switch to', () => {
    const [vc, spoken] = makeVC();
    const tm = makeBrowserTabManager({
      activeIndex: 0,
      prevTab() {
        return this.activeIndex;
      }
    });
    vc.connectBrowser({ tabManager: tm });
    vc.processCommand('前のタブ', 0.9);
    expect(spoken).toContain('前のタブはありません');
    expect(spoken).not.toContain('前のタブに切り替えます');
  });

  test('prev-tab announces the switch when the tab moves', () => {
    const [vc, spoken] = makeVC();
    const tm = makeBrowserTabManager({
      activeIndex: 1,
      prevTab() {
        this.activeIndex = 0;
        return 0;
      }
    });
    vc.connectBrowser({ tabManager: tm });
    vc.processCommand('前のタブ', 0.9);
    expect(spoken).toContain('前のタブに切り替えます');
  });

  test('scroll-top announces the gap when there is nothing to scroll', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.processCommand('先頭へ', 0.9);
    expect(spoken).toContain('スクロールできません');
    expect(spoken).not.toContain('先頭へ移動します');
  });

  test('scroll-top announces the jump when the panel moves', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({
      tabManager: makeBrowserTabManager({ getActiveTab: () => ({ scrollToTop: () => true }) })
    });
    vc.processCommand('先頭へ', 0.9);
    expect(spoken).toContain('先頭へ移動します');
  });

  test('scroll-bottom announces the gap when there is nothing to scroll', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.processCommand('末尾へ', 0.9);
    expect(spoken).toContain('スクロールできません');
    expect(spoken).not.toContain('末尾へ移動します');
  });

  test('next-page announces the gap when there is nothing to scroll', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.processCommand('次のページ', 0.9);
    expect(spoken).toContain('スクロールできません');
    expect(spoken).not.toContain('次のページへ進みます');
  });

  test('prev-page announces the page it actually turned', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({
      tabManager: makeBrowserTabManager({ getActiveTab: () => ({ scrollContentPage: () => true }) })
    });
    vc.processCommand('前のページ', 0.9);
    expect(spoken).toContain('前のページへ戻ります');
  });

  test('refresh announces it cannot refresh a blank tab', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({
      tabManager: makeBrowserTabManager({
        getActiveTab: () => ({ reload: jest.fn(), currentUrl: '' })
      })
    });
    vc.processCommand('リロード', 0.9);
    expect(spoken).toContain('ページを更新できません');
    expect(spoken).not.toContain('更新します');
  });

  test('refresh announces the refresh on a loaded page', () => {
    const [vc, spoken] = makeVC();
    const panel = { reload: jest.fn(), currentUrl: 'https://example.com' };
    vc.connectBrowser({ tabManager: makeBrowserTabManager({ getActiveTab: () => panel }) });
    vc.processCommand('リロード', 0.9);
    expect(panel.reload).toHaveBeenCalled();
    expect(spoken).toContain('更新します');
  });

  test('search announces it cannot search when nothing is wired', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.processCommand('検索：てんき', 0.9);
    expect(spoken).toContain('検索できません');
    expect(spoken).not.toContain('検索します');
  });

  test('search announces the search it dispatched', () => {
    const [vc, spoken] = makeVC();
    const onSearch = jest.fn();
    vc.connectBrowser({ tabManager: makeBrowserTabManager(), onSearch });
    vc.processCommand('検索：てんき', 0.9);
    expect(onSearch).toHaveBeenCalledWith('てんき');
    expect(spoken).toContain('検索します');
  });

  test('private-mode announces it cannot toggle when unwired', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.processCommand('プライベートモードにして', 0.9);
    expect(spoken).toContain('プライベートモードを切り替えられません');
    expect(spoken).not.toContain('プライベートモードを切り替えます');
  });

  test('private-mode announces the toggle it performed', () => {
    const [vc, spoken] = makeVC();
    const onTogglePrivateMode = jest.fn();
    vc.connectBrowser({ tabManager: makeBrowserTabManager(), onTogglePrivateMode });
    vc.processCommand('プライベートモードにして', 0.9);
    expect(onTogglePrivateMode).toHaveBeenCalled();
    expect(spoken).toContain('プライベートモードを切り替えます');
  });

  test('history announces it cannot open when the panel is missing', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.processCommand('履歴を開いて', 0.9);
    expect(spoken).toContain('履歴を開けません');
    expect(spoken).not.toContain('履歴を開きます');
  });

  test('history announces the open it performed', () => {
    const [vc, spoken] = makeVC();
    const bookmarkPanel = {
      visible: false,
      setMode: jest.fn(),
      show: jest.fn(function () {
        this.visible = true;
      })
    };
    vc.connectBrowser({ tabManager: makeBrowserTabManager(), bookmarkPanel });
    vc.processCommand('履歴を開いて', 0.9);
    expect(bookmarkPanel.setMode).toHaveBeenCalledWith('history');
    expect(spoken).toContain('履歴を開きます');
  });

  test('bookmark-page announces it cannot bookmark when unwired', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.processCommand('このページをブックマーク', 0.9);
    expect(spoken).toContain('ブックマークできません');
    expect(spoken).not.toContain('ブックマークを切り替えます');
  });

  test('bookmark-page announces the toggle it performed', () => {
    const [vc, spoken] = makeVC();
    const onBookmarkPage = jest.fn();
    vc.connectBrowser({ tabManager: makeBrowserTabManager(), onBookmarkPage });
    vc.processCommand('このページをブックマーク', 0.9);
    expect(onBookmarkPage).toHaveBeenCalled();
    expect(spoken).toContain('ブックマークを切り替えます');
  });

  test('bookmarks announces it cannot open when the panel is missing', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.processCommand('ブックマーク', 0.9);
    expect(spoken).toContain('ブックマークを開けません');
    expect(spoken).not.toContain('ブックマークを開きます');
  });

  test('bookmarks announces the direction it actually toggled', () => {
    const [vc, spoken] = makeVC();
    const bookmarkPanel = {
      visible: false,
      toggle: jest.fn(function () {
        this.visible = !this.visible;
      })
    };
    vc.connectBrowser({ tabManager: makeBrowserTabManager(), bookmarkPanel });
    vc.processCommand('ブックマーク', 0.9);
    expect(spoken).toContain('ブックマークを開きます');
    spoken.length = 0;
    vc.processCommand('ブックマーク', 0.9);
    expect(spoken).toContain('ブックマークを閉じます');
  });

  test('bookmarks-open announces it cannot open when the panel is missing', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.processCommand('ブックマークを開いて', 0.9);
    expect(spoken).toContain('ブックマークを開けません');
    expect(spoken).not.toContain('ブックマークを開きます');
  });

  test('bookmarks-open announces the open it performed', () => {
    const [vc, spoken] = makeVC();
    const bookmarkPanel = {
      visible: false,
      setMode: jest.fn(),
      show: jest.fn(function () {
        this.visible = true;
      })
    };
    vc.connectBrowser({ tabManager: makeBrowserTabManager(), bookmarkPanel });
    vc.processCommand('ブックマークを開いて', 0.9);
    expect(spoken).toContain('ブックマークを開きます');
  });
});

describe('voice announce honesty — go-to dispatch', () => {
  test('go-to keeps the understood cue when it can dispatch', () => {
    const [vc, spoken] = makeVC();
    const onGoTo = jest.fn();
    vc.connectBrowser({ tabManager: makeBrowserTabManager(), onGoTo });
    vc.processCommand('githubを開く', 0.9);
    expect(spoken).toContain('開きます');
    expect(onGoTo).toHaveBeenCalledWith('github');
  });

  test('go-to announces it cannot open when no handler is wired', () => {
    const [vc, spoken] = makeVC();
    vc.connectBrowser({ tabManager: makeBrowserTabManager() });
    vc.processCommand('githubを開く', 0.9);
    expect(spoken).toContain('開けませんでした');
    expect(spoken).not.toContain('開きます');
  });
});
