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
      this.curved = false;
      panelInstances.push(this);
    }
    addToScene(parent) { this.parent = parent; }
    navigate(url) { this.currentUrl = url; }
    // Mirrors the real WebPanel: show(position) HARD-SETS the transform. The
    // stub must model that, otherwise a test asserting "switching tabs does not
    // re-position a panel" passes even against the show(this.position) code it
    // is meant to catch.
    show(position = { x: 0, y: 1.5, z: -2 }) {
      this.group.position.set(position.x, position.y, position.z);
      this.visible = true;
    }
    hide() { this.visible = false; }
    // TabManager switches tabs via setVisible, which (unlike show(position))
    // leaves the transform alone so the managed placement survives.
    setVisible(v) { this.visible = !!v; }
    setCurved(v) { this.curved = !!v; }
    setReaderProxyUrl(u) { this.readerProxyUrl = u; }
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

  test('fires onMaxTabsReached when newTab() is blocked (WCAG 4.1.3)', () => {
    const onMaxTabsReached = jest.fn();
    const tm = new TabManager({
      scene: { add: jest.fn(), remove: jest.fn() },
      registerInteractable: jest.fn(),
      unregisterInteractable: jest.fn(),
      onNavigate: jest.fn(),
      onMaxTabsReached
    });
    for (let i = 0; i < 8; i++) tm.newTab();
    expect(onMaxTabsReached).not.toHaveBeenCalled();

    const blocked = tm.newTab();

    expect(blocked).toBeNull();
    expect(onMaxTabsReached).toHaveBeenCalledTimes(1);
  });

  test('does not throw when onMaxTabsReached is omitted and the cap is hit', () => {
    const tm = makeManager(); // no onMaxTabsReached in opts
    for (let i = 0; i < 8; i++) tm.newTab();
    expect(() => tm.newTab()).not.toThrow();
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

  test('setCurved() applies to every open tab', () => {
    const tm = makeManager();
    const a = tm.newTab();
    const b = tm.newTab();
    tm.setCurved(true);
    expect(a.curved).toBe(true);
    expect(b.curved).toBe(true);
  });

  test('new tabs inherit the curved preference', () => {
    const tm = makeManager();
    tm.setCurved(true);
    const panel = tm.newTab();
    expect(panel.curved).toBe(true);
  });

  test('_onStripSelect accepts the controller/gaze event format { intersection: { point } }', () => {
    // Controllers and gaze both call onSelect({ intersection: hit, ... }).
    // _onStripSelect must extract hit.point rather than calling .clone() on the
    // wrapper directly (which has no .clone() method).
    const tm = makeManager();
    tm.newTab(); // need at least one tab so a click on a tab row does something

    // A hit in the centre-left area (x slightly negative → first tab zone)
    const fakePoint = { x: -0.5, y: 0, clone() { return this; } };
    expect(() => tm._onStripSelect({ intersection: { point: fakePoint }, controller: {} })).not.toThrow();
  });

  test('_onStripSelect with direct Vector3 arg still works (regression)', () => {
    const tm = makeManager();
    tm.newTab();
    const fakePoint = { x: 0, y: 0, clone() { return this; } };
    expect(() => tm._onStripSelect(fakePoint)).not.toThrow();
  });

  describe('grab-to-move passthrough', () => {
    test('onGrabRequested is forwarded to every WebPanel', () => {
      const onGrabRequested = jest.fn();
      const tm = new TabManager({
        scene: { add: jest.fn(), remove: jest.fn() },
        registerInteractable: jest.fn(),
        unregisterInteractable: jest.fn(),
        onNavigate: jest.fn(),
        onGrabRequested
      });
      const panel = tm.newTab();
      expect(panel.opts.onGrabRequested).toBe(onGrabRequested);
    });

    test('onMoveBarHoverCaption is forwarded to every WebPanel', () => {
      const onMoveBarHoverCaption = jest.fn();
      const tm = new TabManager({
        scene: { add: jest.fn(), remove: jest.fn() },
        registerInteractable: jest.fn(),
        unregisterInteractable: jest.fn(),
        onNavigate: jest.fn(),
        onMoveBarHoverCaption
      });
      const panel = tm.newTab();
      expect(panel.opts.onMoveBarHoverCaption).toBe(onMoveBarHoverCaption);
    });

    test('both default to null when not provided', () => {
      const tm = makeManager();
      const panel = tm.newTab();
      expect(panel.opts.onGrabRequested).toBeNull();
      expect(panel.opts.onMoveBarHoverCaption).toBeNull();
    });
  });
});

// ── One managed transform for the whole browser window (Session 71) ──────────
// The strip used to be a sibling of the panels, pinned to the same fixed
// position, while windowManager managed only the *active panel's* group — so
// moving the panel left the strip behind, and setActive()'s show(this.position)
// snapped the panel back, discarding any grab-to-move placement.
describe('TabManager — rootGroup owns the strip and every panel', () => {
  let tm;
  beforeEach(() => {
    panelInstances.length = 0;
    tm = makeManager();
  });

  test('the strip is a child of rootGroup, at the group-local origin', () => {
    expect(tm.rootGroup._objects).toContain(tm.stripGroup);
    expect(tm.stripGroup.position.set).toHaveBeenCalledWith(0, 0, 0);
  });

  test('rootGroup carries the world placement', () => {
    expect(tm.rootGroup.position.set).toHaveBeenCalledWith(
      tm.position.x, tm.position.y, tm.position.z
    );
  });

  test('new panels are parented to rootGroup at the local origin', () => {
    tm.newTab();
    const panel = panelInstances[panelInstances.length - 1];
    expect(panel.parent).toBe(tm.rootGroup);
    expect(panel.group.position.set).toHaveBeenCalledWith(0, 0, 0);
  });

  test('switching tabs does not re-position any panel (grab placement survives)', () => {
    tm.newTab();
    tm.newTab();
    const [a, b] = panelInstances;
    a.group.position.set.mockClear();
    b.group.position.set.mockClear();

    tm.setActive(0);
    expect(a.visible).toBe(true);
    expect(b.visible).toBe(false);
    tm.setActive(1);
    expect(b.visible).toBe(true);
    expect(a.visible).toBe(false);

    // The regression: show(this.position) used to fire here and reset the panel
    // to the original fixed spot on every switch.
    expect(a.group.position.set).not.toHaveBeenCalled();
    expect(b.group.position.set).not.toHaveBeenCalled();
  });

  test('addToScene adds the root group (one add covers strip + panels)', () => {
    tm.addToScene();
    expect(tm.scene.add).toHaveBeenCalledWith(tm.rootGroup);
    expect(tm.scene.add).not.toHaveBeenCalledWith(tm.stripGroup);
  });

  test('dispose removes the root group from the scene', () => {
    tm.addToScene();
    tm.dispose();
    expect(tm.scene.remove).toHaveBeenCalledWith(tm.rootGroup);
  });
});

describe('TabManager.setReaderProxyUrl', () => {
  test('propagates to every open tab and to tabs opened afterwards', () => {
    panelInstances.length = 0;
    const tm = makeManager();
    tm.newTab();
    tm.newTab();

    tm.setReaderProxyUrl('http://p:8080');

    const [a, b] = panelInstances;
    expect(a.readerProxyUrl).toBe('http://p:8080');
    expect(b.readerProxyUrl).toBe('http://p:8080');
    // Future tabs inherit through opts.
    tm.newTab();
    expect(panelInstances[2].opts.readerProxyUrl).toBe('http://p:8080');
  });

  test('clearing propagates too, and non-strings coerce to empty', () => {
    panelInstances.length = 0;
    const tm = makeManager();
    tm.newTab();
    tm.setReaderProxyUrl('http://p:8080');
    tm.setReaderProxyUrl(null);
    expect(panelInstances[0].readerProxyUrl).toBe('');
  });
});

// ── Reader text size reaches the panels ──────────────────────────────────────
// WebPanel has always accepted `readerScale`, and its docstring said to compose
// it with the a11y large-text preference at the call site. No call site did, so
// a low-vision user got larger captions and toasts while the article body — the
// text they actually came to read — stayed at the default size.
describe('TabManager passes the reader text scale to its panels', () => {
  const withScale = (opts) => new TabManager({
    scene: { add: jest.fn(), remove: jest.fn() },
    registerInteractable: jest.fn(),
    unregisterInteractable: jest.fn(),
    onNavigate: jest.fn(),
    ...opts
  });

  beforeEach(() => { panelInstances.length = 0; });

  test('a scale given to TabManager reaches every tab it opens', () => {
    const tm = withScale({ readerScale: 1.4 });
    tm.newTab();
    tm.newTab();
    expect(panelInstances.map((p) => p.opts.readerScale)).toEqual([1.4, 1.4]);
  });

  test('the default is unscaled, so nothing changes without the preference', () => {
    withScale({}).newTab();
    expect(panelInstances[panelInstances.length - 1].opts.readerScale).toBe(1);
  });
});
