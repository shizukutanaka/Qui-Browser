/**
 * TabManager.closeTab must only fire onTabActivate when the resolved active
 * panel actually changed.
 *
 * Closing an INACTIVE tab positioned left of the active one decrements
 * activeIndex and re-ran setActive() unconditionally — resolving to the same
 * panel but re-firing the callback, so VRApp re-showed the "Tab: X" caption
 * for the tab the user never left (and persisted the session redundantly).
 * WCAG 4.1.3: a status message must reflect a real status change.
 */

// ── THREE stub (same shape as tests/tab-manager.test.js) ─────────────────────
class MockGroup {
  constructor() {
    this.position = { set: jest.fn() };
    this._objects = [];
  }
  add(o) {
    this._objects.push(o);
  }
  remove(o) {
    this._objects = this._objects.filter((x) => x !== o);
  }
  traverse(fn) {
    this._objects.forEach(fn);
    fn(this);
  }
}
class MockMesh {
  constructor() {
    this.name = '';
    this.position = { set: jest.fn() };
  }
  worldToLocal(v) {
    return v;
  }
}
jest.mock('three', () => ({
  Group: MockGroup,
  Mesh: MockMesh,
  PlaneGeometry: class {
    dispose() {}
  },
  MeshBasicMaterial: class {
    dispose() {}
  },
  CanvasTexture: class {
    constructor() {
      this.needsUpdate = false;
    }
    dispose() {}
  }
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
      this.pinned = false;
      this.isPrivate = false;
      panelInstances.push(this);
    }
    addToScene(parent) {
      this.parent = parent;
    }
    navigate(url) {
      this.currentUrl = url;
    }
    show() {
      this.visible = true;
    }
    hide() {
      this.visible = false;
    }
    setVisible(v) {
      this.visible = !!v;
    }
    dispose() {
      this.disposed = true;
    }
  }
}));

// ── document/canvas stub ──────────────────────────────────────────────────────
global.document = {
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () => ({
      clearRect: jest.fn(),
      fillRect: jest.fn(),
      fillText: jest.fn(),
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: ''
    })
  })
};

const { TabManager } = require('../src/vr/browser/TabManager.js');

function makeManager() {
  const onTabActivate = jest.fn();
  const tm = new TabManager({
    scene: { add: jest.fn(), remove: jest.fn() },
    registerInteractable: jest.fn(),
    unregisterInteractable: jest.fn(),
    onNavigate: jest.fn(),
    onTabActivate
  });
  return { tm, onTabActivate };
}

function threeTabs(tm, onTabActivate) {
  tm.newTab('https://a.example');
  tm.newTab('https://b.example');
  const active = tm.newTab('https://c.example'); // activeIndex 2
  onTabActivate.mockClear();
  return active;
}

describe('TabManager.closeTab — onTabActivate fires only on a real switch', () => {
  beforeEach(() => {
    panelInstances.length = 0;
  });

  test('closing an inactive tab left of the active one does NOT re-announce it', () => {
    const { tm, onTabActivate } = makeManager();
    const active = threeTabs(tm, onTabActivate);
    expect(tm.closeTab(0)).toBe(true);
    expect(tm.getActiveTab()).toBe(active);
    expect(onTabActivate).not.toHaveBeenCalled();
  });

  test('closing an inactive tab between the first and the active does NOT re-announce', () => {
    const { tm, onTabActivate } = makeManager();
    const active = threeTabs(tm, onTabActivate);
    expect(tm.closeTab(1)).toBe(true);
    expect(tm.getActiveTab()).toBe(active);
    expect(onTabActivate).not.toHaveBeenCalled();
  });

  test('closing the ACTIVE tab announces the replacement neighbour', () => {
    const { tm, onTabActivate } = makeManager();
    threeTabs(tm, onTabActivate);
    expect(tm.closeTab(2)).toBe(true);
    expect(onTabActivate).toHaveBeenCalledTimes(1);
    expect(onTabActivate).toHaveBeenCalledWith('https://b.example');
  });

  test('closing the active first tab announces the new first tab', () => {
    const { tm, onTabActivate } = makeManager();
    threeTabs(tm, onTabActivate);
    tm.setActive(0);
    onTabActivate.mockClear();
    expect(tm.closeTab(0)).toBe(true);
    expect(onTabActivate).toHaveBeenCalledTimes(1);
    expect(onTabActivate).toHaveBeenCalledWith('https://b.example');
  });
});
