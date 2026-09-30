/**
 * Round 58 atoms — recently-closed list + open-all-bookmarks + find-open
 * misroute fixes + alias pass XV.
 *
 * - closed-list: '閉じたタブの一覧'/'最近閉じたタブ'/'何個閉じた' — Chrome
 *   history "recently closed" parity. Read-only twin of the reopen LIFO
 *   stack: reports counts + the three most recent URLs without reopening.
 *   Private tabs never enter the stack so they never appear (tested).
 * - open-all-bookmarks: 'お気に入りをすべて開いて'/'open all bookmarks' —
 *   Chrome's "open all bookmarks" context entry. Iterates onBookmarkList
 *   and stops at the tab cap with an honest remainder count.
 * - Misroute fixes (probe-verified): 'ブックマーク一覧を開いて' and
 *   'ページ内検索を開いて'/'検索を開いて'/'検索バーを開いて' were
 *   literal-navigating via go-to's 'を開いて' catch-all — the first now
 *   lands on bookmarks-open, the rest on find-in-page's bare prompt
 *   ('検索する語を言ってください'), which already existed for 'ページ内検索'.
 * - reopen-tab 'て'-forms: '閉じたタブを開き直して' was a NO-MATCH.
 * - alias pass: close-other-tabs 'このタブだけ残して'/'このタブ以外を閉じて',
 *   bookmark-page 'しおりを挟んで', stop-reading '読み上げをやめる',
 *   recenter '正面に戻して'/'向きをリセット', speech-faster '早口で',
 *   speech-slower 'もっとゆっくり', read-here '残りを読んで'/'ここを読んで',
 *   read-sentence '今の文を読み直して', trouble '目を休めたい'/'暗い'/
 *   '見えない', vr-exit '全画面を閉じて', clear-find 'ハイライトを外して'/
 *   '検索をやめて', close-tab 'このページを閉じて', bookmarks toggle
 *   'ブックマークを閉じて', next/prev-page '…を読んで', say-again
 *   'なんと言った'/'繰り返して'/'聞き取れなかった', reader-size-up
 *   '大きくして'/'文字が見にくい'.
 * THREE / WebPanel / canvas stubs mirror nav-depth-atoms.test.js.
 */

// ── THREE stub ────────────────────────────────────────────────────────────────
class MockGroup {
  constructor() {
    this.position = { set: jest.fn() };
    this._objects = [];
  }
  add(o) { this._objects.push(o); }
  remove(o) { this._objects = this._objects.filter(x => x !== o); }
  traverse(fn) { this._objects.forEach(fn); fn(this); }
}
class MockMesh {
  constructor() {
    this.name = '';
    this.position = { set: jest.fn() };
  }
  worldToLocal(v) { return v; }
}
jest.mock('three', () => ({
  Group: MockGroup,
  Mesh: MockMesh,
  PlaneGeometry: class { dispose() {} },
  MeshBasicMaterial: class { dispose() {} },
  CanvasTexture: class { constructor() { this.needsUpdate = false; } dispose() {} }
}));

// ── WebPanel stub ─────────────────────────────────────────────────────────────
jest.mock('../src/vr/browser/WebPanel.js', () => ({
  WebPanel: class {
    constructor(opts) {
      this.opts = opts;
      this.isPrivate = !!opts.privateMode;
      this.pinned = false;
      this.currentUrl = '';
      this.currentTitle = '';
      this.group = { position: { set: jest.fn() } };
      this.visible = false;
      this.disposed = false;
    }
    addToScene(parent) { this.parent = parent; }
    navigate(url) { this.currentUrl = url; }
    setVisible(v) { this.visible = !!v; }
    dispose() { this.disposed = true; }
  }
}));

global.document = {
  createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({
      clearRect: jest.fn(), fillRect: jest.fn(), fillText: jest.fn(),
      beginPath: jest.fn(), arc: jest.fn(), fill: jest.fn(),
      fillStyle: '', font: '', textAlign: '', textBaseline: ''
    })
  })
};
global.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(t) {
  this.text = t;
};

const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');
const { TabManager } = require('../src/vr/browser/TabManager.js');

function makeVC(opts = {}) {
  const vc = new VoiceCommands();
  const spoken = [];
  vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: () => {}, speaking: false };
  const tm = new TabManager({
    scene: { add: jest.fn(), remove: jest.fn() },
    registerInteractable: jest.fn(),
    unregisterInteractable: jest.fn(),
    onNavigate: jest.fn(),
    maxTabs: 8
  });
  tm.newTab('https://a.jp');
  vc.connectBrowser({ tabManager: tm, ...opts });
  return { vc, spoken, tm };
}

describe('closed-list: recently closed readout', () => {
  test.each(['閉じたタブの一覧', '最近閉じたタブ', '最近閉じたタブを読んで',
    '閉じたタブは何', 'さっき閉じたタブは何', '何個閉じた', 'いくつ閉じた',
    'recently closed', 'closed tabs', 'what did i close'])(
    '"%s" reports the closed stack', (p) => {
      const { vc, spoken, tm } = makeVC();
      tm.newTab('https://b.jp');
      tm.closeTab(1);
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('closed-list');
      expect(vc.lastCommand.result.count).toBe(1);
      expect(spoken[spoken.length - 1]).toContain('1個のタブを閉じました');
      expect(spoken[spoken.length - 1]).toContain('https://b.jp');
    }
  );

  test('empty stack answers honestly', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('閉じたタブの一覧');
    expect(spoken[0]).toBe('閉じたタブはありません');
  });

  test('most-recent-first ordering and 3-item cap', () => {
    const { vc, spoken, tm } = makeVC();
    ['1', '2', '3', '4'].forEach(n => { tm.newTab(`https://t${n}.jp`); tm.closeTab(tm.tabs.length - 1); });
    vc.processCommand('閉じたタブの一覧');
    const say = spoken[spoken.length - 1];
    expect(say).toContain('4個のタブを閉じました');
    // Most recent (t4) listed first; capped at 3 + remainder count.
    expect(say.indexOf('t4')).toBeLessThan(say.indexOf('t3'));
    expect(say).toContain('他1件');
    expect(say).not.toContain('t1.jp');
  });

  test('private tabs never enter the list', () => {
    const { vc, spoken, tm } = makeVC();
    tm.newTab('https://secret.jp', { privateMode: true });
    tm.closeTab(tm.tabs.length - 1);
    vc.processCommand('閉じたタブの一覧');
    expect(spoken[0]).toBe('閉じたタブはありません');
  });

  test('readout does not pop the stack (reopen still works)', () => {
    const { vc, tm } = makeVC();
    tm.newTab('https://b.jp');
    tm.closeTab(1);
    vc.processCommand('閉じたタブの一覧');
    vc.processCommand('閉じたタブを開いて');
    expect(tm.tabs.some(t => t.currentUrl === 'https://b.jp')).toBe(true);
  });
});

describe('open-all-bookmarks', () => {
  test.each(['お気に入りをすべて開いて', 'お気に入りを全部開いて',
    'ブックマークをすべて開いて', 'ブックマークを全部開いて',
    '全部のブックマークを開いて', 'すべてのブックマークを開いて',
    'open all bookmarks'])('"%s" opens every bookmark', (p) => {
    const onBookmarkList = jest.fn(() => [
      { title: 'b1', url: 'https://b1.jp' },
      { title: 'b2', url: 'https://b2.jp' }
    ]);
    const { vc, spoken, tm } = makeVC({ onBookmarkList });
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('open-all-bookmarks');
    expect(vc.lastCommand.result.opened).toBe(2);
    expect(spoken[0]).toBe('2個のブックマークを開きました');
    expect(tm.tabs.length).toBe(3); // seed tab + two opened
  });

  test('tab cap announces the unopened remainder honestly', () => {
    const onBookmarkList = jest.fn(() =>
      Array.from({ length: 10 }, (_, i) => ({ title: `b${i}`, url: `https://b${i}.jp` })));
    const { vc, spoken, tm } = makeVC({ onBookmarkList });
    vc.processCommand('ブックマークを全部開いて');
    expect(tm.tabs.length).toBe(8); // MAX_TABS
    expect(vc.lastCommand.result.opened).toBe(7);
    expect(spoken[0]).toContain('上限で残り3件は開けません');
  });

  test('empty list and missing hook answer honestly', () => {
    const { vc, spoken } = makeVC({ onBookmarkList: () => [] });
    vc.processCommand('ブックマークを全部開いて');
    expect(spoken[0]).toBe('ブックマークがありません');
    const bare = makeVC();
    bare.vc.processCommand('ブックマークを全部開いて');
    expect(bare.spoken[0]).toBe('ブックマーク一覧が利用できません');
  });
});

describe('misroute fixes', () => {
  test.each(['ブックマーク一覧を開いて', 'ブックマークの一覧を開いて',
    'お気に入り一覧を開いて'])(
    '"%s" opens the bookmarks panel, never navigates', (p) => {
      const onGoTo = jest.fn();
      const { vc } = makeVC({ onGoTo });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('bookmarks-open');
      expect(onGoTo).not.toHaveBeenCalled();
    }
  );

  test.each(['ページ内検索を開いて', 'ページ内検索を開く', '検索を開いて',
    '検索を開く', '検索バーを開いて', '検索バーを開く', '検索バーを出して',
    '検索を始めて', '検索をはじめて', '検索モード'])(
    '"%s" prompts for a find term, never navigates', (p) => {
      const onGoTo = jest.fn();
      const { vc, spoken } = makeVC({ onGoTo });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('find-in-page');
      expect(spoken[0]).toBe('検索する語を言ってください');
      expect(onGoTo).not.toHaveBeenCalled();
    }
  );

  test('coexistence: a real query still searches', () => {
    const { vc, tm } = makeVC();
    tm.getActiveTab().findInReader = jest.fn(() => 3);
    vc.processCommand('ページ内でバナナを検索');
    expect(vc.lastCommand.key).toBe('find-in-page');
    expect(vc.lastCommand.result.count).toBe(3);
  });

  test.each(['閉じたタブを開き直して', '開き直して', 'タブを開き直して',
    '閉じたタブをもう一度開いて', 'さっき閉じたタブを開いて'])(
    '"%s" reopens the closed tab', (p) => {
      const { vc, tm } = makeVC();
      tm.newTab('https://b.jp');
      tm.closeTab(1);
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('reopen-tab');
      expect(tm.tabs.some(t => t.currentUrl === 'https://b.jp')).toBe(true);
    }
  );
});

describe('alias pass XV', () => {
  test.each(['このタブだけ残して', 'このタブ以外を閉じて', '他のタブを全部閉じて',
    '残りのタブを閉じて'])('"%s" → close-other-tabs', (p) => {
    const { vc, tm } = makeVC();
    tm.newTab('https://b.jp');
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('close-other-tabs');
    expect(tm.tabs.length).toBe(1);
  });

  test.each(['しおりを挟んで', '栞を挟んで'])('"%s" → bookmark-page', (p) => {
    const onBookmarkPage = jest.fn();
    const { vc } = makeVC({ onBookmarkPage });
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('bookmark-page');
    expect(onBookmarkPage).toHaveBeenCalled();
  });

  test.each(['読み上げをやめる', '読み上げをやめて', '読むのをやめて'])(
    '"%s" → stop-reading', (p) => {
      const { vc } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('stop-reading');
    }
  );

  test.each(['正面に戻して', '向きをリセット', 'カメラをリセット',
    '視点をリセット'])('"%s" → recenter', (p) => {
    const onRecenter = jest.fn(() => true);
    const { vc } = makeVC({ onRecenter });
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('recenter');
    expect(onRecenter).toHaveBeenCalled();
  });

  test.each(['もっとゆっくり', 'もう少しゆっくり'])('"%s" → speech-slower', (p) => {
    const { vc } = makeVC();
    const before = vc._speechRate;
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('speech-slower');
    expect(vc._speechRate).toBeLessThan(before);
  });

  test.each(['早口で', 'もっと早く'])('"%s" → speech-faster', (p) => {
    const { vc } = makeVC();
    const before = vc._speechRate;
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('speech-faster');
    expect(vc._speechRate).toBeGreaterThan(before);
  });

  test.each(['残りを読んで', '残り全部読んで', 'ここを読んで', 'この辺を読んで',
    '続きを全部読んで'])('"%s" → read-here', (p) => {
    const onReadHere = jest.fn(() => ['a', 'b']);
    const { vc } = makeVC({ onReadHere });
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('read-here');
    expect(onReadHere).toHaveBeenCalled();
  });

  test.each(['今の文を読み直して', 'この文を読み直して', '文を読み直して'])(
    '"%s" → read-sentence', (p) => {
      const onSentence = jest.fn(() => ({ sentence: 'テスト文' }));
      const { vc } = makeVC({ onSentence });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('read-sentence');
    }
  );

  test.each(['目を休めたい', '暗い', '見えない', '疲れてきた'])(
    '"%s" → trouble', (p) => {
      const { vc } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('trouble');
    }
  );

  test.each(['全画面を閉じて', '全画面を解除して', 'フルスクリーンを閉じて'])(
    '"%s" → vr-exit', (p) => {
      const { vc } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('vr-exit');
    }
  );

  test.each(['ハイライトを外して', 'ハイライトを取り除いて', '検索をやめて'])(
    '"%s" → clear-find', (p) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('clear-find');
      expect(spoken[0]).toBe('検索をしていません');
    }
  );

  test.each(['このページを閉じて', 'このページを閉じる', 'このサイトを閉じて'])(
    '"%s" → close-tab', (p) => {
      const { vc, tm } = makeVC();
      tm.newTab('https://b.jp');
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('close-tab');
      expect(tm.tabs.length).toBe(1);
    }
  );

  test('ブックマークを閉じて → bookmarks toggle', () => {
    const bookmarkPanel = { visible: true, toggle: jest.fn() };
    const { vc } = makeVC({ bookmarkPanel });
    vc.processCommand('ブックマークを閉じて');
    expect(vc.lastCommand.key).toBe('bookmarks');
    expect(bookmarkPanel.toggle).toHaveBeenCalled();
  });

  test.each(['次のページを読んで'])('"%s" → next-page', (p) => {
    const { vc, tm } = makeVC();
    const spy = jest.fn();
    tm.getActiveTab().scrollContentPage = spy;
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('next-page');
    expect(spy).toHaveBeenCalledWith(1);
  });

  test.each(['前のページを読んで'])('"%s" → prev-page', (p) => {
    const { vc, tm } = makeVC();
    const spy = jest.fn();
    tm.getActiveTab().scrollContentPage = spy;
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('prev-page');
    expect(spy).toHaveBeenCalledWith(-1);
  });

  test('coexistence: 進んで/戻って page forms stay with history nav', () => {
    const { vc } = makeVC();
    vc.processCommand('前のページに戻って');
    expect(vc.lastCommand.key).toBe('back');
  });

  test.each(['繰り返して', 'もう一度お願い',
    '聞き取れなかった', 'もう一度聞かせて'])('"%s" → say-again', (p) => {
    const { vc, spoken } = makeVC();
    vc._lastSpoken = 'テスト発話';
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('say-again');
    expect(spoken[0]).toBe('テスト発話');
  });

  test.each(['大きくして', '文字が見にくい', '字が見にくい'])(
    '"%s" → reader-size-up', (p) => {
      const onReaderSize = jest.fn(() => 1.4);
      const { vc } = makeVC({ onReaderSize });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('reader-size-up');
    }
  );
});
