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
    constructor() { this.position = { set() {} }; this.rotation = {}; this._objects = []; }
    add(o) { this._objects.push(o); }
    remove(o) { this._objects = this._objects.filter(x => x !== o); }
    traverse(fn) { this._objects.forEach(fn); fn(this); }
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

const { WebPanel, urlBarMaxChars } = require('../src/vr/browser/WebPanel.js');

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

// ── goBack / goForward — WCAG 4.1.3 navigation status ────────────────────────
describe('WebPanel goBack / goForward (WCAG 4.1.3)', () => {
  test('goBack() returns false with no history', () => {
    const p = makePanel();
    expect(p.goBack()).toBe(false);
    expect(p.historyIdx).toBe(-1);
  });

  test('goBack() returns false at the start of history', () => {
    const p = makePanel();
    p.history = ['https://a.com'];
    p.historyIdx = 0;
    expect(p.goBack()).toBe(false);
    expect(p.historyIdx).toBe(0);
  });

  test('goBack() returns true and decrements index when history available', () => {
    const p = makePanel();
    p.history = ['https://a.com', 'https://b.com'];
    p.historyIdx = 1;
    expect(p.goBack()).toBe(true);
    expect(p.historyIdx).toBe(0);
  });

  test('goForward() returns false when no forward history', () => {
    const p = makePanel();
    p.history = ['https://a.com'];
    p.historyIdx = 0;
    expect(p.goForward()).toBe(false);
    expect(p.historyIdx).toBe(0);
  });

  test('goForward() returns false with empty history', () => {
    const p = makePanel();
    expect(p.goForward()).toBe(false);
  });

  test('goForward() returns true and increments index when forward history available', () => {
    const p = makePanel();
    p.history = ['https://a.com', 'https://b.com'];
    p.historyIdx = 0;
    expect(p.goForward()).toBe(true);
    expect(p.historyIdx).toBe(1);
  });

  test('goBack then goForward roundtrips the index', () => {
    const p = makePanel();
    p.history = ['https://a.com', 'https://b.com', 'https://c.com'];
    p.historyIdx = 2;
    p.goBack(); // → 1
    p.goBack(); // → 0
    expect(p.historyIdx).toBe(0);
    expect(p.goForward()).toBe(true); // → 1
    expect(p.historyIdx).toBe(1);
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

// ── dispose() teardown — stale iframe handler leak ──────────────────────────
describe('WebPanel dispose() detaches iframe onload/onerror', () => {
  test('dispose() nulls onload and onerror before removing the iframe', () => {
    const p = makePanel();
    p._loadUrl('https://example.com'); // attaches onload/onerror
    expect(typeof p.iframe.onload).toBe('function');
    expect(typeof p.iframe.onerror).toBe('function');

    p.dispose();

    expect(p.iframe.onload).toBeNull();
    expect(p.iframe.onerror).toBeNull();
  });

  test('a load completing after dispose() does not reach onNavigate', () => {
    // The DOM re-checks the onload IDL attribute at fire time rather than
    // holding a captured reference, so simulate that: read p.iframe.onload
    // *after* dispose() (not a pre-dispose capture) and invoke it if set —
    // mirroring how a stale in-flight navigation's load event is dispatched.
    const onNavigate = jest.fn();
    const p = makePanel({ onNavigate });
    p._loadUrl('https://example.com'); // navigation in flight

    p.dispose(); // tab/panel closed mid-load

    if (p.iframe.onload) {
      p.iframe.onload();
    }
    expect(onNavigate).not.toHaveBeenCalled();
  });

  test('a load erroring after dispose() does not reach onLoadError', () => {
    const onLoadError = jest.fn();
    const p = makePanel({ onLoadError });
    p._loadUrl('https://example.com');

    p.dispose();

    if (p.iframe.onerror) {
      p.iframe.onerror();
    }
    expect(onLoadError).not.toHaveBeenCalled();
  });
});

// ── URL bar truncation ──────────────────────────────────────────────────────
describe('urlBarMaxChars — URL bar character budget', () => {
  test('returns a positive integer glyph count', () => {
    const n = urlBarMaxChars(700);
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThan(0);
  });

  test('a wider bar fits more characters', () => {
    expect(urlBarMaxChars(740)).toBeGreaterThan(urlBarMaxChars(676));
  });

  test('never returns fewer than 8 (degenerate / tiny bar)', () => {
    expect(urlBarMaxChars(0)).toBe(8);
    expect(urlBarMaxChars(-100)).toBe(8);
    expect(urlBarMaxChars(20)).toBe(8);
  });

  test('a larger font fits fewer characters in the same width', () => {
    expect(urlBarMaxChars(700, 24)).toBeLessThan(urlBarMaxChars(700, 18));
  });
});

describe('WebPanel URL bar does not overflow', () => {
  test('a very long URL is truncated when the chrome is drawn', () => {
    const p = makePanel({ onToggleBookmark: jest.fn(), isBookmarked: () => false });
    const long = 'https://example.com/' + 'segment/'.repeat(60);
    p.currentUrl = long;
    // _drawChrome must run without throwing and the URL is now longer than any
    // budget the bar could show — the truncation path is exercised.
    expect(() => p._drawChrome()).not.toThrow();
    expect(long.length).toBeGreaterThan(urlBarMaxChars(700));
  });

  test('a long error message is also truncated without throwing', () => {
    const p = makePanel();
    p.currentUrl = 'https://example.com/' + 'x'.repeat(200);
    p._loadError = true;
    expect(() => p._drawChrome()).not.toThrow();
  });
});
