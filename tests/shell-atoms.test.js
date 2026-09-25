/**
 * Round-12 shell-control atoms:
 *   - TabManager.newPrivateTab — Chrome Ctrl+Shift+N: one private tab without
 *     flipping the manager-wide private-mode toggle
 *   - TabManager.restoreSession returns the restored count (voice announce)
 *   - WebPanel.getReadingTimeMinutes — Edge/Safari reading-time parity
 *   - VoiceCommands: private-new-tab, high-contrast (OS-toggle parity),
 *     reading-time, search-engine (cycle-by-name), restore-session
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
    this.position = { set: jest.fn() };
  }
}
jest.mock('three', () => ({
  Group: MockGroup,
  Mesh: MockMesh,
  PlaneGeometry: class { dispose() {} },
  MeshBasicMaterial: class { dispose() {} },
  CanvasTexture: class { constructor() { this.needsUpdate = false; } dispose() {} }
}));

// ── WebPanel stub for TabManager tests ────────────────────────────────────────
const panelInstances = [];
jest.mock('../src/vr/browser/WebPanel.js', () => ({
  WebPanel: class {
    constructor(opts) {
      this.opts = opts;
      this.currentUrl = '';
      this.isPrivate = !!opts.privateMode;
      this.pinned = false;
      this.group = { position: { set: jest.fn() } };
      this.visible = false;
      this.disposed = false;
      panelInstances.push(this);
    }
    addToScene(parent) { this.parent = parent; }
    navigate(url) { this.currentUrl = url; }
    setVisible(v) { this.visible = !!v; }
    setCurved() {}
    dispose() { this.disposed = true; }
  }
}));
const { WebPanel: RealWebPanel } = jest.requireActual('../src/vr/browser/WebPanel.js');

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
global.URL = URL;
global.SpeechSynthesisUtterance = function (text) { this.text = text; };

const { TabManager } = require('../src/vr/browser/TabManager.js');
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');
const { layoutReaderLines } = require('../src/vr/browser/readerLayout.js');

function makeManager(opts = {}) {
  return new TabManager({
    scene: { add: jest.fn(), remove: jest.fn() },
    registerInteractable: jest.fn(),
    unregisterInteractable: jest.fn(),
    ...opts
  });
}

function makeSpeakingVC(extra = {}) {
  const vc = new VoiceCommands();
  vc.callbacks.onSpeak = () => {};
  vc.connectBrowser(extra);
  const spoken = [];
  vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: jest.fn() };
  vc._spoken = spoken;
  return vc;
}

/** Real WebPanel prototype in the reader state with real layout lines. */
function makeReaderPanel(text) {
  const p = Object.create(RealWebPanel.prototype);
  p._contentState = 'reader';
  p._readerTitle = '';
  p._readerBlocks = [{ type: 'p', text }];
  p._readerLines = layoutReaderLines(p._readerBlocks, { title: '', scale: 1 });
  p._readerScale = 1;
  p._readerScroll = 0;
  p._findMatches = [];
  p._findIndex = -1;
  p._drawContent = jest.fn();
  return p;
}

// ── TabManager.newPrivateTab ──────────────────────────────────────────────────
describe('TabManager.newPrivateTab', () => {
  test('creates a private tab without flipping the manager private flag', () => {
    const tm = makeManager();
    const p = tm.newPrivateTab();
    expect(p.isPrivate).toBe(true);
    expect(tm._privateMode).toBe(false);
  });

  test('the next ordinary newTab after it is non-private', () => {
    const tm = makeManager();
    tm.newPrivateTab();
    const p2 = tm.newTab();
    expect(p2.isPrivate).toBe(false);
  });

  test('honors the private-mode toggle when it is already on', () => {
    const tm = makeManager();
    tm.setPrivateMode(true);
    expect(tm.newPrivateTab().isPrivate).toBe(true);
    expect(tm._privateMode).toBe(true);
  });

  test('returns null at MAX_TABS instead of a broken panel', () => {
    const tm = makeManager();
    for (let i = 0; i < 8; i++) tm.newTab();
    expect(tm.newPrivateTab()).toBeNull();
  });
});

// ── TabManager.restoreSession count ───────────────────────────────────────────
describe('TabManager.restoreSession', () => {
  test('returns 0 for a missing or empty snapshot', () => {
    const tm = makeManager();
    expect(tm.restoreSession(null)).toBe(0);
    expect(tm.restoreSession({ tabs: [] })).toBe(0);
    expect(tm.restoreSession({})).toBe(0);
  });

  test('returns the restored count and still activates the saved index', () => {
    const tm = makeManager();
    const n = tm.restoreSession({ tabs: ['https://a.test/', 'https://b.test/'], active: 1 });
    expect(n).toBe(2);
    expect(tm.count).toBe(2);
    expect(tm.activeIndex).toBe(1);
  });

  test('counts only successful opens when MAX_TABS cuts the snapshot short', () => {
    const tm = makeManager();
    const tabs = Array.from({ length: 10 }, (_, i) => `https://s${i}.test/`);
    const n = tm.restoreSession({ tabs, active: 0 });
    expect(n).toBe(8);
    expect(tm.count).toBe(8);
  });
});

// ── WebPanel.getReadingTimeMinutes ────────────────────────────────────────────
describe('WebPanel.getReadingTimeMinutes', () => {
  test('estimates minutes from laid-out text (~500 chars/min)', () => {
    const p = makeReaderPanel('あ'.repeat(1000));
    expect(p.getReadingTimeMinutes()).toBe(2);
  });

  test('floors at 1 minute for a short article', () => {
    const p = makeReaderPanel('短い。');
    expect(p.getReadingTimeMinutes()).toBe(1);
  });

  test('returns null outside the reader state', () => {
    const p = makeReaderPanel('x');
    p._contentState = 'loaded';
    expect(p.getReadingTimeMinutes()).toBeNull();
  });
});

// ── VoiceCommands private-new-tab ─────────────────────────────────────────────
describe('VoiceCommands private-new-tab', () => {
  test('\'プライベートタブ\' creates a private tab and announces it', () => {
    const tm = makeManager();
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('プライベートタブ');
    expect(tm.count).toBe(1);
    expect(tm.getActiveTab().isPrivate).toBe(true);
    expect(vc._spoken.pop()).toBe('プライベートタブを開きました');
  });

  test('announces the cap honestly at MAX_TABS', () => {
    const tm = makeManager();
    for (let i = 0; i < 8; i++) tm.newTab();
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('シークレットタブ');
    expect(vc._spoken.pop()).toBe('タブをこれ以上開けません');
  });

  test('English "new incognito tab" routes the same way', () => {
    const tm = makeManager();
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('new incognito tab');
    expect(tm.count).toBe(1);
    expect(tm.getActiveTab().isPrivate).toBe(true);
  });
});

// ── VoiceCommands high-contrast ───────────────────────────────────────────────
describe('VoiceCommands high-contrast', () => {
  test('bare \'ハイコントラスト\' toggles via the hook', () => {
    const onHighContrast = jest.fn(() => true);
    const vc = makeSpeakingVC({ onHighContrast });
    vc.processCommand('ハイコントラスト');
    expect(onHighContrast).toHaveBeenCalledWith(undefined);
    expect(vc._spoken.pop()).toBe('ハイコントラスト オンです');
  });

  test('\'ハイコントラストをオフ\' sets false explicitly', () => {
    const onHighContrast = jest.fn(() => false);
    const vc = makeSpeakingVC({ onHighContrast });
    vc.processCommand('ハイコントラストをオフ');
    expect(onHighContrast).toHaveBeenCalledWith(false);
    expect(vc._spoken.pop()).toBe('ハイコントラスト オフです');
  });

  test('\'enable high contrast\' sets true explicitly', () => {
    const onHighContrast = jest.fn(() => true);
    const vc = makeSpeakingVC({ onHighContrast });
    vc.processCommand('enable high contrast');
    expect(onHighContrast).toHaveBeenCalledWith(true);
  });

  test('without a host hook the command still answers honestly', () => {
    const vc = makeSpeakingVC();
    vc.processCommand('ハイコントラスト');
    expect(vc._spoken.pop()).toBe('ハイコントラストを切り替えられません');
  });
});

// ── VoiceCommands reading-time ────────────────────────────────────────────────
describe('VoiceCommands reading-time', () => {
  test('\'読了時間\' announces the estimate for the open article', () => {
    const tm = makeManager();
    tm.newTab();
    const active = tm.getActiveTab();
    active.getReadingTimeMinutes = () => 3;
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('読了時間');
    expect(vc._spoken.pop()).toBe('この記事は約3分です');
  });

  test('with no article open it says so honestly', () => {
    const tm = makeManager();
    tm.newTab();
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('この記事の長さ');
    expect(vc._spoken.pop()).toBe('記事が開かれていません');
  });
});

// ── VoiceCommands search-engine ───────────────────────────────────────────────
describe('VoiceCommands search-engine', () => {
  test('\'検索エンジンをGoogleにして\' applies the canonical name', () => {
    const onSearchEngine = jest.fn((n) => n);
    const vc = makeSpeakingVC({ onSearchEngine });
    vc.processCommand('検索エンジンをGoogleにして');
    expect(onSearchEngine).toHaveBeenCalledWith('google');
    expect(vc._spoken.pop()).toBe('検索エンジンをgoogleにしました');
  });

  test('JA kana alias \'検索エンジンをダックダックゴーに\' maps to duckduckgo', () => {
    const onSearchEngine = jest.fn((n) => n);
    const vc = makeSpeakingVC({ onSearchEngine });
    vc.processCommand('検索エンジンをダックダックゴーに');
    expect(onSearchEngine).toHaveBeenCalledWith('duckduckgo');
  });

  test('English "use bing" routes to bing', () => {
    const onSearchEngine = jest.fn((n) => n);
    const vc = makeSpeakingVC({ onSearchEngine });
    vc.processCommand('use bing');
    expect(onSearchEngine).toHaveBeenCalledWith('bing');
  });

  test('an unknown engine is refused honestly', () => {
    const onSearchEngine = jest.fn((n) => n);
    const vc = makeSpeakingVC({ onSearchEngine });
    vc.processCommand('検索エンジンをyahooにして');
    expect(onSearchEngine).not.toHaveBeenCalled();
    expect(vc._spoken.pop()).toBe('その検索エンジンは使えません');
  });
});

// ── VoiceCommands restore-session ─────────────────────────────────────────────
describe('VoiceCommands restore-session', () => {
  test('\'セッションを復元\' announces the restored count', () => {
    const onRestoreSession = jest.fn(() => 3);
    const vc = makeSpeakingVC({ onRestoreSession });
    vc.processCommand('セッションを復元');
    expect(vc._spoken.pop()).toBe('3個のタブを復元しました');
  });

  test('with nothing saved it says so honestly', () => {
    const vc = makeSpeakingVC({ onRestoreSession: () => 0 });
    vc.processCommand('前のセッションを復元');
    expect(vc._spoken.pop()).toBe('復元するセッションがありません');
  });

  test('without a host hook it degrades to the honest answer', () => {
    const vc = makeSpeakingVC();
    vc.processCommand('セッションを復元');
    expect(vc._spoken.pop()).toBe('復元するセッションがありません');
  });
});
