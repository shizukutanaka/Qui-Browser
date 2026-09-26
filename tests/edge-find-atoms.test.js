/**
 * Round 56 atoms — strip-edge moves + strip sweepers + find-again +
 * alias pass XIII.
 *
 * - move-tab-start / move-tab-end: go-to's /に移動/ catch-all owned
 *   '右端に移動'/'左端に移動'/'先頭に移動'/'最後に移動' and navigated to the
 *   literal phrase — probe-verified misroute. Registered before go-to;
 *   TabManager.moveTabToStart/End keep the pinned-cluster rule.
 * - close-duplicate-tabs / close-unpinned-tabs / close-normal-tabs: the
 *   remaining bulk-close surfaces ("close duplicate tabs" extension,
 *   Chrome "close unpinned" parity, close-private-tabs twin).
 * - find-again: 'もう一度検索'/'find again' replays the active query —
 *   repeat-command's find twin (repeat replays the transcript, this replays
 *   the query). Hoisted before find-in-page so 'find again' isn't searched
 *   literally.
 * - alias pass: 戻って/進んで bare forms, 再起動/再読み込み, スクロール,
 *   めくって, 半分/真ん中→50%, ビデオ forms, 一旦停止, complaints
 *   (目が痛い/疲れた/つながらない/回線が悪い/充電がない), HTTPSですか,
 *   ドメイン名, お気に入りから削除, 何をコピーした, タブの名前,
 *   見つからなかった, 読了まで, 全部で何行/文/段落, 何タブ,
 *   開いてるウィンドウ, もう一個タブ, 閉じて, ピンを付けて/取って,
 *   読み上げが遅い/速い complaints, 倍速/半分の速さ/漢数字, 元の速度に戻して.
 * THREE / WebPanel / canvas stubs mirror tab-session.test.js.
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
  vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: () => {}, speaking: false };
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

describe('move-tab-start/end: go-to misroute fix', () => {
  test.each([
    '右端に移動', '一番右に移動', '最後に移動', '末尾に移動',
    'タブを右端に移動', 'このタブを右端へ', 'このタブを一番右へ',
    'move this tab to the end'
  ])('"%s" moves the tab to the end — no navigation', (phrase) => {
    const onGoTo = jest.fn();
    const { vc, spoken, tm } = makeVC({ onGoTo });
    tm.setActive(0);
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('move-tab-end');
    expect(onGoTo).not.toHaveBeenCalled();
    expect(tm.activeIndex).toBe(2);
    expect(spoken[0]).toBe('タブを最後に移動しました');
  });

  test.each([
    '左端に移動', '一番左に移動', '先頭に移動', '最初に移動',
    'タブを左端に移動', 'タブを先頭に', 'このタブを先頭に',
    'move this tab to the start'
  ])('"%s" moves the tab to the start — no navigation', (phrase) => {
    const onGoTo = jest.fn();
    const { vc, spoken, tm } = makeVC({ onGoTo });
    tm.setActive(2);
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('move-tab-start');
    expect(onGoTo).not.toHaveBeenCalled();
    expect(tm.activeIndex).toBe(0);
    expect(spoken[0]).toBe('タブを先頭に移動しました');
  });

  test('already at the edge reports honestly', () => {
    const { vc, spoken, tm } = makeVC();
    tm.setActive(0);
    vc.processCommand('一番左に移動');
    expect(spoken[0]).toBe('移動できませんでした');
  });
});

describe('moveTabToStart/End keep the pinned cluster', () => {
  test('unpinned tab moves to just after the pinned cluster', () => {
    const { tm } = makeVC();
    tm.tabs[0].pinned = true;
    tm.moveTabToStart(2);
    expect(tm.activeIndex !== 0).toBe(true);
    expect(tm.tabs[1].currentUrl).toBe('https://c.jp');
  });

  test('pinned tab ends at the last pinned slot, not strip end', () => {
    const { tm } = makeVC();
    tm.pinTab(0);
    tm.pinTab(1); // pinned cluster: [a(pinned), b(pinned), c]
    tm.moveTabToEnd(0); // pinned tab 0 → last pinned slot (index 1)
    expect(tm.tabs[0].currentUrl).toBe('https://b.jp');
    expect(tm.tabs[1].currentUrl).toBe('https://a.jp');
    expect(tm.tabs[2].currentUrl).toBe('https://c.jp');
  });
});

describe('bulk close sweepers', () => {
  test('close-duplicate-tabs keeps the first occurrence', () => {
    const { vc, spoken, tm } = makeVC();
    tm.tabs[1].currentUrl = 'https://a.jp'; // dup of tab0
    vc.processCommand('重複タブを閉じて');
    expect(vc.lastCommand.key).toBe('close-duplicate-tabs');
    expect(spoken[0]).toBe('1個の重複タブを閉じました');
    expect(tm.tabs.map(t => t.currentUrl)).toEqual(['https://a.jp', 'https://c.jp']);
  });

  test('close-duplicate-tabs honest when none', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('同じページを閉じて');
    expect(spoken[0]).toBe('重複するタブはありません');
  });

  test('close-unpinned-tabs keeps pinned tabs', () => {
    const { vc, spoken, tm } = makeVC();
    tm.pinTab(0);
    vc.processCommand('ピン留め以外を閉じて');
    expect(vc.lastCommand.key).toBe('close-unpinned-tabs');
    expect(spoken[0]).toBe('2個のタブを閉じました');
    expect(tm.tabs.length).toBe(1);
    expect(tm.tabs[0].pinned).toBe(true);
  });

  test('close-normal-tabs keeps private tabs', () => {
    const { vc, spoken, tm } = makeVC();
    tm.tabs[2].isPrivate = true;
    vc.processCommand('プライベート以外を閉じて');
    expect(vc.lastCommand.key).toBe('close-normal-tabs');
    expect(spoken[0]).toBe('2個の通常タブを閉じました');
    expect(tm.tabs.length).toBe(1);
    expect(tm.tabs[0].isPrivate).toBe(true);
  });
});

describe('find-again: replay the active query', () => {
  test('"もう一度検索" re-runs the last query', () => {
    const { vc, spoken, tm } = makeVC();
    vc._onFindQuery = () => tm.getActiveTab().findQueryValue;
    tm.getActiveTab().findCount = 2;
    vc.processCommand('バナナを探して');
    expect(vc.lastCommand.key).toBe('find-in-page');
    vc.processCommand('もう一度検索');
    expect(vc.lastCommand.key).toBe('find-again');
    expect(spoken[spoken.length - 1]).toBe('「バナナ」を再検索：2件見つかりました');
  });

  test('honest when no query is active', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('再検索');
    expect(vc.lastCommand.key).toBe('find-again');
    expect(spoken[0]).toBe('検索していません');
  });

  test('"find again" does not search for the word "again"', () => {
    const { vc, tm } = makeVC();
    vc._onFindQuery = () => tm.getActiveTab().findQueryValue;
    tm.getActiveTab().findQueryValue = 'banana';
    tm.getActiveTab().findCount = 1;
    vc.processCommand('find again');
    expect(vc.lastCommand.key).toBe('find-again');
    expect(tm.getActiveTab().findQueryValue).toBe('banana');
  });
});

describe('nav bare forms', () => {
  test.each(['戻って', '戻ってきて', '戻りたい', '一つ戻って', '前のページに戻って',
    'さっきのページ', 'さっきのページに戻って'])('"%s" goes back', (phrase) => {
    const { vc, tm } = makeVC();
    tm.getActiveTab().goBack = jest.fn(() => true);
    vc.processCommand(phrase);
    expect(vc.lastCommand.result.direction).toBe('back');
    expect(tm.getActiveTab().goBack).toHaveBeenCalled();
  });

  test.each(['進んで', '進みたい', '次のページに進んで', '一つ進んで'])(
    '"%s" goes forward', (phrase) => {
      const { vc, tm } = makeVC();
      tm.getActiveTab().goForward = jest.fn(() => true);
      vc.processCommand(phrase);
      expect(vc.lastCommand.result.direction).toBe('forward');
      expect(tm.getActiveTab().goForward).toHaveBeenCalled();
    }
  );
});

describe('refresh/scroll forms', () => {
  test.each(['ページを再読み込み', '読み込み直して', 'もう一度読み込んで',
    'リフレッシュして', '再読み込みして'])('"%s" reloads', (phrase) => {
    const { vc, tm } = makeVC();
    tm.getActiveTab().reload = jest.fn();
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('refresh');
    expect(tm.getActiveTab().reload).toHaveBeenCalled();
  });

  test.each(['スクロール', 'スクロールして', 'ページをめくって', 'めくって'])(
    '"%s" scrolls down', (phrase) => {
      const onScrollContent = jest.fn();
      const { vc } = makeVC({ onScrollContent });
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('scroll-down');
      expect(onScrollContent).toHaveBeenCalled();
    }
  );
});

describe('percent-jump midpoint forms', () => {
  test.each(['半分まで', '真ん中まで', '中間まで', '半分のところ'])(
    '"%s" jumps to 50%%', (phrase) => {
      const onReaderPercent = jest.fn(() => true);
      const { vc, spoken } = makeVC({ onReaderPercent });
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('percent-jump');
      expect(onReaderPercent).toHaveBeenCalledWith(50);
      expect(spoken[0]).toBe('50%に移動しました');
    }
  );
});

describe('video forms', () => {
  test.each(['ビデオを再生', 'ビデオを一時停止', 'ビデオをポーズ', 'ビデオを再開',
    '動画をポーズ'])('"%s" toggles video', (phrase) => {
    const onVideoToggle = jest.fn(() => 'paused');
    const { vc } = makeVC({ onVideoToggle });
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('video-toggle');
    expect(onVideoToggle).toHaveBeenCalled();
  });

  test('"動画をスキップ" seeks forward', () => {
    const onVideoSeek = jest.fn(() => 20);
    const { vc, spoken } = makeVC({ onVideoSeek });
    vc.processCommand('動画をスキップ');
    expect(vc.lastCommand.key).toBe('video-seek');
    expect(onVideoSeek).toHaveBeenCalledWith(10);
    expect(spoken[0]).toBe('10秒進みました');
  });
});

describe('pause-reading: once-stop forms', () => {
  test.each(['一旦停止', '一旦止めて', 'ちょっと止めて', '一旦中断'])(
    '"%s" pauses narration', (phrase) => {
      const { vc } = makeVC();
      vc.pauseSpeaking = jest.fn();
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('pause-reading');
      expect(vc.pauseSpeaking).toHaveBeenCalled();
    }
  );
});

describe('trouble: fatigue complaints', () => {
  test.each(['目が痛い', '頭が痛い', '疲れた', '休みたい', '吐き気がする'])(
    '"%s" gives recovery guidance', (phrase) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('trouble');
      expect(spoken[0]).toContain('リセンター');
    }
  );
});

describe('env complaints route to status twins', () => {
  test.each(['つながらない', '繋がらない', 'ネットが切れた', '圏外',
    'つながってる'])('"%s" → online-status', (phrase) => {
    const { vc, spoken } = makeVC();
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('online-status');
    expect(spoken[0]).toMatch(/オンライン|オフライン/);
  });

  test.each(['回線が悪い', '電波が悪い', '通信が遅い', '速度が遅い',
    'ネットが重い'])('"%s" → connection-status', (phrase) => {
    const { vc, spoken } = makeVC();
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('connection-status');
    expect(spoken[0]).toContain('通信');
  });

  test.each(['充電がない', '電池が切れそう', '電池がない', 'バッテリー切れ'])(
    '"%s" → battery-status', (phrase) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('battery-status');
      expect(spoken[0]).toContain('バッテリー');
    }
  );
});

describe('site/clipboard identity forms', () => {
  test.each(['HTTPSですか', '安全なサイトですか', 'セキュリティ状態',
    '危険なサイト', 'セキュアですか'])('"%s" → security-status', (phrase) => {
    const { vc, tm } = makeVC();
    tm.getActiveTab().currentUrl = 'https://a.jp';
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('security-status');
  });

  test.each(['ドメイン名', 'ホスト名', 'サイトのドメイン名', 'ドメインを教えて'])(
    '"%s" → hostname', (phrase) => {
      const { vc, spoken, tm } = makeVC();
      tm.getActiveTab().currentUrl = 'https://a.jp/x';
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('hostname');
      expect(spoken[0]).toContain('a.jp');
    }
  );

  test.each(['何をコピーした', 'コピーした内容', 'コピーしたもの',
    'コピー内容'])('"%s" → read-clipboard', async (phrase) => {
    const onReadClipboard = jest.fn(() => 'copied text');
    const { vc } = makeVC({ onReadClipboard });
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('read-clipboard');
    expect(onReadClipboard).toHaveBeenCalled();
  });

  test.each(['タブの名前', 'タブ名', 'サイトのタイトル', 'ページ名を教えて'])(
    '"%s" → title', (phrase) => {
      const { vc, spoken, tm } = makeVC();
      tm.getActiveTab().currentTitle = 'ニュース';
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('title');
      expect(spoken[0]).toBe('ニュース');
    }
  );
});

describe('collection totals + strip queries', () => {
  test.each(['全部で何行', 'この記事は何行', '総行数'])('"%s" → line-status', (p) => {
    const onLineStatus = jest.fn(() => ({ index: 3, total: 10 }));
    const { vc, spoken } = makeVC({ onLineStatus });
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('line-status');
    expect(spoken[0]).toBe('現在3行目（全10行）');
  });

  test.each(['全部で何文', 'この記事は何文', '総文数'])('"%s" → sentence-status', (p) => {
    const onSentenceStatus = jest.fn(() => ({ index: 2, total: 7 }));
    const { vc, spoken } = makeVC({ onSentenceStatus });
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('sentence-status');
    expect(spoken[0]).toBe('現在2文目（全7文）');
  });

  test.each(['全部で何段落', 'この記事は何段落', '総段落数'])('"%s" → paragraph-status', (p) => {
    const onParagraphStatus = jest.fn(() => ({ index: 1, total: 4 }));
    const { vc, spoken } = makeVC({ onParagraphStatus });
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('paragraph-status');
    expect(spoken[0]).toBe('全4段落の1段落目');
  });

  test.each(['タブは何枚', '何タブ', 'タブいくつ'])('"%s" → tab-status', (p) => {
    const onTabStatus = jest.fn(() => ({ index: 1, total: 3 }));
    const { vc, spoken } = makeVC({ onTabStatus });
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('tab-status');
    expect(spoken[0]).toBe('3個のタブの1枚目を表示中');
  });

  test.each(['開いてるウィンドウ', '開いているウィンドウ'])('"%s" → tabs-list', (p) => {
    const { vc, spoken } = makeVC();
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('tabs-list');
    expect(spoken[0]).toContain('3個のタブ');
  });

  test.each(['ウィンドウについて', 'このウィンドウについて', 'ウィンドウの情報'])(
    '"%s" → describe-tab', (p) => {
      const { vc, spoken, tm } = makeVC();
      tm.getActiveTab().currentTitle = 'ニュース';
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('describe-tab');
      expect(spoken[0]).toContain('ニュース');
    }
  );
});

describe('find-status/remaining-time forms', () => {
  test.each(['見つからなかった', '見つからない', 'ヒットしない',
    '何件見つかった', '見つかった数'])('"%s" → find-status', (p) => {
    const onFindStatus = jest.fn(() => ({ index: 1, total: 3 }));
    const { vc, spoken } = makeVC({ onFindStatus });
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('find-status');
    expect(spoken[0]).toBe('3件中1件目');
  });

  test.each(['読了まで', '読み終わるまで', 'あとどれくらいで終わる'])(
    '"%s" → remaining-time', (p) => {
      const onRemainingTime = jest.fn(() => 4);
      const { vc, spoken } = makeVC({ onRemainingTime });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('remaining-time');
      expect(spoken[0]).toBe('残り約4分です');
    }
  );
});

describe('tab strip verbs', () => {
  test.each(['もう一個タブ', 'タブを増やして', 'もう一枚', 'タブ追加',
    'もう一つタブ'])('"%s" opens a tab', (p) => {
    const { vc, tm } = makeVC();
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('new-tab');
    expect(tm.tabs.length).toBe(4);
  });

  test.each(['タブを消して', '閉じて', '閉じる', 'タブを消す', 'ページを消して'])(
    '"%s" closes the tab', (p) => {
      const { vc, tm } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('close-tab');
      expect(tm.tabs.length).toBe(2);
    }
  );

  test.each(['ピンを付けて', 'ピンを刺して', 'ピンを立てて', 'タブを固定して'])(
    '"%s" pins the tab', (p) => {
      const { vc, tm } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('pin-tab');
      expect(tm.getActiveTab().pinned).toBe(true);
    }
  );

  test.each(['ピンを取って', 'ピンを取り外して', '固定解除', 'ピンを解除して'])(
    '"%s" unpins the tab', (p) => {
      const { vc, tm } = makeVC();
      tm.pinTab(tm.activeIndex);
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('unpin-active');
      expect(tm.getActiveTab().pinned).toBe(false);
    }
  );

  test.each(['今いる場所', 'この場所は'])('"%s" → where-am-i', (p) => {
    const { vc, tm } = makeVC();
    tm.getActiveTab().currentTitle = 'ニュース';
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('where-am-i');
  });
});

describe('bookmark removal forms', () => {
  test.each(['お気に入りから削除', 'ブックマークから削除', 'お気に入りを消して',
    'ブックマークを消す', 'お気に入りから外して'])('"%s" → unbookmark-page', (p) => {
    const { vc, spoken, tm } = makeVC();
    const active = tm.getActiveTab();
    active.isBookmarked = () => true;
    active.onToggleBookmark = jest.fn();
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('unbookmark-page');
    expect(active.onToggleBookmark).toHaveBeenCalled();
    expect(spoken[0]).toBe('ブックマークを外しました');
  });
});

describe('speech rate forms', () => {
  test.each(['読み上げが遅い', '読み上げが遅すぎる', '速く読み上げて'])(
    '"%s" speeds up', (p) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('speech-faster');
      expect(spoken[0]).toContain('1.25');
    }
  );

  test.each(['読み上げが速い', '読み上げが速すぎる', '聞き取りやすくして',
    'はっきり読んで', 'ゆっくり読み上げて'])('"%s" slows down', (p) => {
    const { vc, spoken } = makeVC();
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('speech-slower');
    expect(spoken[0]).toContain('0.75');
  });

  test.each([['2倍速', 2], ['二倍速', 2], ['三倍速', 3], ['倍速で', 2],
    ['半分の速さ', 0.5], ['半分の速度', 0.5]])('"%s" sets rate %s', (p, rate) => {
    const { vc, spoken } = makeVC();
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('speech-rate-set');
    expect(vc.lastCommand.result.rate).toBe(rate);
    expect(spoken[0]).toContain(`${rate.toFixed(2)}倍`);
  });

  test.each(['元の速度に戻して', '通常の速度', '標準速度', '普通に読んで',
    'いつもの速度'])('"%s" resets speech', (p) => {
    const { vc, spoken } = makeVC();
    vc.setSpeechRate(2);
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('speech-reset');
    expect(spoken[0]).toBe('読み上げをリセットしました');
  });
});
