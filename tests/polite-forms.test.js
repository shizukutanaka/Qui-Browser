/**
 * Round 62 atoms — polite-speech normalization + alias pass XIX.
 *
 * - processCommand now retries on NO-MATCH with casual-form variants of the
 *   utterance (_politeVariants): て/で+request suffixes (ください/下さい/
 *   頂戴/ほしい/くれ/もらえますか/いただけますか), ます形→て形 (godan stem map
 *   + ichidan fallback), です/でしょう endings, and EN 'please' /
 *   'can|could|would you' wrappers. The raw transcript is always tried
 *   first, so first-match semantics are unchanged.
 * - Probe-verified misroutes fixed by direct registration:
 *   '新しいタブを開いて'/'タブを開いて' literal-navigated via go-to →
 *   new-tab; 'ニュースのタブを開いて' → tab-by-name (go-to gained a
 *   タブを開 lookahead); bare EN 'back'/'go back' and 'scroll down/up'
 *   were NO-MATCH; 'キャンセル'/'cancel' → stop-everything.
 * - Bare imperatives routed: '読んで'→read-aloud, '聞いて'→say-again,
 *   '待って'→pause-reading, '消して'→dismiss-notify, '見せて'/'一覧'→
 *   tabs-list, '閉めて' family → close-tab, '全部閉めて' → close-all-tabs,
 *   '保存して' → bookmark-page, 'ピン留めして' → pin, 'リロードして' →
 *   refresh, '教えて'/'help me' → help.
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
  tm.newTab('https://news.jp');
  tm.newTab('https://weather.jp');
  tm.newTab('https://memo.jp');
  tm.tabs[0].currentTitle = 'ニュース';
  tm.tabs[1].currentTitle = '天気';
  tm.tabs[2].currentTitle = 'メモ';
  vc.connectBrowser({ tabManager: tm, ...opts });
  return { vc, spoken, tm };
}

describe('polite retry: て-form + request suffixes', () => {
  test.each(['閉じてください', '閉じて下さい', '閉じて頂戴', '閉じてちょうだい',
    '閉じてほしい', '閉じてほしいです', '閉じてくれ', '閉じてくれますか',
    '閉じてもらえますか', '閉じていただけますか'])(
    '"%s" closes the tab like bare 閉じて', (p) => {
      const { vc, tm } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('close-tab');
      expect(tm.tabs.length).toBe(2);
    }
  );
  test.each(['戻ってください', '戻ってくれ', '戻ってもらえますか', '戻ってほしい'])(
    '"%s" routes to back', (p) => {
      const { vc } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('back');
    }
  );
  test.each([['進んでください', 'navigate'], ['検索してください', 'find-in-page'],
    ['読んでください', 'read-aloud'], ['教えてください', 'help'],
    ['見せてください', 'tabs-list'], ['止めてください', 'stop-everything'],
    ['終了してください', 'vr-exit'], ['消してください', 'dismiss-notify'],
    ['待ってください', 'pause-reading'], ['ミュートしてください', 'mute-toggle'],
    ['リロードしてください', 'refresh'], ['保存してください', 'bookmark-page'],
    ['コピーしてください', 'copy-url'], ['ピン留めしてください', 'pin-active'],
    ['読み上げてください', 'read-aloud'], ['メニューを開いてください', 'settings-toggle']])(
    '"%s" → %s', (p, key) => {
      const { vc } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe(key);
    }
  );
});

describe('polite retry: ます形 → て形', () => {
  test.each([['閉じます', 'close-tab'], ['閉めます', 'close-tab'],
    ['戻ります', 'back'], ['進みます', 'navigate'],
    ['読み上げます', 'read-aloud'], ['読みます', 'read-aloud'],
    ['消します', 'dismiss-notify'], ['教えます', 'help'],
    ['見せます', 'tabs-list'], ['止めます', 'stop-everything'],
    ['待ちます', 'pause-reading'], ['進みなさい', 'navigate'],
    ['止めなさい', 'stop-everything'], ['読み上げましょう', 'read-aloud'],
    ['戻りませんか', 'back'], ['閉じませんか', 'close-tab']])(
    '"%s" → %s', (p, key) => {
      const { vc } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe(key);
    }
  );
  test('past tense is not executed: 閉じました stays unmatched', () => {
    const { vc, tm } = makeVC();
    vc.processCommand('閉じました');
    expect(tm.tabs.length).toBe(3);
    expect(vc.lastCommand?.key).not.toBe('close-tab');
  });
});

describe('polite retry: です/でしょう endings', () => {
  test.each([['今何時ですか', 'time'], ['ここはどこですか', 'where-am-i']])(
    '"%s" → %s', (p, key) => {
      const { vc } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe(key);
    }
  );
});

describe('polite retry: EN wrappers', () => {
  test.each([['please go back', 'back'], ['can you go back', 'back'],
    ['could you go back', 'back'], ['would you go back', 'back'],
    ['please scroll down', 'scroll-down'], ['could you please scroll down', 'scroll-down'],
    ['close the tab please', 'close-tab'], ['please help', 'help'],
    ['help me', 'help'], ['help me please', 'help'],
    ['will you go forward', 'navigate'], ['please open a new tab', 'new-tab']])(
    '"%s" → %s', (p, key) => {
      const { vc } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe(key);
    }
  );
});

describe('alias pass XIX: direct registrations', () => {
  test.each([['back', 'back'], ['go back', 'back'], ['go backwards', 'back'],
    ['scroll down', 'scroll-down'], ['scroll up', 'scroll-up']])(
    '"%s" → %s', (p, key) => {
      const { vc } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe(key);
    }
  );
  test.each(['キャンセル', 'キャンセルして', '中止して', '止めて', '停止して',
    'cancel', 'cancel that'])('"%s" → stop-everything', (p) => {
    const { vc } = makeVC();
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('stop-everything');
  });
  test.each([['読んで', 'read-aloud'], ['聞いて', 'say-again'],
    ['聞かせて', 'say-again'], ['待って', 'pause-reading'],
    ['消して', 'dismiss-notify'], ['消えて', 'dismiss-notify'],
    ['見せて', 'tabs-list'], ['一覧', 'tabs-list'],
    ['一覧を見せて', 'tabs-list'], ['一覧を出して', 'tabs-list'],
    ['閉めて', 'close-tab'], ['タブを閉めて', 'close-tab'],
    ['ページを閉めて', 'close-tab'], ['リロードして', 'refresh'],
    ['保存して', 'bookmark-page'], ['ピン留めして', 'pin-active'],
    ['教えて', 'help']])('"%s" → %s', (p, key) => {
    const { vc } = makeVC();
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe(key);
  });
  test.each(['新しいタブを開いて', '新しいタブを開けて', 'タブを開いて',
    'タブを開けて', 'タブを作って', '新しいページを開いて',
    'open a new tab', 'open new tab', 'add a tab', 'create a tab'])(
    '"%s" opens a new tab — never navigates', (p) => {
      const onGoTo = jest.fn();
      const { vc, tm } = makeVC({ onGoTo });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('new-tab');
      expect(tm.tabs.length).toBe(4);
      expect(onGoTo).not.toHaveBeenCalled();
    }
  );
  test('全部閉めて closes all unpinned tabs', () => {
    const { vc, tm } = makeVC();
    vc.processCommand('全部閉めて');
    expect(vc.lastCommand.key).toBe('close-all-tabs');
    expect(tm.tabs.length).toBe(0);
  });
  test('"ニュースのタブを開いて" selects by name — never navigates', () => {
    const onGoTo = jest.fn();
    const { vc, tm } = makeVC({ onGoTo });
    tm.setActive(2);
    vc.processCommand('ニュースのタブを開いて');
    expect(vc.lastCommand.key).toBe('tab-by-name');
    expect(tm.activeIndex).toBe(0);
    expect(onGoTo).not.toHaveBeenCalled();
  });
});

describe('coexistence: raw match always wins', () => {
  test.each([['ニュースを開いて', 'ニュース'], ['youtubeを開いて', 'youtube']])(
    '"%s" still navigates via go-to', (p, q) => {
      const onGoTo = jest.fn();
      const { vc } = makeVC({ onGoTo });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('go-to');
      expect(onGoTo).toHaveBeenCalledWith(q);
    }
  );
  test('閉じたタブを開いて still routes to reopen — not new-tab/tab-by-name', () => {
    const { vc, tm } = makeVC();
    tm.closeTab(2);
    vc.processCommand('閉じたタブを開いて');
    expect(vc.lastCommand.key).not.toBe('new-tab');
    expect(vc.lastCommand.key).not.toBe('tab-by-name');
  });
  test('戻れますか is a status question — never executes goBack', () => {
    const { vc, tm } = makeVC();
    const spy = jest.fn();
    tm.tabs.forEach(t => { t.goBack = spy; });
    vc.processCommand('戻れますか');
    expect(vc.lastCommand.key).toBe('back-status');
    expect(spy).not.toHaveBeenCalled();
  });
  test('lastCommand keeps the raw transcript for audit/repeat', () => {
    const { vc } = makeVC();
    vc.processCommand('閉じてください');
    expect(vc.lastCommand.key).toBe('close-tab');
    expect(vc.lastCommand.transcript).toBe('閉じてください');
  });
});
