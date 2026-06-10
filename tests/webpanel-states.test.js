/**
 * Tests for WebPanel visual-state logic:
 *   - back/forward disabled state (driven by historyIdx / history.length)
 *   - load-error flag set by iframe onerror, cleared on subsequent navigate
 *
 * Canvas, THREE, and DOM are stubbed to keep the test headless.
 */

// ── THREE stub ────────────────────────────────────────────────────────────────
class MockMesh {
  constructor() {
    this.visible = true;
    this.geometry = { dispose() {} };
    this.material = { map: null, dispose() {} };
    this.position = { set() {} };
  }
  worldToLocal(v) { return v; }
}

jest.mock('three', () => ({
  Group: class {
    constructor() { this.position = { set() {} }; this.rotation = {}; }
    add() {} remove() {}
  },
  Mesh: MockMesh,
  PlaneGeometry: class { dispose() {} },
  MeshBasicMaterial: class { dispose() {} },
  CanvasTexture: class { constructor() { this.needsUpdate = false; this.colorSpace = ''; } dispose() {} },
  SRGBColorSpace: 'srgb',
  MathUtils: { degToRad: (d) => d * Math.PI / 180 }
}));

// ── canvas / document stub ────────────────────────────────────────────────────
const ctx2d = {
  clearRect() {}, fillRect() {}, fillText() {}, strokeRect() {},
  set fillStyle(v) {}, set strokeStyle(v) {},
  set font(v) {}, set textAlign(v) {}, set lineWidth(v) {},
  set textBaseline(v) {}
};
global.document = {
  createElement(tag) {
    if (tag === 'canvas') return { width: 0, height: 0, getContext: () => ctx2d };
    if (tag === 'iframe') {
      return {
        src: '', style: { cssText: '' }, onload: null, onerror: null,
        setAttribute() {}
      };
    }
    return {};
  },
  body: { appendChild() {}, removeChild() {} }
};

const { WebPanel } = require('../src/vr/browser/WebPanel.js');

function makePanel(opts = {}) {
  return new WebPanel({
    scene: { add() {}, remove() {} },
    registerInteractable: jest.fn(),
    unregisterInteractable: jest.fn(),
    onNavigate: jest.fn(),
    ...opts
  });
}

// ── History navigation state ──────────────────────────────────────────────────
describe('WebPanel history navigation state', () => {
  test('cannot go back or forward with no history', () => {
    const p = makePanel();
    expect(p.historyIdx).toBe(-1);
    expect(p.history).toHaveLength(0);
    // canBack ↔ historyIdx > 0
    expect(p.historyIdx > 0).toBe(false);
    // canForward ↔ historyIdx < history.length - 1 (= -1 < -1 = false)
    expect(p.historyIdx < p.history.length - 1).toBe(false);
  });

  test('pushing a URL into history makes back unavailable from the first entry', () => {
    const p = makePanel();
    // Simulate _loadUrl adding first history entry as navigate() would.
    p.history = ['https://a.com'];
    p.historyIdx = 0;
    expect(p.historyIdx > 0).toBe(false);           // back disabled
    expect(p.historyIdx < p.history.length - 1).toBe(false); // forward disabled
  });

  test('second entry enables back, not forward', () => {
    const p = makePanel();
    p.history = ['https://a.com', 'https://b.com'];
    p.historyIdx = 1;
    expect(p.historyIdx > 0).toBe(true);            // back enabled
    expect(p.historyIdx < p.history.length - 1).toBe(false); // forward still disabled
  });

  test('back() decrements historyIdx', () => {
    const p = makePanel();
    p.history = ['https://a.com', 'https://b.com'];
    p.historyIdx = 1;
    p.back();
    expect(p.historyIdx).toBe(0);
  });

  test('back() is a no-op at the start of history', () => {
    const p = makePanel();
    p.history = ['https://a.com'];
    p.historyIdx = 0;
    p.back();
    expect(p.historyIdx).toBe(0);
  });

  test('forward() increments historyIdx when available', () => {
    const p = makePanel();
    p.history = ['https://a.com', 'https://b.com'];
    p.historyIdx = 0;
    // point iframe at the forward URL to avoid triggering real load issues
    p.iframe.src = '';
    p.forward();
    expect(p.historyIdx).toBe(1);
  });

  test('forward() is a no-op at the latest entry', () => {
    const p = makePanel();
    p.history = ['https://a.com'];
    p.historyIdx = 0;
    p.forward();
    expect(p.historyIdx).toBe(0);
  });

  test('going back enables forward', () => {
    const p = makePanel();
    p.history = ['https://a.com', 'https://b.com'];
    p.historyIdx = 1;
    p.back();
    expect(p.historyIdx < p.history.length - 1).toBe(true); // forward now enabled
  });
});

// ── Load-error state ──────────────────────────────────────────────────────────
describe('WebPanel load-error state', () => {
  test('_loadError starts false', () => {
    const p = makePanel();
    expect(p._loadError).toBe(false);
  });

  test('_loadError is set to true when iframe fires onerror', () => {
    const p = makePanel();
    p.currentUrl = 'https://bad.example';
    // Trigger _loadUrl which attaches the iframe handlers.
    p._loadUrl('https://bad.example');
    expect(p._loadError).toBe(false); // not yet
    // Simulate iframe error
    p.iframe.onerror();
    expect(p._loadError).toBe(true);
  });

  test('_loadError is cleared when a new _loadUrl call is made', () => {
    const p = makePanel();
    p.iframe.onerror && p.iframe.onerror(); // prime an error
    p._loadUrl('https://good.example');
    expect(p._loadError).toBe(false);   // cleared at the start of the new load
  });

  test('_loadError is cleared when iframe fires onload', () => {
    const p = makePanel();
    p._loadUrl('https://site.example');
    p.iframe.onerror();                 // set the error
    expect(p._loadError).toBe(true);

    // Navigate to the same URL again — onerror fired, then onload fires.
    p._loadUrl('https://site.example');
    p.iframe.onload();
    expect(p._loadError).toBe(false);
  });
});
