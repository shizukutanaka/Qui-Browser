/**
 * Round-10 tab-strip atoms III — the Chrome parity gaps that remained:
 *   - pinTab/unpinTab/togglePin (Chrome "Pin tab": pinned tabs cluster at
 *     the strip's left edge, have no close button, and refuse every close
 *     path until unpinned)
 *   - moveTab(±1) (Chrome Ctrl+Shift+PageUp/PageDown; pinned and unpinned
 *     regions are kept separate, so a boundary-crossing move is refused)
 *   - honest close-tab voice announce (pinned → "cannot close" instead of
 *     a lying confirmation) and 'ブックマークを開いて' (symmetric with the
 *     history open command — open≠toggle)
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
const panelInstances = [];
jest.mock('../src/vr/browser/WebPanel.js', () => ({
  WebPanel: class {
    constructor(opts) {
      this.opts = opts;
      this.currentUrl = '';
      this.currentTitle = '';
      this.isPrivate = !!opts.privateMode;
      this.group = { position: { set: jest.fn() } };
      this.visible = false;
      this.disposed = false;
      panelInstances.push(this);
    }
    addToScene(parent) { this.parent = parent; }
    navigate(url) { this.currentUrl = url; }
    setVisible(v) { this.visible = !!v; }
    setCurved() {}
    stop() { this.stopped = true; }
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
global.URL = URL;
global.SpeechSynthesisUtterance = function (text) { this.text = text; };

const { TabManager } = require('../src/vr/browser/TabManager.js');
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeManager(opts = {}) {
  return new TabManager({
    scene: { add: jest.fn(), remove: jest.fn() },
    registerInteractable: jest.fn(),
    unregisterInteractable: jest.fn(),
    ...opts
  });
}

function makeVoice(extra = {}) {
  const vc = new VoiceCommands();
  vc.callbacks.onSpeak = () => {};
  vc.connectBrowser(extra);
  const spoken = [];
  vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: jest.fn() };
  vc._spoken = spoken;
  return vc;
}

// ── pinTab / unpinTab / togglePin ─────────────────────────────────────────────
describe('pinned tabs (Chrome "Pin tab")', () => {
  test('pinning slides the tab to the front of the strip', () => {
    const tm = makeManager();
    const a = tm.newTab('https://a.example');
    tm.newTab('https://b.example');
    const c = tm.newTab('https://c.example');
    expect(tm.pinTab(2)).toBe(true);
    expect(tm.tabs[0]).toBe(c);
    expect(tm.tabs[1]).toBe(a);
    expect(c.pinned).toBe(true);
  });

  test('the active index follows the pinned tab to the front', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    const b = tm.newTab('https://b.example');
    const c = tm.newTab('https://c.example'); // active by construction
    tm.pinTab(2);
    expect(tm.activeIndex).toBe(0);
    expect(tm.getActiveTab()).toBe(c);
  });

  test('a second pin joins the end of the pinned cluster, not the front', () => {
    const tm = makeManager();
    const a = tm.newTab('https://a.example');
    tm.newTab('https://b.example');
    const c = tm.newTab('https://c.example');
    tm.pinTab(2);              // [c, a, b]
    expect(tm.pinTab(1)).toBe(true); // pin a → [c, a, b] (a already at cluster end)
    expect(tm.tabs[0]).toBe(c);
    expect(tm.tabs[1]).toBe(a);
    expect(a.pinned).toBe(true);
  });

  test('pinTab on an already-pinned tab and unpinTab on an unpinned one are no-ops', () => {
    const tm = makeManager();
    const a = tm.newTab('https://a.example');
    tm.pinTab(0);
    expect(tm.pinTab(0)).toBe(false);
    expect(a.pinned).toBe(true);
    expect(tm.unpinTab(0)).toBe(true);
    expect(tm.unpinTab(0)).toBe(false);
  });

  test('togglePin returns the new state (or null for an invalid index)', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    expect(tm.togglePin(0)).toBe('pinned');
    expect(tm.togglePin(0)).toBe('unpinned');
    expect(tm.togglePin(9)).toBe(null);
  });

  // ── close refusal ─────────────────────────────────────────────────────────
  test('closeTab refuses a pinned tab — it is not disposed or removed', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    const c = tm.newTab('https://c.example');
    tm.pinTab(1);
    expect(tm.closeTab(0)).toBe(false);
    expect(c.pinned).toBe(true);
    expect(c.disposed).toBe(false);
    expect(tm.tabs.length).toBe(2);
  });

  test('closeOtherTabs closes every unpinned tab but pinned ones survive', () => {
    const tm = makeManager();
    const a = tm.newTab('https://a.example');
    tm.newTab('https://b.example');
    const c = tm.newTab('https://c.example');
    tm.pinTab(0);                     // a pinned at front
    tm.setActive(2);                  // c active (unpinned)
    const closed = tm.closeOtherTabs();
    expect(closed).toBe(1);           // only b went away
    expect(tm.tabs).toEqual([a, c]);
    expect(a.pinned).toBe(true);
  });

  test('closeTabsToRight skips pinned tabs to the right', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    const b = tm.newTab('https://b.example');
    const c = tm.newTab('https://c.example');
    tm.pinTab(2);                     // [c, a, b]
    tm.setActive(1);                  // a active
    expect(tm.closeTabsToRight()).toBe(1); // only b
    expect(tm.tabs).toEqual([c, tm.tabs[1]]);
    expect(b.disposed).toBe(true);
  });
});

// ── moveTab ───────────────────────────────────────────────────────────────────
describe('moveTab (Ctrl+Shift+PageUp/PageDown)', () => {
  test('moves a tab and tracks the active index', () => {
    const tm = makeManager();
    const a = tm.newTab('https://a.example');
    tm.newTab('https://b.example');
    tm.setActive(0);
    expect(tm.moveTab(0, 1)).toBe(true);
    expect(tm.tabs[1]).toBe(a);
    expect(tm.activeIndex).toBe(1);
  });

  test('a neighbouring swap also fixes the active index', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    const b = tm.newTab('https://b.example');
    tm.setActive(1);
    tm.moveTab(0, 1); // a moves right, b moves left
    expect(tm.activeIndex).toBe(0);
  });

  test('refuses to move past the strip ends', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    tm.newTab('https://b.example');
    expect(tm.moveTab(0, -1)).toBe(false);
    expect(tm.moveTab(1, 1)).toBe(false);
  });

  test('refuses to cross the pinned/unpinned boundary, Chrome-style', () => {
    const tm = makeManager();
    const a = tm.newTab('https://a.example');
    tm.newTab('https://b.example');
    tm.pinTab(0);
    expect(tm.moveTab(0, 1)).toBe(false);   // pinned into unpinned zone
    expect(tm.moveTab(1, -1)).toBe(false);  // unpinned into pinned zone
    expect(a.pinned).toBe(true);
  });
});

// ── voice commands ────────────────────────────────────────────────────────────
describe('pin/move voice commands', () => {
  test('"タブをピン留め" pins and announces; repeating unpins', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    const vc = makeVoice({ tabManager: tm });
    vc.processCommand('タブをピン留め');
    expect(vc._spoken).toContain('タブをピン留めしました');
    vc.processCommand('ピン留め解除');
    expect(vc._spoken).toContain('ピン留めを解除しました');
  });

  test('"タブを左に移動" moves and announces the result honestly', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    tm.newTab('https://b.example'); // active
    const vc = makeVoice({ tabManager: tm });
    vc.processCommand('タブを左に移動');
    expect(vc._spoken).toContain('タブを移動しました');
    expect(tm.activeIndex).toBe(0);
  });

  test('at the strip edge the move command says so instead of lying', () => {
    const tm = makeManager();
    tm.newTab('https://a.example'); // active
    const vc = makeVoice({ tabManager: tm });
    vc.processCommand('タブを左に移動');
    expect(vc._spoken).toContain('タブをこれ以上移動できません');
  });

  test('"タブを閉じる" on a pinned tab is refused and announced honestly', () => {
    const tm = makeManager();
    const a = tm.newTab('https://a.example');
    tm.pinTab(0);
    const vc = makeVoice({ tabManager: tm });
    vc.processCommand('タブを閉じる');
    expect(vc._spoken).toContain('ピン留めされたタブは閉じられません');
    expect(a.disposed).toBe(false);
    expect(tm.tabs.length).toBe(1);
  });
});

// ── bookmarks-open ────────────────────────────────────────────────────────────
describe('bookmarks-open voice command', () => {
  function makePanel() {
    return {
      mode: 'bookmarks', visible: false,
      setMode: jest.fn(function (m) { this.mode = m; }),
      show: jest.fn(function () { this.visible = true; }),
      hide: jest.fn(function () { this.visible = false; }),
      toggle: jest.fn(function () { this.visible = !this.visible; })
    };
  }

  test('"ブックマークを開いて" sets bookmarks mode and shows the panel', () => {
    const bp = makePanel();
    const vc = makeVoice({ bookmarkPanel: bp });
    vc.processCommand('ブックマークを開いて');
    expect(bp.setMode).toHaveBeenCalledWith('bookmarks');
    expect(bp.show).toHaveBeenCalled();
    expect(vc._spoken).toContain('ブックマークを開きます');
  });

  test('an already-visible panel is shown, never hidden (open≠toggle)', () => {
    const bp = makePanel();
    bp.visible = true;
    const vc = makeVoice({ bookmarkPanel: bp });
    vc.processCommand('ブックマークを開いて');
    expect(bp.show).not.toHaveBeenCalled();
    expect(bp.hide).not.toHaveBeenCalled();
    expect(bp.visible).toBe(true);
  });
});
