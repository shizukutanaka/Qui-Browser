/**
 * Tab session persistence + private-mode plumbing.
 *
 * Grounding for both features: Wolvic 1.9 (2026) shipped "remember browser
 * state" after users kept losing open tabs across upgrades; Quest Browser's
 * private window drops all session data on exit. The two features share one
 * invariant — a private tab's destinations must NEVER reach persistent
 * storage — so they are tested together: every serialize path is checked for
 * the private exclusion, not just the history-write path.
 *
 * THREE / WebPanel / canvas are stubbed the same way tab-manager.test.js does.
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

// ── WebPanel stub (isPrivate mirrors the real ctor's privateMode opt) ─────────
const panelInstances = [];
jest.mock('../src/vr/browser/WebPanel.js', () => ({
  WebPanel: class {
    constructor(opts) {
      this.opts = opts;
      this.isPrivate = !!opts.privateMode;
      this.currentUrl = '';
      this.group = { position: { set: jest.fn() } };
      this.visible = false;
      this.disposed = false;
      panelInstances.push(this);
    }
    addToScene(parent) { this.parent = parent; }
    navigate(url) { this.currentUrl = url; }
    setVisible(v) { this.visible = !!v; }
    dispose() { this.disposed = true; }
  }
}));

// ── document/canvas stub (records draw calls for the chip/palette checks) ─────
const recordedFillText = [];
const recordedFillStyles = [];
global.document = {
  createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({
      clearRect: jest.fn(), fillRect: jest.fn(),
      fillText: (...a) => recordedFillText.push(a[0]),
      beginPath: jest.fn(), arc: jest.fn(), fill: jest.fn(),
      set fillStyle(v) { recordedFillStyles.push(v); },
      get fillStyle() { return ''; },
      font: '', textAlign: '', textBaseline: ''
    })
  })
};
global.URL = URL;

const { TabManager } = require('../src/vr/browser/TabManager.js');
const {
  TAB_SESSION_KEY, MAX_RESTORE_TABS,
  serializeTabSession, validateTabSession, loadTabSession, saveTabSession
} = require('../src/vr/browser/tabSession.js');

function makeManager(opts = {}) {
  return new TabManager({
    scene: { add: jest.fn(), remove: jest.fn() },
    registerInteractable: jest.fn(),
    unregisterInteractable: jest.fn(),
    onNavigate: jest.fn(),
    ...opts
  });
}

beforeEach(() => {
  panelInstances.length = 0;
  recordedFillText.length = 0;
  recordedFillStyles.length = 0;
  localStorage.clear();
});

// ── serializeTabSession ─────────────────────────────────────────────────────
describe('serializeTabSession', () => {
  test('keeps http(s) tabs in order and maps the active index', () => {
    const snap = serializeTabSession([
      { url: 'https://a.example', isPrivate: false },
      { url: 'https://b.example', isPrivate: false },
      { url: 'https://c.example', isPrivate: false }
    ], 1);
    expect(snap).toEqual({ v: 1, tabs: ['https://a.example', 'https://b.example', 'https://c.example'], active: 1 });
  });

  test('drops private and non-http tabs, remapping active into the survivors', () => {
    const snap = serializeTabSession([
      { url: 'https://a.example', isPrivate: false },
      { url: 'https://secret.example', isPrivate: true },
      { url: 'javascript:alert(1)', isPrivate: false },
      { url: 'https://b.example', isPrivate: false }
    ], 3);
    expect(snap.tabs).toEqual(['https://a.example', 'https://b.example']);
    expect(snap.active).toBe(1);
  });

  test('returns null when nothing restorable remains (all private / empty)', () => {
    expect(serializeTabSession([
      { url: 'https://secret.example', isPrivate: true }
    ], 0)).toBeNull();
    expect(serializeTabSession([], -1)).toBeNull();
    expect(serializeTabSession(null, 0)).toBeNull();
  });

  test('caps the snapshot at MAX_RESTORE_TABS', () => {
    const panels = Array.from({ length: 12 }, (_, i) => ({ url: `https://s${i}.example`, isPrivate: false }));
    const snap = serializeTabSession(panels, 11);
    expect(snap.tabs).toHaveLength(MAX_RESTORE_TABS);
    expect(snap.active).toBeLessThan(MAX_RESTORE_TABS);
  });
});

// ── validateTabSession — storage is user-writable, so nothing is trusted ────
describe('validateTabSession', () => {
  test('rejects malformed shapes outright', () => {
    expect(validateTabSession(null)).toBeNull();
    expect(validateTabSession('https://a.example')).toBeNull();
    expect(validateTabSession({})).toBeNull();
    expect(validateTabSession({ tabs: 'https://a.example' })).toBeNull();
    expect(validateTabSession({ tabs: [] })).toBeNull();
  });

  test('filters non-http(s) URLs — a javascript: entry must never reach navigate()', () => {
    const snap = validateTabSession({
      tabs: ['javascript:alert(1)', 'data:text/html,x', 'https://ok.example', 'file:///etc/passwd'],
      active: 0
    });
    expect(snap.tabs).toEqual(['https://ok.example']);
    expect(snap.active).toBe(0);
  });

  test('clamps the stored active index into range', () => {
    const snap = validateTabSession({ tabs: ['https://a.example'], active: 99 });
    expect(snap.active).toBe(0);
    expect(validateTabSession({ tabs: ['https://a.example'], active: -5 }).active).toBe(0);
    expect(validateTabSession({ tabs: ['https://a.example'] }).active).toBe(0);
  });
});

// ── localStorage round trip ──────────────────────────────────────────────────
describe('loadTabSession / saveTabSession', () => {
  test('save → load round-trips a snapshot', () => {
    const snap = { v: 1, tabs: ['https://a.example', 'https://b.example'], active: 1 };
    expect(saveTabSession(snap)).toBe(true);
    expect(loadTabSession()).toEqual({ tabs: snap.tabs, active: 1 });
  });

  test('save(null) clears the stored snapshot', () => {
    saveTabSession({ v: 1, tabs: ['https://a.example'], active: 0 });
    saveTabSession(null);
    expect(loadTabSession()).toBeNull();
  });

  test('corrupt stored JSON yields null, not a throw', () => {
    localStorage.setItem(TAB_SESSION_KEY, '{not json');
    expect(loadTabSession()).toBeNull();
  });

  test('garbage stored shape yields null', () => {
    localStorage.setItem(TAB_SESSION_KEY, JSON.stringify({ tabs: 42 }));
    expect(loadTabSession()).toBeNull();
  });
});

// ── TabManager wiring ────────────────────────────────────────────────────────
describe('TabManager private mode + session', () => {
  test('setPrivateMode marks only subsequently opened tabs (incognito-window semantics)', () => {
    const tm = makeManager();
    const before = tm.newTab();
    tm.setPrivateMode(true);
    const during = tm.newTab();
    tm.setPrivateMode(false);
    const after = tm.newTab();
    expect(before.isPrivate).toBe(false);
    expect(during.isPrivate).toBe(true);
    expect(after.isPrivate).toBe(false);
    expect(tm._privateMode).toBe(false);
  });

  test('serializeSession excludes private tabs and keeps the active public tab', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    tm.setPrivateMode(true);
    tm.newTab('https://secret.example');
    tm.setPrivateMode(false);
    tm.newTab('https://b.example'); // active = index 2
    const snap = tm.serializeSession();
    expect(snap.tabs).toEqual(['https://a.example', 'https://b.example']);
    expect(snap.active).toBe(1);
  });

  test('serializeSession is null when every tab is private (nothing may persist)', () => {
    const tm = makeManager();
    tm.setPrivateMode(true);
    tm.newTab('https://secret1.example');
    tm.newTab('https://secret2.example');
    expect(tm.serializeSession()).toBeNull();
  });

  test('restoreSession reopens the snapshot and activates the stored tab', () => {
    const tm = makeManager();
    tm.restoreSession({ tabs: ['https://a.example', 'https://b.example'], active: 0 });
    expect(tm.count).toBe(2);
    expect(panelInstances.map(p => p.currentUrl)).toEqual(['https://a.example', 'https://b.example']);
    expect(tm.getActiveTab()).toBe(panelInstances[0]);
    expect(panelInstances[0].visible).toBe(true);
    expect(panelInstances[1].visible).toBe(false);
  });

  test('restoreSession with a null/empty snapshot is a no-op', () => {
    const tm = makeManager();
    tm.restoreSession(null);
    tm.restoreSession({ tabs: [], active: 0 });
    expect(tm.count).toBe(0);
  });

  test('the PRIVATE chip is drawn only while private mode is on (text, not colour-only)', () => {
    const tm = makeManager();
    recordedFillText.length = 0;
    tm._drawStrip();
    expect(recordedFillText).not.toContain('PRIVATE');
    tm.setPrivateMode(true);
    expect(recordedFillText).toContain('PRIVATE');
  });

  test('a select landing on the chip zone is inert — not treated as a tab or "+"', () => {
    const tm = makeManager();
    tm.setPrivateMode(true);
    tm.newTab();
    const before = tm.count;
    // px inside [width - 90 - 132, width - 90): the chip rect
    const chipPx = tm.stripCanvas.width - 90 - 60;
    const u = chipPx / tm.stripCanvas.width;
    const x = (u - 0.5) * 1.6; // STRIP_W
    const pt = { x, y: 0, clone() { return this; } };
    tm._onStripSelect({ intersection: { point: pt }, controller: {} });
    expect(tm.count).toBe(before);
  });
});
