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
    setSearchEngine(e) { this.searchEngine = e; }
    dispose() { this.disposed = true; }
  }
}));

// ── document/canvas stub ────────────────────────────────────────────────────────
global.document = {
  createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({
      clearRect: jest.fn(), fillRect: jest.fn(), fillText: jest.fn(),
      strokeRect: jest.fn(), measureText: jest.fn(() => ({ width: 10 })),
      fillStyle: '', strokeStyle: '', font: '', textAlign: '', textBaseline: ''
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

// ── Session persistence (F-4) ──────────────────────────────────────────────
// The tab set was never persisted: every VR session started from one blank tab
// no matter what was open at exit. serialize()/restoreSession() are the pure
// half; storage policy (and the private-mode gate) lives in VRApp.
describe('TabManager — session persistence (F-4)', () => {
  beforeEach(() => { panelInstances.length = 0; });

  test('serialize() captures only navigated tabs plus the filtered active index', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    tm.newTab();                      // blank tab — nothing to restore later
    tm.newTab('https://b.example');
    tm.setActive(2);

    const s = tm.serialize();

    expect(s.v).toBe(1);
    expect(s.tabs).toEqual([{ url: 'https://a.example' }, { url: 'https://b.example' }]);
    // Active index is expressed inside the filtered list, not the raw one.
    expect(s.active).toBe(1);
  });

  test('restoreSession() recreates the saved tabs and restores the active tab', () => {
    const tm = makeManager();
    const n = tm.restoreSession({
      v: 1, active: 1,
      tabs: [{ url: 'https://a.example' }, { url: 'https://b.example' }]
    });

    expect(n).toBe(2);
    expect(tm.count).toBe(2);
    expect(panelInstances.map(p => p.currentUrl)).toEqual(
      ['https://a.example', 'https://b.example']
    );
    expect(tm.getActiveTab()).toBe(panelInstances[1]);
    expect(panelInstances[0].visible).toBe(false);
  });

  test('restoreSession() returns 0 and creates nothing on missing/corrupt data', () => {
    const tm = makeManager();
    expect(tm.restoreSession(null)).toBe(0);
    expect(tm.restoreSession({})).toBe(0);
    expect(tm.restoreSession({ tabs: 'no' })).toBe(0);
    expect(tm.restoreSession({ tabs: [{ url: '' }, { url: 42 }, null] })).toBe(0);
    expect(tm.count).toBe(0);
  });

  test('restoreSession() clamps to MAX_TABS and clamps a stale active index', () => {
    const tm = makeManager();
    const n = tm.restoreSession({
      tabs: Array.from({ length: 12 }, (_, i) => ({ url: `https://${i}.example` })),
      active: 99
    });
    expect(n).toBe(8);
    expect(tm.count).toBe(8);
    expect(tm.activeIndex).toBe(7);
  });

  test('onSessionChange fires on every mutation that changes the persisted state', () => {
    const onSessionChange = jest.fn();
    const tm = new TabManager({
      scene: { add: jest.fn(), remove: jest.fn() },
      registerInteractable: jest.fn(),
      unregisterInteractable: jest.fn(),
      onNavigate: jest.fn(),
      onSessionChange
    });
    tm.newTab();
    expect(onSessionChange).toHaveBeenCalled();
    onSessionChange.mockClear();

    tm.newTab('https://a.example');
    panelInstances[1].opts.onNavigate('https://a.example', 'A');
    // newTab observes twice (its internal setActive + its own mutation) and the
    // panel's navigate callback once — every persisted-state change is seen.
    expect(onSessionChange).toHaveBeenCalledTimes(3);
    onSessionChange.mockClear();

    tm.setActive(0);
    tm.closeTab(0);
    expect(onSessionChange).toHaveBeenCalled();
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

// B-4: dispose() unregistered the strip but left this.stripMesh pointing at the
// dead mesh — a late onHoverEnd from the interaction system would then run
// material.color.set() on a disposed material. Harmless today (Color.set never
// throws), but a dangling handle is a dangling handle.
describe('B-4: dispose severs the strip handle', () => {
  test('dispose() nulls stripMesh and a late onHoverEnd is a no-op', () => {
    const interactables = new Map();
    const tm = new TabManager({
      scene: { add: jest.fn(), remove: jest.fn() },
      registerInteractable: (mesh, h) => interactables.set(mesh, h),
      unregisterInteractable: jest.fn(),
      onNavigate: jest.fn()
    });
    const handlers = interactables.get(tm.stripMesh);
    expect(handlers).toBeTruthy();
    tm.dispose();
    expect(tm.stripMesh).toBeNull();
    expect(() => handlers.onHoverEnd()).not.toThrow();
    expect(() => handlers.onHover()).not.toThrow();
  });
});

// ── Strip hit-zone dispatch ──────────────────────────────────────────────────
// _onStripSelect's zones were only covered by 'does not throw' smoke tests:
// the tab body/close-zone/new-tab-button routing itself was unverified.
// Canvas is STRIP_CANVAS_W px wide; MockMesh.worldToLocal returns its arg,
// so fakePoint.x IS the local x: px = round((x / STRIP_W + 0.5) * width).
describe('TabManager — strip hit-zone dispatch', () => {
  const { STRIP_W, STRIP_NEW_TAB_PX, tabWidthPx, tabCloseZonePx } =
    require('../src/vr/browser/panelGeometry.js');
  const CANVAS_W = 1024;
  const xForPx = (px) => (px / CANVAS_W - 0.5) * STRIP_W;
  const clickAt = (tm, px) =>
    tm._onStripSelect({ x: xForPx(px), y: 0, clone() { return this; } });

  beforeEach(() => { panelInstances.length = 0; });

  test('tab body activates; right 36px of a tab closes it', () => {
    const tm = makeManager();
    tm.newTab();
    tm.newTab(); // 2 tabs → tabW = 220, close zone = last 36px of each
    // Spies must not call through — a real closeTab mutates tabs.length and
    // shifts every zone boundary under the next click.
    const setActive = jest.spyOn(tm, 'setActive').mockImplementation(() => {});
    const closeTab = jest.spyOn(tm, 'closeTab').mockImplementation(() => {});

    clickAt(tm, 100);          // inside tab 0, left of its close zone
    expect(setActive).toHaveBeenCalledWith(0);
    setActive.mockClear();

    clickAt(tm, 200);          // inside tab 0 close zone (184–219)
    expect(closeTab).toHaveBeenCalledWith(0);
    closeTab.mockClear();

    clickAt(tm, 300);          // inside tab 1 body
    expect(setActive).toHaveBeenCalledWith(1);
  });

  test('the + zone at the strip edge opens a new tab', () => {
    const tm = makeManager();
    const newTab = jest.spyOn(tm, 'newTab');
    clickAt(tm, CANVAS_W - STRIP_NEW_TAB_PX / 2 - 5);
    expect(newTab).toHaveBeenCalledTimes(1);
  });

  test('empty space right of the tabs is dead — no activation, no close', () => {
    const tm = makeManager();
    tm.newTab();
    tm.newTab(); // tabs end at px 440; 440–934 is dead space
    const setActive = jest.spyOn(tm, 'setActive');
    const closeTab = jest.spyOn(tm, 'closeTab');
    const newTab = jest.spyOn(tm, 'newTab');
    clickAt(tm, 700);
    expect(setActive).not.toHaveBeenCalled();
    expect(closeTab).not.toHaveBeenCalled();
    expect(newTab).not.toHaveBeenCalled();
  });

  test('with zero tabs a body-zone click is a no-op', () => {
    const tm = makeManager();
    const setActive = jest.spyOn(tm, 'setActive');
    expect(() => clickAt(tm, 300)).not.toThrow();
    expect(setActive).not.toHaveBeenCalled();
  });

  test('zone edges agree with the drawn layout (tabWidthPx / tabCloseZonePx)', () => {
    // Pin the contract this test relies on: 2 tabs are 220px each, the +
    // button takes the last 90px, and the close zone is the rightmost 36px.
    expect(tabWidthPx(2, CANVAS_W)).toBe(220);
    const zone = tabCloseZonePx(220);
    expect([zone.x0, zone.x1]).toEqual([220 - 36, 220]);
    expect(CANVAS_W - STRIP_NEW_TAB_PX).toBe(934);
  });
});

describe('TabManager.setSearchEngine', () => {
  test('propagates to every open tab and to tabs opened afterwards', () => {
    panelInstances.length = 0;
    const tm = makeManager();
    tm.newTab();
    tm.newTab();

    tm.setSearchEngine('google');

    const [a, b] = panelInstances;
    expect(a.searchEngine).toBe('google');
    expect(b.searchEngine).toBe('google');
    tm.newTab();
    expect(panelInstances[2].opts.searchEngine).toBe('google');
  });
});

describe('TabManager — strip hover + high-contrast draw arms', () => {
  const { setPref } = require('../src/a11y/accessibility.js');

  test('strip onHover tints the mesh and fires the caption; onHoverEnd restores base tint', () => {
    const onHoverCaption = jest.fn();
    const tm = new TabManager({
      scene: { add: jest.fn(), remove: jest.fn() },
      registerInteractable: jest.fn(),
      unregisterInteractable: jest.fn(),
      onNavigate: jest.fn(),
      onHoverCaption
    });
    const cfg = tm.opts.registerInteractable.mock.calls
      .map(c => c[1]).find(c => c.onHoverEnd);
    expect(cfg).toBeTruthy();
    // MockMesh doesn't retain constructor args — give the mesh the material
    // shape real THREE provides
    tm.stripMesh.material = { color: { set: jest.fn() } };
    const colorSpy = tm.stripMesh.material.color.set;
    cfg.onHover();
    expect(colorSpy).toHaveBeenCalledWith(expect.any(Number)); // hoverTint
    expect(onHoverCaption).toHaveBeenCalled();
    cfg.onHoverEnd();
    expect(colorSpy).toHaveBeenLastCalledWith(0xffffff); // baseTint
  });

  test('high-contrast mode strokes the idle-tab / close / new-tab borders', () => {
    const strokeSpy = jest.fn();
    const prevDoc = global.document;
    global.document = { createElement: () => ({
      width: 0, height: 0,
      getContext: () => ({
        clearRect: jest.fn(), fillRect: jest.fn(), fillText: jest.fn(),
        strokeRect: strokeSpy, fillStyle: '', strokeStyle: '',
        font: '', textAlign: '', textBaseline: ''
      })
    }) };
    setPref('highContrast', true);
    try {
      const tm = new TabManager({
        scene: { add: jest.fn(), remove: jest.fn() },
        registerInteractable: jest.fn(), unregisterInteractable: jest.fn(),
        onNavigate: jest.fn()
      });
      tm.newTab(); tm.newTab(); // one active + one idle tab → idle border arm
      tm._drawStrip();
      expect(strokeSpy).toHaveBeenCalled();
    } finally {
      setPref('highContrast', false);
      global.document = prevDoc;
    }
  });

  test('_shortTitle falls back to the raw string prefix for unparseable URLs', () => {
    const tm = makeManager();
    expect(tm._shortTitle('not a url at all — this is long')).toBe('not a url at all —');
  });
});

describe('TabManager — remaining branch arms', () => {
  test('_onStripSelect with null evt returns early (no crash)', () => {
    const tm = makeManager();
    expect(() => tm._onStripSelect(null)).not.toThrow();
    expect(() => tm._onStripSelect(undefined)).not.toThrow();
  });

  test('closeTab: missing index is a no-op; closing the last tab resets activeIndex', () => {
    const tm = makeManager();
    expect(() => tm.closeTab(0)).not.toThrow(); // empty → early return
    tm.newTab('https://a.example');
    tm.closeTab(0);
    expect(tm.activeIndex).toBe(-1); // tabs.length === 0 arm
    expect(tm.tabs).toHaveLength(0);
  });

  test('closeTab non-active earlier tab shifts activeIndex and re-activates', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    tm.newTab('https://b.example');
    tm.newTab('https://c.example');
    tm.setActive(2);
    tm.closeTab(0); // index <= activeIndex → decrement + re-activate
    expect(tm.activeIndex).toBe(1);
    expect(tm.getActiveTab()).toBe(tm.tabs[1]);
  });

  test('setActive out-of-bounds is a no-op', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    const before = tm.activeIndex;
    tm.setActive(-1);
    tm.setActive(99);
    expect(tm.activeIndex).toBe(before);
  });

  test('serialize skips url-less panels and clamps active past the end', () => {
    const tm = makeManager();
    tm.newTab('');               // no currentUrl → skipped in tabs[]
    tm.newTab('https://b.example');
    tm.setActive(1);             // active panel index 1, but only 1 serialized tab
    const s = tm.serialize();
    expect(s.tabs).toEqual([{ url: 'https://b.example' }]);
    expect(s.active).toBe(0);    // clamped min(active, len-1)
  });

  test('setCurved / setSearchEngine / setReaderProxyUrl tolerate panels without the method', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    // Strip the methods the real WebPanel provides — guards must skip them.
    const p = tm.tabs[0];
    delete p.setCurved; delete p.setSearchEngine; delete p.setReaderProxyUrl;
    expect(() => {
      tm.setCurved(true);
      tm.setSearchEngine('bing');
      tm.setReaderProxyUrl('https://proxy');
    }).not.toThrow();
    expect(tm.opts.searchEngine).toBe('bing');
    // non-string url → ''
    tm.setReaderProxyUrl(null);
    expect(tm.opts.readerProxyUrl).toBe('');
  });

  test('dispose traverse skips children lacking geometry/material', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    // Bare object in the strip group exercises both missing-member arms.
    tm.stripGroup.add({});
    expect(() => tm.dispose()).not.toThrow();
    expect(tm.stripMesh).toBeNull();
  });
});

describe('TabManager — last branch arms', () => {
  test('closeTab without onTabClose callback does not throw', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    tm.newTab('https://b.example');
    expect(() => tm.closeTab(0)).not.toThrow();
    expect(tm.tabs).toHaveLength(1);
  });

  test('setActive without onTabActivate callback does not throw', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    tm.newTab('https://b.example');
    expect(() => tm.setActive(0)).not.toThrow();
  });

  test('serialize with zero tabs clamps active to 0', () => {
    const tm = makeManager();
    const json = tm.serialize();
    expect(json.active).toBe(0);
    expect(json.tabs).toEqual([]);
  });

  test('dispose traverse skips material without .map', () => {
    const tm = makeManager();
    tm.stripGroup.traverse = (fn) => fn({ material: { dispose: jest.fn() } });
    expect(() => tm.dispose()).not.toThrow();
  });
});

describe('TabManager — complementary arms', () => {
  beforeEach(() => { panelInstances.length = 0; });

  test('closing a tab before the active index shifts activeIndex left', () => {
    const tm = makeManager();
    tm.newTab();
    tm.newTab();
    tm.setActive(1);
    tm.closeTab(0);
    expect(tm.activeIndex).toBe(0);
  });

  test('onTabClose callback fires on close', () => {
    const tm = makeManager();
    const onTabClose = jest.fn();
    tm.opts.onTabClose = onTabClose;
    tm.newTab();
    tm.closeTab(0);
    expect(onTabClose).toHaveBeenCalled();
  });

  test('onTabActivate receives the activated tab url', () => {
    const tm = makeManager();
    const onTabActivate = jest.fn();
    tm.opts.onTabActivate = onTabActivate;
    tm.newTab();
    tm.tabs[0].currentUrl = 'https://x.example';
    tm.newTab();
    tm.setActive(0);
    expect(onTabActivate).toHaveBeenCalledWith('https://x.example');
  });

  test('setCurved/setSearchEngine/setReaderProxyUrl propagate to panels that implement them', () => {
    const tm = makeManager();
    tm.newTab();
    const panel = tm.tabs[0];
    panel.setCurved = jest.fn();
    panel.setSearchEngine = jest.fn();
    panel.setReaderProxyUrl = jest.fn();
    tm.setCurved?.(true);
    tm.setSearchEngine('duckduckgo');
    tm.setReaderProxyUrl?.('https://proxy');
    if (tm.setCurved) expect(panel.setCurved).toHaveBeenCalled();
    expect(panel.setSearchEngine).toHaveBeenCalledWith('duckduckgo');
  });

  test('dispose traverses strip children and frees geometry/material/map', () => {
    const tm = makeManager();
    tm.newTab();
    const map = { dispose: jest.fn() };
    const mat = { dispose: jest.fn(), map };
    const geo = { dispose: jest.fn() };
    tm.stripGroup.traverse = (cb) => cb({ geometry: geo, material: mat });
    tm.scene = { remove: jest.fn() };
    expect(() => tm.dispose()).not.toThrow();
    expect(geo.dispose).toHaveBeenCalled();
    expect(map.dispose).toHaveBeenCalled();
    expect(mat.dispose).toHaveBeenCalled();
  });
});

describe('TabManager — sliver arms', () => {
  test('closeTab before activeIndex shifts it down; closing active resets it', () => {
    const tm = makeManager();
    tm.tabs = [{ dispose() {}, setVisible() {} }, { dispose() {}, setVisible() {} }, { dispose() {}, setVisible() {} }];
    tm.activeIndex = 2;
    tm.closeTab(0);                  // earlier tab → decrement
    expect(tm.activeIndex).toBe(1);
    tm.closeTab(1);                  // closes the active slot → clamps to 0
    expect(tm.activeIndex).toBe(0);
  });

  test('setCurved/setSearchEngine/setReaderProxyUrl skip panels lacking the method', () => {
    const tm = makeManager({ readerProxyUrl: 'https://proxy.example' });
    tm.tabs = [{}, { setCurved: jest.fn(), setSearchEngine: jest.fn(), setReaderProxyUrl: jest.fn() }];
    expect(() => {
      tm.setCurved(true);
      tm.setSearchEngine('duckduckgo');
      tm.setReaderProxyUrl();
    }).not.toThrow();
    expect(tm.tabs[1].setCurved).toHaveBeenCalledWith(true);
    expect(tm.tabs[1].setSearchEngine).toHaveBeenCalledWith('duckduckgo');
  });
});
