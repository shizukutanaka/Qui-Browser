/**
 * Round 60 atoms — move-tab-to-n (ordinal position), session-time,
 * about, dismiss-notify, and alias pass XVII (move して/送って forms,
 * help discovery, panel-distance imperatives, collection-search
 * bare prompts, mute/video-stop/read variants).
 *
 * - move-tab-to-n: '2番目に移動して'/'move tab to position N' — the
 *   indexed twin of move-tab-start/end. go-to's /に移動/ catch-all owned
 *   them and navigated to the literal phrase (probe-verified misroute);
 *   registered before go-to.
 * - session-time: 'どれくらい使ってる'/'how long have i been' answers
 *   elapsed minutes from a constructor timestamp — digital-wellbeing
 *   parity for a headset that hides OS clocks.
 * - about: 'バージョンは'/'what browser' names the product honestly (no
 *   version string reaches this layer).
 * - dismiss-notify: '通知を消して'/'dismiss the notification' clears the
 *   caption queue via onDismissNotify; without the hook it honestly
 *   answers that toasts auto-expire.
 * - history-search / bookmark-search: bare '履歴を検索して' prompts for
 *   a term instead of searching the literal empty string.
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
      this.findQueryValue = null;
      this.findCount = 0;
    }
    addToScene(parent) { this.parent = parent; }
    navigate(url) { this.currentUrl = url; }
    setVisible(v) { this.visible = !!v; }
    dispose() { this.disposed = true; }
    findInReader(q) { this.findQueryValue = q; return this.findCount; }
    findQuery() { return this.findQueryValue; }
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
  vc.speak = jest.fn((t) => spoken.push(t));
  vc.synthesis = { speak: () => {}, cancel: () => {}, speaking: false };
  const tm = new TabManager({
    scene: { add: jest.fn(), remove: jest.fn() },
    registerInteractable: jest.fn(),
    unregisterInteractable: jest.fn(),
    onNavigate: jest.fn(),
    maxTabs: 8
  });
  tm.newTab('https://a.jp');
  tm.newTab('https://b.jp');
  tm.newTab('https://c.jp');
  vc.connectBrowser({ tabManager: tm, ...opts });
  return { vc, spoken, tm };
}

describe('move-tab-to-n: ordinal strip position', () => {
  test.each(['2番目に移動して', '三番目に移動', '2番目に動かして',
    '二番目にして', '3番目に移動して'])(
    '"%s" moves the active tab to position N — never navigates', (phrase) => {
      const onGoTo = jest.fn();
      const { vc, tm } = makeVC({ onGoTo });
      tm.setActive(0);
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('move-tab-to-n');
      expect(onGoTo).not.toHaveBeenCalled();
      expect(tm.tabs[0].currentUrl === 'https://a.jp'
        ? tm.activeIndex !== 0
        : tm.activeIndex !== 0).toBe(true);
    }
  );

  test('"move this tab to position 2" moves one step right', () => {
    const { vc, tm } = makeVC();
    tm.setActive(0);
    vc.processCommand('move this tab to position 2');
    expect(vc.lastCommand.key).toBe('move-tab-to-n');
    expect(tm.activeIndex).toBe(1);
  });

  test.each(['1番目に移動して'])('"%s" on the active position is honest', (p) => {
    const { vc, spoken, tm } = makeVC();
    tm.setActive(0);
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('move-tab-to-n');
    expect(spoken[0]).toBe('すでにタブ1番目です');
    expect(tm.activeIndex).toBe(0);
  });

  test('out-of-range position refuses honestly', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('9番目に移動して');
    expect(vc.lastCommand.key).toBe('move-tab-to-n');
    expect(spoken[0]).toBe('タブ9には移動できません');
  });

  test('moving to position 3 lands the tab third', () => {
    const { vc, tm } = makeVC();
    tm.setActive(0);
    vc.processCommand('3番目に移動して');
    expect(tm.activeIndex).toBe(2);
    expect(tm.tabs[2].currentUrl).toBe('https://a.jp');
  });
});

describe('move して/送って forms', () => {
  test.each(['最後に送って', '一番右に移動して', '右端に移動して', '末尾に送って'])(
    '"%s" moves the tab to the end', (p) => {
      const { vc, tm } = makeVC();
      tm.setActive(0);
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('move-tab-end');
      expect(tm.activeIndex).toBe(2);
    }
  );
  test.each(['先頭に送って', '一番左に移動して', '左端に移動して'])(
    '"%s" moves the tab to the start', (p) => {
      const { vc, tm } = makeVC();
      tm.setActive(2);
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('move-tab-start');
      expect(tm.activeIndex).toBe(0);
    }
  );
  test('"タブを右に送って" steps right once', () => {
    const { vc, tm } = makeVC();
    tm.setActive(0);
    vc.processCommand('タブを右に送って');
    expect(vc.lastCommand.key).toBe('move-tab-right');
    expect(tm.activeIndex).toBe(1);
  });
  test('"タブを左に移動して" steps left once', () => {
    const { vc, tm } = makeVC();
    tm.setActive(1);
    vc.processCommand('タブを左に移動して');
    expect(vc.lastCommand.key).toBe('move-tab-left');
    expect(tm.activeIndex).toBe(0);
  });
});

describe('session-time', () => {
  test.each(['どれくらい使ってる', '起動してから', '使用時間', '経過時間',
    'セッション時間', 'screen time', 'how long have i been'])(
    '"%s" reports elapsed time', (p) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('session-time');
      expect(spoken[0]).toBe('起動してから1分未満です');
    }
  );
});

describe('about', () => {
  test.each(['バージョンは', 'ブラウザの名前', '何のブラウザ',
    'what browser', 'browser version'])(
    '"%s" names the browser', (p) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('about');
      expect(spoken[0]).toBe('このブラウザはQui-Browserです');
    }
  );
});

describe('dismiss-notify', () => {
  test.each(['通知を消して', 'トーストを消して', 'メッセージを閉じて',
    'ダイアログを閉じて', 'dismiss the notification', 'clear notifications'])(
    '"%s" clears pending notifications via the hook', (p) => {
      const onDismissNotify = jest.fn(() => true);
      const { vc, spoken } = makeVC({ onDismissNotify });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('dismiss-notify');
      expect(onDismissNotify).toHaveBeenCalled();
      expect(spoken[0]).toBe('通知を消去しました');
    }
  );
  test('without the hook it answers honestly', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('通知を消して');
    expect(spoken[0]).toBe('表示は自動で消えます');
  });
});

describe('collection-search bare prompts', () => {
  test.each(['履歴を検索して', '履歴で検索', '履歴を検索'])(
    '"%s" prompts for a term instead of searching ""', (p) => {
      const onHistorySearch = jest.fn(() => ({ count: 1, title: 'x' }));
      const { vc, spoken } = makeVC({ onHistorySearch });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('history-search');
      expect(onHistorySearch).not.toHaveBeenCalled();
      expect(spoken[0]).toBe('履歴で検索する語を言ってください');
    }
  );
  test('"履歴でニュースを検索" still searches the term', () => {
    const onHistorySearch = jest.fn(() => ({ count: 2, title: 'ニュース' }));
    const { vc, spoken } = makeVC({ onHistorySearch });
    vc.processCommand('履歴でニュースを検索');
    expect(onHistorySearch).toHaveBeenCalledWith('ニュース');
    expect(spoken[0]).toBe('2件見つかりました。最近: ニュース');
  });
  test.each(['ブックマークを検索して', 'ブックマークで検索'])(
    '"%s" prompts for a term', (p) => {
      const onBookmarkSearch = jest.fn(() => ({ count: 1, title: 'x' }));
      const { vc, spoken } = makeVC({ onBookmarkSearch });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('bookmark-search');
      expect(onBookmarkSearch).not.toHaveBeenCalled();
      expect(spoken[0]).toBe('ブックマークを検索する語を言ってください');
    }
  );
});

describe('alias pass XVII', () => {
  test.each(['操作方法', 'できること', 'コマンドを教えて', 'コマンド一覧を読んで',
    'ヘルプを読んで', '聞き方を教えて', '音声ガイド', '何ができますか'])(
    '"%s" → help', (p) => {
      const { vc } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('help');
    }
  );
  test.each(['読み込み終わった', '読み込み完了', '更新中ですか'])(
    '"%s" → loading-status', (p) => {
      const { vc } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('loading-status');
    }
  );
  test.each(['残り時間', 'どれくらい残ってる'])(
    '"%s" → remaining-time', (p) => {
      const { vc } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('remaining-time');
    }
  );
  test.each(['スペル', 'つづりを教えて'])(
    '"%s" → spell-word', (p) => {
      const { vc } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('spell-word');
    }
  );
  test.each(['発音して', '発音を教えて'])(
    '"%s" → read-word', (p) => {
      const { vc } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('read-word');
    }
  );
  test.each(['なんて言った', '今なんて言った', 'なんて言ってた'])(
    '"%s" → say-last-transcript', (p) => {
      const { vc } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('say-last-transcript');
    }
  );
  test.each(['復唱して', '言い直し', '読み直して'])(
    '"%s" → say-again', (p) => {
      const { vc } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('say-again');
    }
  );
  test.each(['曲を止めて', '音楽を止めて', 'メディアを止めて', '映像を止めて'])(
    '"%s" → video-stop', (p) => {
      const { vc } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('video-stop');
    }
  );
  test.each(['このタブをミュート', 'タブを消音', 'このページをミュート',
    'サイトをミュート', '全部ミュート', '消音して', 'ミュートして'])(
    '"%s" → mute-toggle', (p) => {
      const { vc } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('mute-toggle');
    }
  );
  test.each([['近づけて', -0.2], ['遠ざけて', 0.2], ['もっと近く', -0.2],
    ['もっと遠く', 0.2], ['大きく見せて', -0.2], ['小さく見せて', 0.2]])(
    '"%s" → panel-distance delta %s', (p, delta) => {
      const onPanelDistance = jest.fn((d) => 2 + d);
      const { vc } = makeVC({ onPanelDistance });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('panel-distance');
      expect(onPanelDistance).toHaveBeenCalledWith(delta);
    }
  );
  test.each(['強調を消して', '蛍光ペンを消して', '選択を解除', '選択をやめて'])(
    '"%s" → clear-find', (p) => {
      const onClearFind = jest.fn(() => true);
      const { vc } = makeVC({ onClearFind });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('clear-find');
    }
  );
  test.each(['全部コピー', 'ページ全体をコピー', 'copy all'])(
    '"%s" → copy-article', (p) => {
      const onCopyArticle = jest.fn(() => 42);
      const { vc } = makeVC({ onCopyArticle });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('copy-article');
      expect(onCopyArticle).toHaveBeenCalled();
    }
  );
});
