/**
 * Round 57 atoms — multi-step history nav + history-depth status +
 * alias pass XIV.
 *
 * - nav-steps: 'Nページ戻って'/'Nページ進んで' (digits, kanji, EN) and the
 *   'history start' forms loop the panel's own goBack/goForward — Chrome's
 *   repeated Alt+←/→ parity. Registered before `back` because its
 *   /戻[るれ]/ regex owns '…に戻る' endings ('最初まで戻る' previously ran a
 *   single back step — probe-verified). Shortfall announces honestly.
 * - history-depth: 'あと何ページ戻れる'/'あと何ページ進める' — a question
 *   that previously EXECUTED navigation (probe-verified: back/navigate
 *   matched the loose 戻れ/進め regexes). Registers before both.
 * - alias pass: 検索を閉じて/消して/終了, タブを全部閉じる, パネルを閉じて,
 *   終了/アプリを閉じて/ブラウザを閉じて, 字幕を大きくして/小さくして,
 *   閲覧履歴/ブラウザ履歴/検索履歴, 最後の検索/前に検索した言葉,
 *   休憩したい/気持ち悪い/めまいがする, もっと戻って/さっき見たページ.
 * THREE / WebPanel / canvas stubs mirror edge-find-atoms.test.js; the
 * WebPanel stub gains a real per-tab history stack for nav-steps.
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

// ── WebPanel stub (with per-tab history) ──────────────────────────────────────
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
      // Real per-tab history stack (WebPanel.history/historyIdx parity);
      // tests re-seed it explicitly before each scenario.
      this.history = ['https://seed.jp'];
      this.historyIdx = 0;
    }
    addToScene(parent) { this.parent = parent; }
    navigate(url) {
      this.history = this.history.slice(0, this.historyIdx + 1);
      this.history.push(url);
      this.historyIdx = this.history.length - 1;
      this.currentUrl = url;
    }
    goBack() {
      if (this.historyIdx > 0) {
        this.historyIdx--;
        this.currentUrl = this.history[this.historyIdx];
        return true;
      }
      return false;
    }
    goForward() {
      if (this.historyIdx < this.history.length - 1) {
        this.historyIdx++;
        this.currentUrl = this.history[this.historyIdx];
        return true;
      }
      return false;
    }
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

// Give the active tab a six-entry history stack at a known position.
function seedHistory(tm, idx = 4) {
  const p = tm.getActiveTab();
  p.history = ['https://h1.jp', 'https://h2.jp', 'https://h3.jp',
    'https://h4.jp', 'https://h5.jp', 'https://h6.jp'];
  p.historyIdx = idx;
}

describe('nav-steps: multi-step history nav', () => {
  test.each([
    ['2ページ戻って', 2], ['二ページ戻って', 2], ['3ページ戻る', 3],
    ['3つ戻って', 3], ['二つ戻る', 2], ['back 2 pages', 2],
    ['go back two pages', 2], ['back three pages', 3]
  ])('"%s" steps back %i', (phrase, n) => {
    const { vc, spoken, tm } = makeVC();
    seedHistory(tm);
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('nav-steps');
    expect(vc.lastCommand.result.direction).toBe('back');
    expect(vc.lastCommand.result.moved).toBe(Math.min(n, 4)); // idx 4 → max 4
    expect(tm.getActiveTab().historyIdx).toBe(4 - Math.min(n, 4));
  });

  test('partial move announces the shortfall honestly', () => {
    const { vc, spoken, tm } = makeVC();
    seedHistory(tm);
    vc.processCommand('5ページ戻って');
    expect(vc.lastCommand.result.moved).toBe(4);
    expect(spoken[0]).toBe('4ページ戻りました（これ以上戻れません）');
  });

  test('no history answers honestly', () => {
    const { vc, spoken, tm } = makeVC();
    tm.getActiveTab().history = ['https://only.jp'];
    tm.getActiveTab().historyIdx = 0;
    vc.processCommand('2ページ戻って');
    expect(spoken[0]).toBe('戻れる履歴がありません');
  });

  test.each(['2ページ進んで', '二ページ進んで', 'forward 2 pages',
    'go forward three pages'])('"%s" steps forward', (phrase) => {
    const { vc, tm } = makeVC();
    seedHistory(tm, 0);
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('nav-steps');
    expect(vc.lastCommand.result.direction).toBe('forward');
    expect(tm.getActiveTab().historyIdx).toBeGreaterThan(0);
  });

  test.each(['一番最初に戻って', '一番最初に戻る', '最初のページに戻って',
    '最初のページに戻る', '履歴の最初に戻って', '履歴の最初まで戻る',
    '最初まで戻って', '最初まで戻る', 'back to the start'])(
    '"%s" lands on the first history entry', (phrase) => {
      const { vc, tm } = makeVC();
      seedHistory(tm);
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('nav-steps');
      expect(tm.getActiveTab().historyIdx).toBe(0);
    }
  );

  test('coexistence: single-step back phrases stay with `back`', () => {
    const { vc, tm } = makeVC();
    seedHistory(tm);
    vc.processCommand('一つ戻って');
    expect(vc.lastCommand.key).toBe('back');
    expect(tm.getActiveTab().historyIdx).toBe(3);
    seedHistory(tm);
    vc.processCommand('最初のタブに戻る'); // a tab phrase, not a history one
    expect(vc.lastCommand.key).toBe('back');
    expect(tm.getActiveTab().historyIdx).toBe(3);
  });
});

describe('history-depth: question forms must not navigate', () => {
  test.each(['あと何ページ戻れる', '何ページ戻れる', 'どこまで戻れる',
    'どのくらい戻れる', 'どれだけ戻れる', '履歴はあといくつ',
    'how far back'])('"%s" announces depth without navigating', (p) => {
    const { vc, spoken, tm } = makeVC();
    seedHistory(tm);
    const spy = jest.spyOn(tm.getActiveTab(), 'goBack');
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('history-depth');
    expect(spy).not.toHaveBeenCalled();
    expect(tm.getActiveTab().historyIdx).toBe(4);
    expect(spoken[0]).toBe('あと4ページ戻れます');
  });

  test.each(['あと何ページ進める', 'どこまで進める', 'どのくらい進める'])(
    '"%s" announces forward depth without navigating', (p) => {
      const { vc, spoken, tm } = makeVC();
      seedHistory(tm, 3);
      const spy = jest.spyOn(tm.getActiveTab(), 'goForward');
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('history-depth');
      expect(vc.lastCommand.result.direction).toBe('forward');
      expect(spy).not.toHaveBeenCalled();
      expect(spoken[0]).toBe('あと2ページ進めます');
    }
  );

  test('empty depth answers honestly', () => {
    const { vc, spoken, tm } = makeVC();
    seedHistory(tm, 0);
    vc.processCommand('あと何ページ戻れる');
    expect(spoken[0]).toBe('戻れる履歴はありません');
  });
});

describe('nav alias pass', () => {
  test.each(['もっと戻って', 'もっと前に戻って', 'さっき見たページ',
    'さっき見てたページ', 'もう一個戻って'])('"%s" goes back', (p) => {
    const { vc, tm } = makeVC();
    seedHistory(tm);
    const spy = jest.spyOn(tm.getActiveTab(), 'goBack');
    vc.processCommand(p);
    expect(vc.lastCommand.result.direction).toBe('back');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('clear-find / close aliases', () => {
  test.each(['検索を閉じて', '検索バーを閉じて', '検索窓を閉じて',
    '検索を消して', '検索を終了', 'ハイライトを解除'])('"%s" → clear-find', (p) => {
    const { vc, spoken } = makeVC();
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('clear-find');
    expect(spoken[0]).toBe('検索をしていません');
  });

  test.each(['タブを全部閉じる', '全部のタブを閉じる', '全部タブを閉じて',
    'タブを全て閉じて', '全部のタブを消して'])('"%s" → close-all-tabs', (p) => {
    const { vc, tm } = makeVC();
    tm.newTab('https://b.jp');
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('close-all-tabs');
    expect(tm.tabs.length).toBe(0);
  });

  test.each(['パネルを閉じて', 'パネルを消して', 'ウィンドウを閉じる'])(
    '"%s" → close-tab', (p) => {
      const { vc, tm } = makeVC();
      tm.newTab('https://b.jp');
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('close-tab');
      expect(tm.tabs.length).toBe(1);
    }
  );
});

describe('vr-exit / caption-size aliases', () => {
  test.each(['終了', 'アプリを閉じて', 'ブラウザを閉じて', 'ブラウザを終了して',
    'アプリを終了して', 'ブラウザを閉じる'])('"%s" → vr-exit', (p) => {
    const { vc } = makeVC();
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('vr-exit');
  });

  test.each(['字幕を大きくして', '字幕のサイズを大きくして',
    'キャプションサイズを大きくして'])('"%s" → caption-size-up', (p) => {
    const onCaptionScale = jest.fn(() => 1.5);
    const { vc } = makeVC({ onCaptionScale });
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('caption-size-up');
    expect(onCaptionScale).toHaveBeenCalledWith(0.25);
  });

  test.each(['字幕を小さくして', '字幕のサイズを小さくして',
    'キャプションサイズを小さくして'])('"%s" → caption-size-down', (p) => {
    const onCaptionScale = jest.fn(() => 0.75);
    const { vc } = makeVC({ onCaptionScale });
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('caption-size-down');
    expect(onCaptionScale).toHaveBeenCalledWith(-0.25);
  });
});

describe('history-list / find-query aliases', () => {
  test.each(['閲覧履歴', 'ブラウザ履歴', 'ウェブ履歴', '検索履歴',
    '閲覧履歴を読んで'])('"%s" → history-list', (p) => {
    const onHistoryList = jest.fn(() => [{ title: 'a', url: 'u' }]);
    const { vc } = makeVC({ onHistoryList });
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('history-list');
    expect(onHistoryList).toHaveBeenCalled();
  });

  test.each(['最後の検索', '前の検索', '前に検索した言葉', '検索した言葉',
    '最後に検索した言葉'])('"%s" → find-query', (p) => {
    const onFindQuery = jest.fn(() => 'バナナ');
    const { vc, spoken } = makeVC({ onFindQuery });
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('find-query');
    expect(spoken[0]).toBe('「バナナ」を検索中です');
  });
});

describe('trouble: rest/dizziness complaints', () => {
  test.each(['休憩したい', '一休みしたい', '気持ち悪い', 'クラクラする',
    '頭がクラクラする', 'めまいがする', '目眩がする', '気分が悪くなった'])(
    '"%s" → trouble guidance', (p) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('trouble');
      expect(spoken[0]).toContain('リセンター');
    }
  );
});
