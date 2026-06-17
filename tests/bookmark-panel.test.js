/**
 * Behavioural tests for BookmarkPanel — THREE and canvas are mocked so the
 * selection/navigation wiring can be exercised headlessly. The pure layout
 * math is covered separately in bookmark-layout.test.js.
 */

const {
  PANEL_PX_W, PANEL_PX_H, HEADER_H, ROW_H
} = require('../src/vr/browser/bookmarkLayout.js');

// Panel mesh dimensions (mirror BookmarkPanel.js).
const PANEL_W = 1.2;
const PANEL_H = PANEL_W * (PANEL_PX_H / PANEL_PX_W);

// ── THREE mock ────────────────────────────────────────────────────────────────
class MockGroup {
  constructor() { this.position = { set: jest.fn() }; this.rotation = {}; this._o = []; }
  add(o) { this._o.push(o); }
  remove(o) { this._o = this._o.filter(x => x !== o); }
}
class MockMesh {
  constructor() { this.name = ''; this.visible = true; this.geometry = { dispose: jest.fn() }; this.material = { dispose: jest.fn() }; }
  // Return whatever was injected via _nextLocal.
  worldToLocal() { return MockMesh._nextLocal; }
}
MockMesh._nextLocal = { x: 0, y: 0 };

jest.mock('three', () => ({
  Group: MockGroup,
  Mesh: MockMesh,
  PlaneGeometry: class { dispose() {} },
  MeshBasicMaterial: class { dispose() {} },
  CanvasTexture: class { constructor() { this.needsUpdate = false; } dispose() {} },
  SRGBColorSpace: 'srgb'
}));

// ── canvas/document mock ────────────────────────────────────────────────────
// NB: use plain functions (not jest.fn) — jest.config has resetMocks:true which
// would wipe jest.fn implementations before each test, leaving createElement
// returning undefined at panel-construction time.
const ctxStub = {
  fillRect() {}, fillText() {}, strokeRect() {}, clearRect() {},
  set fillStyle(v) {}, set strokeStyle(v) {},
  set font(v) {}, set textAlign(v) {}, set lineWidth(v) {}
};
global.document = global.document || {};
global.document.createElement = () => ({
  width: 0, height: 0, getContext: () => ctxStub
});

const { BookmarkPanel } = require('../src/vr/browser/BookmarkPanel.js');

// Compute the mesh-local coords that map to a desired canvas pixel.
function localFor(px, py) {
  const u = px / PANEL_PX_W;
  const v = 1 - py / PANEL_PX_H;
  return { x: (u - 0.5) * PANEL_W, y: (v - 0.5) * PANEL_H, clone() { return this; } };
}

function makeStore(bookmarks = [], history = []) {
  return {
    getBookmarks: () => bookmarks,
    getHistory: () => history
  };
}

function makePanel(store, onSelect = jest.fn()) {
  const p = new BookmarkPanel({
    scene: { add: jest.fn(), remove: jest.fn() },
    registerInteractable: jest.fn(),
    unregisterInteractable: jest.fn(),
    store,
    onSelect
  });
  p.addToScene();
  return p;
}

describe('BookmarkPanel', () => {
  test('defaults to bookmarks mode and hidden', () => {
    const p = makePanel(makeStore());
    expect(p.mode).toBe('bookmarks');
    expect(p.visible).toBe(false);
  });

  test('show()/hide()/toggle() flip visibility', () => {
    const p = makePanel(makeStore());
    p.show();
    expect(p.visible).toBe(true);
    expect(p.mesh.visible).toBe(true);
    p.hide();
    expect(p.visible).toBe(false);
    p.toggle();
    expect(p.visible).toBe(true);
  });

  test('_rows() returns bookmarks in bookmarks mode', () => {
    const store = makeStore([{ url: 'https://a.com', title: 'A' }], [{ url: 'https://h.com', title: 'H' }]);
    const p = makePanel(store);
    expect(p._rows()).toHaveLength(1);
    expect(p._rows()[0].url).toBe('https://a.com');
  });

  test('_rows() returns history in history mode', () => {
    const store = makeStore([{ url: 'https://a.com' }], [{ url: 'https://h.com' }]);
    const p = makePanel(store);
    p.setMode('history');
    expect(p._rows()[0].url).toBe('https://h.com');
  });

  test('selecting a row calls onSelect with its url and hides', () => {
    const onSelect = jest.fn();
    const store = makeStore([
      { url: 'https://first.com', title: 'First' },
      { url: 'https://second.com', title: 'Second' }
    ]);
    const p = makePanel(store, onSelect);
    p.show();
    // Click first row: py in [HEADER_H, HEADER_H+ROW_H)
    MockMesh._nextLocal = localFor(100, HEADER_H + 10);
    p._onSelect({ clone() { return MockMesh._nextLocal; } });
    expect(onSelect).toHaveBeenCalledWith('https://first.com');
    expect(p.visible).toBe(false);
  });

  test('selecting the second row picks the second url', () => {
    const onSelect = jest.fn();
    const store = makeStore([
      { url: 'https://first.com' },
      { url: 'https://second.com' }
    ]);
    const p = makePanel(store, onSelect);
    MockMesh._nextLocal = localFor(100, HEADER_H + ROW_H + 10);
    p._onSelect({ clone() { return MockMesh._nextLocal; } });
    expect(onSelect).toHaveBeenCalledWith('https://second.com');
  });

  test('clicking the history tab switches mode', () => {
    const p = makePanel(makeStore());
    MockMesh._nextLocal = localFor(300, HEADER_H / 2); // history tab region
    p._onSelect({ clone() { return MockMesh._nextLocal; } });
    expect(p.mode).toBe('history');
  });

  test('clicking close hides the panel', () => {
    const p = makePanel(makeStore());
    p.show();
    MockMesh._nextLocal = localFor(PANEL_PX_W - 20, HEADER_H / 2); // close region
    p._onSelect({ clone() { return MockMesh._nextLocal; } });
    expect(p.visible).toBe(false);
  });

  test('selecting empty area does nothing', () => {
    const onSelect = jest.fn();
    const p = makePanel(makeStore(), onSelect);
    p.show();
    MockMesh._nextLocal = localFor(600, HEADER_H / 2); // gap between tabs and close
    p._onSelect({ clone() { return MockMesh._nextLocal; } });
    expect(onSelect).not.toHaveBeenCalled();
    expect(p.visible).toBe(true);
  });

  test('dispose() removes from scene and unregisters', () => {
    const unreg = jest.fn();
    const p = new BookmarkPanel({
      scene: { add: jest.fn(), remove: jest.fn() },
      registerInteractable: jest.fn(),
      unregisterInteractable: unreg,
      store: makeStore(),
      onSelect: jest.fn()
    });
    p.addToScene();
    p.dispose();
    expect(unreg).toHaveBeenCalled();
  });
});

describe('BookmarkPanel — large-text physical scaling', () => {
  function makeScaledPanel(store, scale, onSelect = jest.fn()) {
    const p = new BookmarkPanel({
      scene: { add: jest.fn(), remove: jest.fn() },
      registerInteractable: jest.fn(),
      unregisterInteractable: jest.fn(),
      store,
      onSelect,
      scale
    });
    p.addToScene();
    return p;
  }

  // local coords for a pixel on a panel of the given physical size.
  function localForScaled(px, py, panelW, panelH) {
    const u = px / PANEL_PX_W;
    const v = 1 - py / PANEL_PX_H;
    return { x: (u - 0.5) * panelW, y: (v - 0.5) * panelH, clone() { return this; } };
  }

  test('default scale = 1 leaves base metre dimensions', () => {
    const p = makeScaledPanel(makeStore(), undefined);
    expect(p.scale).toBe(1);
    expect(p.panelW).toBeCloseTo(PANEL_W, 6);
    expect(p.panelH).toBeCloseTo(PANEL_H, 6);
  });

  test('scale 1.3 enlarges the panel proportionally (both axes)', () => {
    const p = makeScaledPanel(makeStore(), 1.3);
    expect(p.panelW).toBeCloseTo(PANEL_W * 1.3, 6);
    expect(p.panelH).toBeCloseTo(PANEL_H * 1.3, 6);
    // Aspect ratio is preserved so the canvas (fixed pixels) maps cleanly.
    expect(p.panelW / p.panelH).toBeCloseTo(PANEL_W / PANEL_H, 6);
  });

  test('non-positive scale falls back to 1 (defensive)', () => {
    expect(makeScaledPanel(makeStore(), 0).scale).toBe(1);
    expect(makeScaledPanel(makeStore(), -2).scale).toBe(1);
  });

  test('hit-testing stays correct at scale: same pixel selects same row', () => {
    const onSelect = jest.fn();
    const store = makeStore([
      { url: 'https://first.com', title: 'First' },
      { url: 'https://second.com', title: 'Second' }
    ]);
    const p = makeScaledPanel(store, 1.3, onSelect);
    p.show();
    // Click the second row using the SCALED local coords. Because _onSelect
    // normalises by this.panelW/this.panelH, the UV (and thus the row) is the
    // same as it would be at scale 1.
    MockMesh._nextLocal = localForScaled(100, HEADER_H + ROW_H + 10, p.panelW, p.panelH);
    p._onSelect({ clone() { return MockMesh._nextLocal; } });
    expect(onSelect).toHaveBeenCalledWith('https://second.com');
  });
});
