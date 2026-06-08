/**
 * Unit tests for TabManager (FR-1.3).
 * THREE and WebPanel are mocked so the pure tab-lifecycle logic can be
 * exercised without a WebGL context or real iframes.
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
      this.group = { position: { set: jest.fn() } };
      this.visible = false;
      this.disposed = false;
      panelInstances.push(this);
    }
    addToScene() {}
    navigate(url) { this.currentUrl = url; }
    show() { this.visible = true; }
    hide() { this.visible = false; }
    dispose() { this.disposed = true; }
  }
}));

// ── document/canvas stub ────────────────────────────────────────────────────────
global.document = {
  createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({
      clearRect: jest.fn(), fillRect: jest.fn(), fillText: jest.fn(),
      fillStyle: '', font: '', textAlign: '', textBaseline: ''
    })
  })
};
global.URL = URL;

const { TabManager } = require('../src/vr/browser/TabManager.js');

function makeManager() {
  return new TabManager({
    scene: { add: jest.fn(), remove: jest.fn() },
    registerInteractable: jest.fn(),
    unregisterInteractable: jest.fn(),
    onNavigate: jest.fn()
  });
}

describe('TabManager (FR-1.3)', () => {
  beforeEach(() => { panelInstances.length = 0; });

  test('starts with zero tabs', () => {
    const tm = makeManager();
    expect(tm.count).toBe(0);
    expect(tm.getActiveTab()).toBeNull();
  });

  test('newTab() creates and activates a tab', () => {
    const tm = makeManager();
    const panel = tm.newTab();
    expect(tm.count).toBe(1);
    expect(tm.getActiveTab()).toBe(panel);
    expect(panel.visible).toBe(true);
  });

  test('newTab(url) navigates the new tab', () => {
    const tm = makeManager();
    const panel = tm.newTab('https://example.com');
    expect(panel.currentUrl).toBe('https://example.com');
  });

  test('opening a second tab hides the first', () => {
    const tm = makeManager();
    const a = tm.newTab();
    const b = tm.newTab();
    expect(a.visible).toBe(false);
    expect(b.visible).toBe(true);
    expect(tm.getActiveTab()).toBe(b);
  });

  test('setActive() switches the visible tab', () => {
    const tm = makeManager();
    const a = tm.newTab();
    tm.newTab();
    tm.setActive(0);
    expect(a.visible).toBe(true);
    expect(tm.getActiveTab()).toBe(a);
  });

  test('closeTab() disposes the panel and removes it', () => {
    const tm = makeManager();
    const a = tm.newTab();
    tm.closeTab(0);
    expect(a.disposed).toBe(true);
    expect(tm.count).toBe(0);
  });

  test('closing the active tab activates a neighbour', () => {
    const tm = makeManager();
    const a = tm.newTab();
    const b = tm.newTab(); // active
    tm.closeTab(1);        // close active (b)
    expect(b.disposed).toBe(true);
    expect(tm.getActiveTab()).toBe(a);
    expect(a.visible).toBe(true);
  });

  test('does not exceed MAX_TABS (8)', () => {
    const tm = makeManager();
    for (let i = 0; i < 10; i++) tm.newTab();
    expect(tm.count).toBe(8);
  });

  test('dispose() disposes all tabs', () => {
    const tm = makeManager();
    tm.newTab();
    tm.newTab();
    const panels = [...panelInstances];
    tm.dispose();
    expect(panels.every(p => p.disposed)).toBe(true);
    expect(tm.count).toBe(0);
  });
});
