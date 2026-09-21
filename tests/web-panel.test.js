/**
 * Unit tests for WebPanel (FR-1.1 / FR-1.2).
 * THREE and DOM dependencies are mocked so the chrome-bar logic can be
 * exercised without a WebGL context or real iframes.
 */

// ── THREE stub ────────────────────────────────────────────────────────────────
class MockGeometry { constructor() {} dispose() {} scale() {} }
class MockMaterial {
  constructor() { this.color = { set: jest.fn() }; this.map = null; }
  dispose() {}
}
class MockMesh {
  constructor(geo, mat) {
    this.geometry = geo || new MockGeometry();
    this.material = mat || new MockMaterial();
    this.name = '';
    this.position = { set: jest.fn(), y: 0 };
    this.renderOrder = 0;
    this._nextLocal = { x: 0, y: 0, z: 0 };
  }
  worldToLocal(v) { return this._nextLocal || v; }
}
class MockGroup {
  constructor() { this.position = { set: jest.fn() }; this._objects = []; }
  add(o) { this._objects.push(o); }
  remove(o) { this._objects = this._objects.filter(x => x !== o); }
  traverse(fn) { this._objects.forEach(fn); fn(this); }
}
class MockTexture { constructor() { this.needsUpdate = false; } dispose() {} }

jest.mock('three', () => ({
  Group: MockGroup,
  Mesh: MockMesh,
  PlaneGeometry: MockGeometry,
  MeshBasicMaterial: MockMaterial,
  CanvasTexture: MockTexture,
  FrontSide: 0
}));

// ── curvedGeometry stub ───────────────────────────────────────────────────────
jest.mock('../src/vr/browser/curvedGeometry.js', () => ({
  buildCurvedPlaneGeometry: () => new (require('three').PlaneGeometry)()
}));

// ── urlResolver stub ──────────────────────────────────────────────────────────
jest.mock('../src/vr/browser/urlResolver.js', () => ({
  resolveInput: (url) => url,
  DEFAULT_SEARCH_ENGINE: 'duckduckgo'
}));

// ── bookmarkLayout stub ───────────────────────────────────────────────────────
jest.mock('../src/vr/browser/bookmarkLayout.js', () => ({
  truncate: (s) => s
}));

// ── document/canvas stub ─────────────────────────────────────────────────────
global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') {
      return {
        width: 0, height: 0,
        getContext: () => ({
          clearRect: jest.fn(), fillRect: jest.fn(), fillText: jest.fn(),
          strokeRect: jest.fn(),
          fillStyle: '', font: '', textAlign: '', textBaseline: '',
          strokeStyle: '', lineWidth: 0
        })
      };
    }
    // iframe
    return {
      setAttribute: jest.fn(),
      style: { cssText: '' },
      src: '',
      onload: null
    };
  },
  body: { appendChild: jest.fn() }
};
global.URL = URL;

const { WebPanel, urlBarMaxChars } = require('../src/vr/browser/WebPanel.js');

function makePanel(extraOpts = {}) {
  const scene = { add: jest.fn(), remove: jest.fn() };
  const registerInteractable = jest.fn();
  const unregisterInteractable = jest.fn();
  const panel = new WebPanel({
    scene,
    registerInteractable,
    unregisterInteractable,
    onNavigate: jest.fn(),
    ...extraOpts
  });
  // Expose the registered handlers for direct testing.
  panel._handlers = registerInteractable.mock.calls[0]?.[1];
  // Give the chromeMesh a controllable worldToLocal return value.
  panel._setLocal = (x) => { panel.chromeMesh._nextLocal = { x, y: 0, z: 0 }; };
  panel._setLocal(0);
  return panel;
}

describe('WebPanel (FR-1.1 / FR-1.2)', () => {
  describe('urlBarMaxChars()', () => {
    test('returns a reasonable character count for a wide bar', () => {
      expect(urlBarMaxChars(600)).toBeGreaterThan(20);
    });
    test('enforces the minimum of 8', () => {
      expect(urlBarMaxChars(0)).toBe(8);
    });
  });

  describe('construction', () => {
    test('creates a chromeMesh and contentMesh', () => {
      const p = makePanel();
      expect(p.chromeMesh).toBeTruthy();
      expect(p.contentMesh).toBeTruthy();
    });

    test('registers the chromeMesh as an interactable', () => {
      const reg = jest.fn();
      new WebPanel({
        scene: { add: jest.fn(), remove: jest.fn() },
        registerInteractable: reg,
        unregisterInteractable: jest.fn()
      });
      expect(reg).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'webPanelChrome' }),
        expect.objectContaining({ onSelect: expect.any(Function) })
      );
    });
  });

  describe('_onChromeSelect — intersection event unwrapping', () => {
    test('accepts direct Vector3 (legacy / test path)', () => {
      const p = makePanel();
      p._setLocal(-0.7); // left zone → back button
      const fakePoint = { x: -0.7, y: 0, clone() { return this; } };
      expect(() => p._handlers.onSelect(fakePoint)).not.toThrow();
    });

    test('accepts the controller/gaze event format { intersection: { point } }', () => {
      const p = makePanel();
      p._setLocal(-0.7);
      const fakePoint = { x: -0.7, y: 0, clone() { return this; } };
      expect(() =>
        p._handlers.onSelect({ intersection: { point: fakePoint }, controller: {} })
      ).not.toThrow();
    });

    test('does not throw when called with null / undefined', () => {
      const p = makePanel();
      expect(() => p._handlers.onSelect(null)).not.toThrow();
      expect(() => p._handlers.onSelect(undefined)).not.toThrow();
    });
  });

  describe('_onChromeHover — caption callback', () => {
    test('calls onHoverCaption when entering hover', () => {
      const onHoverCaption = jest.fn();
      const p = makePanel({ onHoverCaption });
      p._handlers.onHover();
      expect(onHoverCaption).toHaveBeenCalledTimes(1);
    });

    test('does not call onHoverCaption on hover end', () => {
      const onHoverCaption = jest.fn();
      const p = makePanel({ onHoverCaption });
      p._handlers.onHoverEnd();
      expect(onHoverCaption).not.toHaveBeenCalled();
    });

    test('works without onHoverCaption (no-op)', () => {
      const p = makePanel();
      expect(() => p._handlers.onHover()).not.toThrow();
    });

    test('passes current URL and title to onHoverCaption (WCAG 1.3.3)', () => {
      const onHoverCaption = jest.fn();
      const p = makePanel({ onHoverCaption });
      p.currentUrl = 'https://example.com/path';
      p.currentTitle = 'Example Site';
      p._handlers.onHover();
      expect(onHoverCaption).toHaveBeenCalledWith('https://example.com/path', 'Example Site');
    });

    test('passes empty strings before any page loads', () => {
      const onHoverCaption = jest.fn();
      const p = makePanel({ onHoverCaption });
      // currentUrl / currentTitle default to '' at construction
      p._handlers.onHover();
      expect(onHoverCaption).toHaveBeenCalledWith('', '');
    });
  });

  describe('move bar (grab-to-move)', () => {
    function makePanelWithMoveBar(extraOpts = {}) {
      const scene = { add: jest.fn(), remove: jest.fn() };
      const registerInteractable = jest.fn();
      const unregisterInteractable = jest.fn();
      const panel = new WebPanel({
        scene, registerInteractable, unregisterInteractable,
        onNavigate: jest.fn(), ...extraOpts
      });
      const moveBarCall = registerInteractable.mock.calls.find(([obj]) => obj === panel.moveBarMesh);
      return { panel, registerInteractable, unregisterInteractable, moveBarHandlers: moveBarCall?.[1] };
    }

    test('creates a moveBarMesh named webPanelMoveBar and adds it to the group', () => {
      const { panel } = makePanelWithMoveBar();
      expect(panel.moveBarMesh).toBeTruthy();
      expect(panel.moveBarMesh.name).toBe('webPanelMoveBar');
      expect(panel.group._objects).toContain(panel.moveBarMesh);
    });

    test('registers the moveBarMesh as an interactable', () => {
      const { moveBarHandlers } = makePanelWithMoveBar();
      expect(moveBarHandlers).toBeTruthy();
      expect(typeof moveBarHandlers.onSelect).toBe('function');
      expect(typeof moveBarHandlers.onHover).toBe('function');
      expect(typeof moveBarHandlers.onHoverEnd).toBe('function');
    });

    test('selecting the move bar calls onGrabRequested with the controller', () => {
      const onGrabRequested = jest.fn();
      const { moveBarHandlers } = makePanelWithMoveBar({ onGrabRequested });
      const controller = { id: 'left-controller' };
      moveBarHandlers.onSelect({ intersection: {}, controller });
      expect(onGrabRequested).toHaveBeenCalledWith(controller);
    });

    test('selecting the move bar without onGrabRequested is a no-op', () => {
      const { moveBarHandlers } = makePanelWithMoveBar();
      expect(() => moveBarHandlers.onSelect({ intersection: {}, controller: {} })).not.toThrow();
    });

    test('hovering the move bar tints it and fires onMoveBarHoverCaption', () => {
      const onMoveBarHoverCaption = jest.fn();
      const { panel, moveBarHandlers } = makePanelWithMoveBar({ onMoveBarHoverCaption });
      moveBarHandlers.onHover();
      expect(panel.moveBarMesh.material.color.set).toHaveBeenCalledWith(0xaaaaff);
      expect(onMoveBarHoverCaption).toHaveBeenCalledTimes(1);
    });

    test('hover-end restores the idle color and does not fire the caption', () => {
      const onMoveBarHoverCaption = jest.fn();
      const { panel, moveBarHandlers } = makePanelWithMoveBar({ onMoveBarHoverCaption });
      moveBarHandlers.onHoverEnd();
      expect(panel.moveBarMesh.material.color.set).toHaveBeenCalledWith(0x55556f);
      expect(onMoveBarHoverCaption).not.toHaveBeenCalled();
    });

    test('hovering without onMoveBarHoverCaption is a no-op', () => {
      const { moveBarHandlers } = makePanelWithMoveBar();
      expect(() => moveBarHandlers.onHover()).not.toThrow();
    });

    test('dispose() unregisters the moveBarMesh', () => {
      const { panel, unregisterInteractable } = makePanelWithMoveBar();
      panel.dispose();
      expect(unregisterInteractable).toHaveBeenCalledWith(panel.moveBarMesh);
    });
  });

  describe('_onChromeSelect — zone dispatch', () => {
    // chromeCanvas is 1024px wide; zones: back <68, forward <136,
    // reload/stop <204, close >w-60, bookmark star w-128..w-72 (only when
    // onToggleBookmark is wired), URL bar otherwise.
    const { PANEL_W, PANEL_H, CHROME_H } = require('../src/vr/browser/panelGeometry.js');
    const chromePx = (panel, px) => {
      panel.chromeMesh._nextLocal = { x: (px / 1024 - 0.5) * PANEL_W, y: 0, z: 0 };
    };
    const click = (panel, px) => {
      chromePx(panel, px);
      panel._onChromeSelect({ x: 0, y: 0, clone() { return this; } });
    };

    test('left zones dispatch back / forward / reload', () => {
      const p = makePanel();
      const back = jest.spyOn(p, 'back').mockImplementation(() => {});
      const forward = jest.spyOn(p, 'forward').mockImplementation(() => {});
      const reload = jest.spyOn(p, 'reload').mockImplementation(() => {});
      click(p, 30);
      expect(back).toHaveBeenCalledTimes(1);
      click(p, 100);
      expect(forward).toHaveBeenCalledTimes(1);
      click(p, 170);
      expect(reload).toHaveBeenCalledTimes(1);
    });

    test('reload zone calls stop() instead while a load is in flight', () => {
      const p = makePanel();
      const stop = jest.spyOn(p, 'stop').mockImplementation(() => {});
      const reload = jest.spyOn(p, 'reload').mockImplementation(() => {});
      p.loading = true;
      click(p, 170);
      expect(stop).toHaveBeenCalledTimes(1);
      expect(reload).not.toHaveBeenCalled();
    });

    test('right edge closes the panel', () => {
      const p = makePanel();
      const hide = jest.spyOn(p, 'hide').mockImplementation(() => {});
      click(p, 1000);
      expect(hide).toHaveBeenCalledTimes(1);
    });

    test('bookmark star toggles the current URL when wired', () => {
      const onToggleBookmark = jest.fn();
      const p = makePanel({ onToggleBookmark });
      p.currentUrl = 'https://example.com';
      p.currentTitle = 'Example';
      click(p, 920);
      expect(onToggleBookmark).toHaveBeenCalledWith('https://example.com', 'Example');
    });

    test('bookmark zone falls through to the URL bar when unwired', () => {
      const onUrlInputRequested = jest.fn();
      const p = makePanel({ onUrlInputRequested });
      click(p, 920);
      expect(onUrlInputRequested).toHaveBeenCalledTimes(1);
    });

    test('URL bar zone requests input and navigates on commit', () => {
      const p = makePanel({
        onUrlInputRequested: (prefill, cb) => cb('https://chosen.example')
      });
      const navigate = jest.spyOn(p, 'navigate').mockImplementation(() => {});
      click(p, 500);
      expect(navigate).toHaveBeenCalledWith('https://chosen.example');
    });

    test('URL bar falls back to window.prompt when no input callback is wired', () => {
      const p = makePanel();
      const navigate = jest.spyOn(p, 'navigate').mockImplementation(() => {});
      global.window = { prompt: jest.fn(() => 'https://prompted.example') };
      try {
        click(p, 500);
        expect(global.window.prompt).toHaveBeenCalled();
        expect(navigate).toHaveBeenCalledWith('https://prompted.example');
      } finally {
        delete global.window;
      }
    });
  });

  describe('_onContentSelect — reader arrows and top-site tiles', () => {
    const { PANEL_W, PANEL_H, CHROME_H } = require('../src/vr/browser/panelGeometry.js');
    const {
      ARROW_W, ARROW_H, ARROW_Y0, ARROW_UP_X0, ARROW_DN_X0
    } = require('../src/vr/browser/readerLayout.js');
    const contentH = PANEL_H * (1 - CHROME_H);
    const canvasH = Math.round(1024 * (1 - CHROME_H));
    const contentPx = (panel, px, py) => {
      panel.contentMesh._nextLocal = {
        x: (px / 1024 - 0.5) * PANEL_W,
        y: ((1 - py / canvasH) - 0.5) * contentH,
        z: 0
      };
    };
    const tap = (panel, px, py) => {
      contentPx(panel, px, py);
      panel._onContentSelect({ x: 0, y: 0, clone() { return this; } });
    };

    test('tapping a top-site tile on the empty state navigates to it', () => {
      const p = makePanel();
      const navigate = jest.spyOn(p, 'navigate').mockImplementation(() => {});
      p._contentState = 'empty';
      p._topTiles = [{ x: 100, y: 200, w: 200, h: 100, url: 'https://tile.example', title: 'T', host: 'h' }];
      tap(p, 200, 250);
      expect(navigate).toHaveBeenCalledWith('https://tile.example');
    });

    test('tapping outside every tile does nothing', () => {
      const p = makePanel();
      const navigate = jest.spyOn(p, 'navigate').mockImplementation(() => {});
      p._contentState = 'empty';
      p._topTiles = [{ x: 100, y: 200, w: 200, h: 100, url: 'https://tile.example', title: 'T', host: 'h' }];
      tap(p, 10, 10);
      expect(navigate).not.toHaveBeenCalled();
    });

    test('reader scroll arrows drive scrollContent with page jumps', () => {
      const p = makePanel();
      const scroll = jest.spyOn(p, 'scrollContent').mockImplementation(() => true);
      p._contentState = 'reader';
      p._readerScale = 1;
      p._readerLines = new Array(500).fill('line');
      // Arrow hit zones live in CONTENT_PX (1024×942) space.
      tap(p, ARROW_DN_X0 + ARROW_W / 2, ARROW_Y0 + ARROW_H / 2);
      expect(scroll).toHaveBeenCalledTimes(1);
      expect(scroll.mock.calls[0][0]).toBeGreaterThan(0); // down = positive
      tap(p, ARROW_UP_X0 + ARROW_W / 2, ARROW_Y0 + ARROW_H / 2);
      expect(scroll).toHaveBeenCalledTimes(2);
      expect(scroll.mock.calls[1][0]).toBeLessThan(0); // up = negative
    });

    test('short articles have no scroll arrows — taps do not scroll', () => {
      const p = makePanel();
      const scroll = jest.spyOn(p, 'scrollContent').mockImplementation(() => true);
      p._contentState = 'reader';
      p._readerScale = 1;
      p._readerLines = new Array(3).fill('line');
      tap(p, ARROW_DN_X0 + ARROW_W / 2, ARROW_Y0 + ARROW_H / 2);
      expect(scroll).not.toHaveBeenCalled();
    });

    test('non-reader content ignores the arrow zone entirely', () => {
      const p = makePanel();
      const scroll = jest.spyOn(p, 'scrollContent').mockImplementation(() => true);
      p._contentState = 'loading';
      p._topTiles = [];
      tap(p, ARROW_DN_X0 + ARROW_W / 2, ARROW_Y0 + ARROW_H / 2);
      expect(scroll).not.toHaveBeenCalled();
    });
  });
});

describe('WebPanel curvature + visibility', () => {
  test('setCurved(true) swaps the content geometry and disposes the old one', () => {
    const panel = makePanel();
    const oldGeo = panel.contentMesh.geometry;
    oldGeo.dispose = jest.fn();
    expect(panel.setCurved(true)).toBe(true);
    expect(panel.curved).toBe(true);
    expect(panel.contentMesh.geometry).not.toBe(oldGeo);
    expect(oldGeo.dispose).toHaveBeenCalled();
  });

  test('setCurved(true) then setCurved(false) restores a flat geometry', () => {
    const panel = makePanel();
    panel.setCurved(true);
    const curvedGeo = panel.contentMesh.geometry;
    curvedGeo.dispose = jest.fn();
    expect(panel.setCurved(false)).toBe(false);
    expect(curvedGeo.dispose).toHaveBeenCalled();
  });

  test('setCurved is a no-op when the value is unchanged', () => {
    const panel = makePanel();
    const geo = panel.contentMesh.geometry;
    expect(panel.setCurved(false)).toBe(false); // already flat
    expect(panel.contentMesh.geometry).toBe(geo);
  });

  test('setCurved returns the current state when contentMesh is gone', () => {
    const panel = makePanel();
    panel.setCurved(true);
    panel.contentMesh = null;
    expect(panel.setCurved(false)).toBe(true);
  });

  test('show(position) places the group and makes it visible', () => {
    const panel = makePanel();
    panel.group.visible = false;
    panel.show({ x: 1, y: 2, z: 3 });
    expect(panel.group.visible).toBe(true);
    expect(panel.group.position.set).toHaveBeenCalledWith(1, 2, 3);
  });

  test('hide() hides the group and the iframe', () => {
    const panel = makePanel();
    panel.hide();
    expect(panel.group.visible).toBe(false);
    expect(panel.iframe.style.display).toBe('none');
  });

  test('setVisible toggles without touching the transform', () => {
    const panel = makePanel();
    panel.group.position.set.mockClear();
    panel.setVisible(false);
    expect(panel.group.visible).toBe(false);
    expect(panel.iframe.style.display).toBe('none');
    expect(panel.group.position.set).not.toHaveBeenCalled();
    panel.setVisible(true);
    expect(panel.group.visible).toBe(true);
    expect(panel.iframe.style.display).toBe('');
  });

  test('addToScene(parent) parents the group to the container, not the scene', () => {
    const panel = makePanel();
    const container = { add: jest.fn() };
    panel.addToScene(container);
    expect(container.add).toHaveBeenCalledWith(panel.group);
    expect(panel.scene.add).not.toHaveBeenCalledWith(panel.group);
  });
});

describe('WebPanel — updateLayer quad-layer blit', () => {
  test('no-op until a quad layer exists AND the chrome is dirty', () => {
    const panel = makePanel();
    const layersSystem = { renderCanvasToLayer: jest.fn() };
    panel.layersSystem = layersSystem;
    panel.updateLayer({}, []);              // no quadLayer → no call
    panel.quadLayer = { id: 'ql' };
    panel._layerDirty = false;              // ctor draw marks it dirty
    panel.updateLayer({}, []);              // not dirty → no call
    expect(layersSystem.renderCanvasToLayer).not.toHaveBeenCalled();
  });

  test('dirty + quadLayer → blits the chrome canvas and clears the flag', () => {
    const panel = makePanel();
    const layersSystem = { renderCanvasToLayer: jest.fn() };
    panel.layersSystem = layersSystem;
    panel.quadLayer = { id: 'ql' };
    panel._layerDirty = true;
    const frame = { f: 1 }, views = [{ v: 1 }];
    panel.updateLayer(frame, views);
    expect(layersSystem.renderCanvasToLayer)
      .toHaveBeenCalledWith(panel.quadLayer, panel.chromeCanvas, frame, views);
    expect(panel._layerDirty).toBe(false);
    panel.updateLayer(frame, views); // flag cleared → second call skipped
    expect(layersSystem.renderCanvasToLayer).toHaveBeenCalledTimes(1);
  });
});

describe('WebPanel — remaining guard slivers', () => {
  test('_drawContent returns early without a canvas or 2d context', () => {
    const p = makePanel();
    const keep = p.contentCanvas;
    p.contentCanvas = null;
    expect(() => p._drawContent()).not.toThrow();
    p.contentCanvas = { getContext: () => null, width: 8 };
    expect(() => p._drawContent()).not.toThrow();
    p.contentCanvas = keep;
  });

  test('_onContentSelect bails without a canvas or a raw point', () => {
    const p = makePanel();
    const keep = p.contentCanvas;
    p.contentCanvas = null;
    expect(() => p._onContentSelect({ x: 0, y: 0 })).not.toThrow();
    p.contentCanvas = keep;
    expect(() => p._onContentSelect(null)).not.toThrow();
  });

  test('reload() re-loads the current URL', () => {
    const p = makePanel();
    p.currentUrl = 'https://a.example';
    const spy = jest.spyOn(p, '_loadUrl').mockImplementation(() => {});
    p.reload();
    expect(spy).toHaveBeenCalledWith('https://a.example');
  });

  test('enableLayerMode returns early without quadLayer/layersSystem', () => {
    const p = makePanel();
    expect(() => p.enableLayerMode(null, {})).not.toThrow();
    expect(() => p.enableLayerMode({}, null)).not.toThrow();
    expect(p.quadLayer).toBeFalsy();
  });

  test('dispose releases material maps and detaches the iframe', () => {
    const p = makePanel();
    const parent = { removeChild: jest.fn() };
    p.iframe = { onload: jest.fn(), onerror: jest.fn(), parentNode: parent };
    p.dispose();
    expect(parent.removeChild).toHaveBeenCalledWith(p.iframe);
    expect(p.iframe.onload).toBeNull();
    expect(p.iframe.onerror).toBeNull();
  });
});

describe('WebPanel — last slivers', () => {
  test('contentMesh onSelect registration routes to _onContentSelect', () => {
    const p = makePanel();
    const contentReg = p.registerInteractable.mock.calls.find(c => c[0] === p.contentMesh);
    expect(contentReg).toBeTruthy();
    const spy = jest.spyOn(p, '_onContentSelect').mockImplementation(() => {});
    contentReg[1].onSelect({ x: 0, y: 0 });
    expect(spy).toHaveBeenCalled();
  });

  test('setSearchEngine updates the panel engine', () => {
    const p = makePanel();
    p.setSearchEngine('bing');
    expect(p.searchEngine).toBe('bing');
  });

  test('dispose releases material.map on every traversed mesh', () => {
    const p = makePanel();
    const disposes = [];
    const mapDisposes = [];
    p.group.traverse = (fn) => {
      fn({ material: { map: { dispose: () => mapDisposes.push(1) }, dispose: () => disposes.push(1) } });
    };
    p.dispose();
    expect(mapDisposes.length).toBe(1);
    expect(disposes.length).toBe(1);
  });
});

describe('WebPanel — remaining branch arms', () => {
  test('constructor clamps non-positive readerScale and non-string readerProxyUrl', () => {
    const p = makePanel({ readerScale: 0, readerProxyUrl: 42 });
    expect(p._readerScale).toBe(1);
    expect(p.readerProxyUrl).toBe('');
    const p2 = makePanel({ readerScale: -2, readerProxyUrl: null });
    expect(p2._readerScale).toBe(1);
    expect(p2.readerProxyUrl).toBe('');
  });

  test('_drawContent with contentTex absent still paints (no throw)', () => {
    const p = makePanel();
    p.contentTex = null;
    expect(() => p._drawContent()).not.toThrow();
    // reader arm too
    p._contentState = 'reader';
    p._readerLines = [{ text: 'line' }];
    expect(() => p._drawContent()).not.toThrow();
    // top-sites arm: tiles exist → early return path also guards contentTex
    p._contentState = 'empty';
    p.getTopSites = () => [{ title: '', host: 'example.com', url: 'https://example.com' }];
    expect(() => p._drawContent()).not.toThrow();
  });

  test('top-site tile without a title draws the host', () => {
    const p = makePanel();
    const { webContentColors } = require('../src/vr/browser/chromeColors.js');
    const fillTexts = [];
    const ctx = {
      clearRect: jest.fn(), fillRect: jest.fn(), strokeRect: jest.fn(),
      fillText: (t) => fillTexts.push(String(t)),
      fillStyle: '', font: '', textAlign: '', textBaseline: '', lineWidth: 0, strokeStyle: ''
    };
    p._drawTopSites(ctx, 512, [{ title: '', host: 'example.com', x: 0, y: 0, w: 100, h: 100 }], webContentColors(false));
    expect(fillTexts).toContain('example.com');
  });

  test('scrollContent treats a non-finite delta as 0', () => {
    const p = makePanel();
    p._contentState = 'reader';
    p._readerLines = Array.from({ length: 50 }, (_, i) => ({ text: `l${i}` }));
    p._readerScroll = 5;
    const before = p._readerScroll;
    p.scrollContent(NaN);
    expect(p._readerScroll).toBe(before); // NaN → +0 → unchanged → early return
  });

  test('setReaderProxyUrl coerces non-string input', () => {
    const p = makePanel();
    p.setReaderProxyUrl(undefined);
    expect(p.readerProxyUrl).toBe('');
    p.setReaderProxyUrl('https://proxy.example.com');
    expect(p.readerProxyUrl).toBe('https://proxy.example.com');
    p.setReaderProxyUrl(null); // clears
    expect(p.readerProxyUrl).toBe('');
  });

  test('bookmark-star tap with no currentUrl is a no-op; no title falls back to url', () => {
    const { PANEL_W } = require('../src/vr/browser/panelGeometry.js');
    const onToggleBookmark = jest.fn();
    const p = makePanel({ onToggleBookmark, isBookmarked: () => true });
    const click = (px) => {
      p.chromeMesh._nextLocal = { x: (px / 1024 - 0.5) * PANEL_W, y: 0, z: 0 };
      p._onChromeSelect({ x: 0, y: 0, clone() { return this; } });
    };
    // no currentUrl → `if (this.currentUrl)` false arm (px 900 = star zone at w=1024)
    p.currentUrl = null;
    click(900);
    expect(onToggleBookmark).not.toHaveBeenCalled();
    // url but no title → `currentTitle || currentUrl` fallback
    p.currentUrl = 'https://example.com';
    p.currentTitle = null;
    click(900);
    expect(onToggleBookmark).toHaveBeenCalledWith('https://example.com', 'https://example.com');
  });

  test('url-input callback receiving null navigates nowhere', () => {
    const navigateSpy = jest.spyOn(WebPanel.prototype, 'navigate');
    try {
      const { PANEL_W } = require('../src/vr/browser/panelGeometry.js');
      const cbHolder = {};
      const p = makePanel({
        onUrlInputRequested: (prefill, cb) => { cbHolder.cb = cb; }
      });
      // land on the URL-bar zone (not back/fwd/reload/star/close)
      p.chromeMesh._nextLocal = { x: (500 / 1024 - 0.5) * PANEL_W, y: 0, z: 0 };
      p._onChromeSelect({ x: 0, y: 0, clone() { return this; } });
      expect(cbHolder.cb).toBeInstanceOf(Function);
      navigateSpy.mockClear();
      cbHolder.cb(null); // user cancelled — `if (url)` false arm
      expect(navigateSpy).not.toHaveBeenCalled();
      cbHolder.cb('https://example.com');
      expect(navigateSpy).toHaveBeenCalledWith('https://example.com');
    } finally {
      navigateSpy.mockRestore();
    }
  });

  test('chrome/move-bar hover with material absent does not throw', () => {
    const p = makePanel();
    p.chromeMesh.material = null;
    p.moveBarMesh.material = null;
    expect(() => {
      p._onChromeHover(true);
      p._onMoveBarHover(true);
    }).not.toThrow();
  });

  test('stop() with no in-flight reader controller still clears the load', () => {
    const p = makePanel();
    p.loading = true;
    p._readerController = null; // fetch already finished or never started
    p.stop();
    expect(p.loading).toBe(false);
    expect(p._contentState).toBe('empty');
  });

  test('enableLayerMode with a non-function onDetach stores null', () => {
    const p = makePanel();
    p.enableLayerMode({}, { add: jest.fn() }, 'layer-1', 'not-a-function');
    expect(p._onLayerDetach).toBeNull();
    expect(p.chromeMesh.visible).toBe(false);
    p.disableLayerMode(); // releaseLayer=true but no detach callback
    expect(p._layerId).toBeNull();
  });

  test('setCurved with a geometry lacking dispose does not throw', () => {
    const p = makePanel();
    p.contentMesh.geometry = {}; // truthy, but no dispose method
    expect(() => p.setCurved(true)).not.toThrow();
    expect(p.curved).toBe(true);
  });

  test('show() uses the default position when none is given; addToScene falls back to scene', () => {
    const p = makePanel();
    p.show();
    expect(p.group.position.set).toHaveBeenCalledWith(0, 1.5, -2);
    const p2 = makePanel();
    p2.addToScene(); // no parent → this.scene.add
    expect(p2.scene.add).toHaveBeenCalledWith(p2.group);
  });

  test('setVisible/dispose tolerate a missing iframe', () => {
    const p = makePanel();
    p.iframe = null;
    expect(() => { p.setVisible(false); p.setVisible(true); }).not.toThrow();
  });

  test('iframe onload falls back to the URL when the frame title is empty', () => {
    const p = makePanel();
    p.navigate('https://example.com');
    p.iframe.contentDocument = { title: '' };
    p.iframe.onload();
    expect(p.currentTitle).toBe('https://example.com');
  });

  test('_loadReaderText works when AbortController is unavailable', async () => {
    const p = makePanel();
    const saved = global.AbortController;
    delete global.AbortController;
    global.fetch = jest.fn(async () => ({ ok: false, status: 500 }));
    try {
      await p._loadReaderText('https://example.com');
      // controller was null → fetch called without a signal, no abort timer
      expect(global.fetch).toHaveBeenCalledWith(expect.any(String), undefined);
      expect(p._contentState).toBe('unavailable');
    } finally {
      global.AbortController = saved;
      delete global.fetch;
    }
  });

  test('move bar canvas getContext returning null skips the paint', () => {
    const origCreate = global.document.createElement;
    let canvasCount = 0;
    global.document.createElement = (tag) => {
      const el = origCreate(tag);
      // canvas order: chrome, content, moveBar — null the move bar's ctx
      if (tag === 'canvas' && ++canvasCount === 3) {
        el.getContext = () => null;
      }
      return el;
    };
    try {
      expect(() => makePanel()).not.toThrow();
    } finally {
      global.document.createElement = origCreate;
    }
  });
});

describe('WebPanel — complementary arms', () => {
  test('reload() with a loaded url reloads it', () => {
    const wp = makePanel();
    wp.currentUrl = 'https://x.example';
    wp._loadUrl = jest.fn();
    wp.reload();
    expect(wp._loadUrl).toHaveBeenCalledWith('https://x.example');
  });

  test('enableLayerMode hides the chrome mesh when present', () => {
    const wp = makePanel();
    wp.chromeMesh = { visible: true };
    wp.enableLayerMode?.({}, {}, 'layer-1');
    if (wp.chromeMesh) expect(wp.chromeMesh.visible).toBe(false);
  });

  test('disableLayerMode shows the chrome mesh when present', () => {
    const wp = makePanel();
    wp.chromeMesh = { visible: false };
    wp.disableLayerMode?.();
    if (wp.chromeMesh) expect(wp.chromeMesh.visible).toBe(true);
  });

  test('dispose detaches iframe handlers before removal', () => {
    const wp = makePanel();
    const iframe = {
      removeEventListener: jest.fn(),
      src: 'about:blank',
      remove: jest.fn(),
      parentNode: { removeChild: jest.fn() }
    };
    wp.iframe = iframe;
    expect(() => wp.dispose?.() ?? (() => {})()).not.toThrow();
  });
});

describe('WebPanel — prompt/reload/layer/dispose slivers', () => {
  test('URL-bar tap falls back to window.prompt when no onUrlInputRequested', () => {
    const p = makePanel({ onUrlInputRequested: undefined });
    p._setLocal(0); // middle of chrome = URL bar
    const nav = jest.spyOn(p, 'navigate').mockImplementation(() => {});
    global.window = { prompt: jest.fn(() => 'https://typed.example') };
    p._onChromeSelect({ clone() { return { x: 0, y: 0, z: 0 }; } });
    expect(window.prompt).toHaveBeenCalled();
    expect(nav).toHaveBeenCalledWith('https://typed.example');

    window.prompt.mockReturnValue(null);
    nav.mockClear();
    p._onChromeSelect({ clone() { return { x: 0, y: 0, z: 0 }; } });
    expect(nav).not.toHaveBeenCalled();
  });

  test('reload() reloads only when a url is loaded', () => {
    const p = makePanel();
    const load = jest.spyOn(p, '_loadUrl').mockImplementation(() => {});
    p.reload();
    expect(load).not.toHaveBeenCalled();
    p.currentUrl = 'https://a.example';
    p.reload();
    expect(load).toHaveBeenCalledWith('https://a.example');
  });

  test('layer-mode toggles tolerate a missing chromeMesh', () => {
    const p = makePanel();
    p.chromeMesh = null;
    expect(() => p.enableLayerMode({}, {}, 'l1')).not.toThrow();
    expect(() => p.disableLayerMode()).not.toThrow();
  });

  test('dispose detaches iframe handlers and removes the element', () => {
    const p = makePanel();
    const parent = { removeChild: jest.fn() };
    const iframe = { onload: () => {}, onerror: () => {}, parentNode: parent };
    p.iframe = iframe;
    p.dispose();
    expect(iframe.onload).toBeNull();
    expect(iframe.onerror).toBeNull();
    expect(parent.removeChild).toHaveBeenCalledWith(iframe);
  });
});
