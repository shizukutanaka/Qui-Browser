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

// Plain-function recorders (not jest.fn: jest.config sets resetMocks:true,
// which would wipe implementations before each test).
const _registered = [];
const _unregistered = [];
function registeredMeshes() { return _registered; }
function unregisteredMeshes() { return _unregistered; }

function makePanel(opts = {}) {
  _registered.length = 0;
  _unregistered.length = 0;
  return new WebPanel({
    scene: { add() {}, remove() {} },
    registerInteractable: (mesh) => { _registered.push(mesh); },
    unregisterInteractable: (mesh) => { _unregistered.push(mesh); },
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

// ── navigate() — blocked/unresolvable input (WCAG 4.1.3) ─────────────────────
describe('WebPanel navigate() blocked-navigation feedback', () => {
  test('a dangerous scheme fires onBlockedNavigation and does not navigate', () => {
    const onBlockedNavigation = jest.fn();
    const onNavigate = jest.fn();
    const p = makePanel({ onBlockedNavigation, onNavigate });

    p.navigate('javascript:alert(1)');

    expect(onBlockedNavigation).toHaveBeenCalledWith('javascript:alert(1)');
    expect(onNavigate).not.toHaveBeenCalled();
    expect(p.history).toHaveLength(0);
  });

  test('a non-http(s) scheme (ftp://) also fires onBlockedNavigation', () => {
    const onBlockedNavigation = jest.fn();
    const p = makePanel({ onBlockedNavigation });

    p.navigate('ftp://files.example.com');

    expect(onBlockedNavigation).toHaveBeenCalledWith('ftp://files.example.com');
  });

  test('a normal URL does not fire onBlockedNavigation', () => {
    const onBlockedNavigation = jest.fn();
    const p = makePanel({ onBlockedNavigation });

    p.navigate('https://example.com');

    expect(onBlockedNavigation).not.toHaveBeenCalled();
    expect(p.history).toEqual(['https://example.com']);
  });

  test('without onBlockedNavigation configured, a blocked scheme is still silently ignored (no throw)', () => {
    const p = makePanel(); // no onBlockedNavigation passed
    expect(() => p.navigate('javascript:alert(1)')).not.toThrow();
    expect(p.history).toHaveLength(0);
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

// ── Content area reflects real state (no silent stale placeholder) ───────────
// A frame refused by X-Frame-Options fires `load`, not `error`, so reaching
// onload never proved the page rendered — and the content canvas was painted
// once in _build() and never again, so the viewport kept reading "Enter a URL
// to navigate" after a navigation the user believed had succeeded.
describe('WebPanel content-area state', () => {
  test('starts empty', () => {
    const p = makePanel();
    expect(p._contentState).toBe('empty');
  });

  test('goes to loading while a navigation is in flight', () => {
    const p = makePanel();
    p._loadUrl('https://example.com');
    expect(p._contentState).toBe('loading');
  });

  test('a completed load reports content unavailable, not empty', () => {
    const p = makePanel();
    p._loadUrl('https://example.com');
    p.iframe.onload();
    expect(p._contentState).toBe('unavailable');
  });

  test('an errored load reports error', () => {
    const p = makePanel();
    p._loadUrl('https://example.com');
    p.iframe.onerror();
    expect(p._contentState).toBe('error');
  });

  test('the content canvas is retained so it can be repainted (was a _build local)', () => {
    const p = makePanel();
    expect(p.contentCanvas).toBeTruthy();
    expect(typeof p._drawContent).toBe('function');
    expect(() => p._drawContent()).not.toThrow();
  });
});

// ── Reader viewport: the first implementation of "display page content" ──────
// A WebXR web app can't composite cross-origin page pixels, so the panel
// fetches the markup and renders the extracted text itself. Only CORS-
// permissive origins are reachable; everything else must fall back honestly.
describe('WebPanel reader viewport', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  const ARTICLE = `
    <html><head><title>Test Article</title></head><body>
      <script>var x = 1;</script>
      <nav>Nav junk</nav>
      <article>
        <h2>A Heading</h2>
        <p>${'Sentence of real prose. '.repeat(20)}</p>
        <p>${'More prose follows here. '.repeat(20)}</p>
      </article>
    </body></html>`;

  test('a fetchable page renders as reader lines', async () => {
    global.fetch = () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(ARTICLE) });
    const p = makePanel();
    await p._loadReaderText('https://example.com/a');
    expect(p._contentState).toBe('reader');
    expect(p._readerLines.length).toBeGreaterThan(3);
    expect(p._readerLines.some(l => l.text.includes('real prose'))).toBe(true);
  });

  test('script and nav content never reach the reader lines', async () => {
    global.fetch = () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(ARTICLE) });
    const p = makePanel();
    await p._loadReaderText('https://example.com/a');
    const all = p._readerLines.map(l => l.text).join(' ');
    expect(all).not.toContain('var x');
    expect(all).not.toContain('Nav junk');
  });

  test('a CORS/network failure falls back to the honest unavailable state', async () => {
    global.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
    const p = makePanel();
    await p._loadReaderText('https://example.com/a');
    expect(p._contentState).toBe('unavailable');
  });

  test('a non-ok response falls back to unavailable', async () => {
    global.fetch = () => Promise.resolve({ ok: false, status: 403, text: () => Promise.resolve('') });
    const p = makePanel();
    await p._loadReaderText('https://example.com/a');
    expect(p._contentState).toBe('unavailable');
  });

  test('a fetched page with no recoverable prose says so rather than showing blank', async () => {
    global.fetch = () => Promise.resolve({
      ok: true, status: 200,
      text: () => Promise.resolve('<html><body><div id="root"></div></body></html>')
    });
    const p = makePanel();
    await p._loadReaderText('https://example.com/spa');
    expect(p._contentState).toBe('unavailable');
    expect(p._readerLines).toHaveLength(0);
  });

  test('a stale in-flight fetch cannot overwrite a newer navigation', async () => {
    let resolveSlow;
    const slow = new Promise((r) => { resolveSlow = r; });
    global.fetch = () => Promise.resolve({ ok: true, status: 200, text: () => slow });
    const p = makePanel();
    const first = p._loadReaderText('https://example.com/old');
    p._readerSeq++;             // simulate a newer navigation starting
    resolveSlow(ARTICLE);
    await first;
    expect(p._contentState).not.toBe('reader'); // stale result discarded
  });

  test('scrollContent moves the offset and clamps at both ends', async () => {
    global.fetch = () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(ARTICLE) });
    const p = makePanel();
    await p._loadReaderText('https://example.com/a');
    expect(p._readerScroll).toBe(0);
    expect(p.scrollContent(-5)).toBe(false);      // already at the top
    const moved = p.scrollContent(3);
    if (moved) {
      expect(p._readerScroll).toBeGreaterThan(0);
    }
    p.scrollContent(99999);
    expect(p._readerScroll).toBeLessThanOrEqual(p._readerLines.length);
  });

  test('scrollContent is a no-op when not in reader state', () => {
    const p = makePanel();
    expect(p.scrollContent(5)).toBe(false);
  });

  test('no fetch available degrades to unavailable without throwing', async () => {
    global.fetch = undefined;
    const p = makePanel();
    await expect(p._loadReaderText('https://example.com/a')).resolves.toBeUndefined();
    expect(p._contentState).toBe('unavailable');
  });
});

// ── FR-1.5 native quad-layer release on close ────────────────────────────────
// Regression: disableLayerMode() previously just nulled the panel's own
// quadLayer/layersSystem references and never released the native XRQuadLayer
// through LayersSystem.removeLayer(). Closing a tab mid-session (closeTab →
// dispose → disableLayerMode) therefore left the layer registered and
// composited as a frozen "ghost chrome bar", holding its GPU texture for the
// rest of the session (compounding per closed tab).
describe('WebPanel quad-layer release on close (FR-1.5)', () => {
  const fakeLayer = { transform: null };
  const fakeLayersSystem = { renderCanvasToLayer: jest.fn() };

  test('enableLayerMode stores the layer id and detach callback', () => {
    const p = makePanel();
    const onDetach = jest.fn();
    p.enableLayerMode(fakeLayer, fakeLayersSystem, 'panel_chrome_0', onDetach);
    expect(p.quadLayer).toBe(fakeLayer);
    expect(p._layerId).toBe('panel_chrome_0');
  });

  test('disableLayerMode() releases the layer via the detach callback (tab close, live session)', () => {
    const p = makePanel();
    const onDetach = jest.fn();
    p.enableLayerMode(fakeLayer, fakeLayersSystem, 'panel_chrome_2', onDetach);

    p.disableLayerMode(); // default releaseLayer=true

    expect(onDetach).toHaveBeenCalledWith('panel_chrome_2');
    expect(p.quadLayer).toBeNull();
    expect(p._layerId).toBeNull();
  });

  test('disableLayerMode(false) does NOT release the layer (session-end bulk teardown)', () => {
    const p = makePanel();
    const onDetach = jest.fn();
    p.enableLayerMode(fakeLayer, fakeLayersSystem, 'panel_chrome_1', onDetach);

    p.disableLayerMode(false);

    expect(onDetach).not.toHaveBeenCalled();
    expect(p.quadLayer).toBeNull(); // references still cleared
  });

  test('dispose() (the tab-close path) releases the layer', () => {
    const p = makePanel();
    const onDetach = jest.fn();
    p.enableLayerMode(fakeLayer, fakeLayersSystem, 'panel_chrome_3', onDetach);

    p.dispose();

    expect(onDetach).toHaveBeenCalledWith('panel_chrome_3');
  });

  test('disableLayerMode() is a safe no-op when layer mode was never enabled', () => {
    const p = makePanel();
    expect(() => p.disableLayerMode()).not.toThrow();
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

// The reader was scrollable ONLY by voice: contentMesh was never registered as
// an interactable, so a ray could not reach it. Controller and gaze users were
// stuck on the first screen of any article.
describe('WebPanel reader is scrollable by ray/gaze, not just voice', () => {
  const {
    ARROW_UP_X0, ARROW_DN_X0, ARROW_W, ARROW_H, ARROW_Y0,
    visibleLineCount, pageJumpLines, CONTENT_PX_W, CONTENT_PX_H
  } = require('../src/vr/browser/readerLayout.js');

  const LONG = `<html><head><title>T</title></head><body><article>
    ${Array.from({ length: 60 }, (_, i) => `<p>Paragraph number ${i} with enough words to wrap onto its own line.</p>`).join('')}
  </article></body></html>`;

  async function readerPanel() {
    global.fetch = () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(LONG) });
    const p = makePanel();
    await p._loadReaderText('https://example.com/a');
    return p;
  }

  // contentMesh is PANEL_W x PANEL_H*(1-CHROME_H); worldToLocal is stubbed to
  // return whatever we inject, so build the local point for a canvas pixel.
  function localForContent(px, py) {
    const PANEL_W = 1.6, contentH = 1.0 * (1 - 0.08);
    const u = px / CONTENT_PX_W;
    const v = 1 - py / CONTENT_PX_H;
    return { x: (u - 0.5) * PANEL_W, y: (v - 0.5) * contentH, clone() { return this; } };
  }

  test('contentMesh is registered as an interactable', async () => {
    const p = await readerPanel();
    expect(registeredMeshes()).toContain(p.contentMesh);
  });

  test('selecting the down arrow advances by a page', async () => {
    const p = await readerPanel();
    expect(p._contentState).toBe('reader');
    const before = p._readerScroll;
    p.contentMesh.worldToLocal = () => localForContent(ARROW_DN_X0 + ARROW_W / 2, ARROW_Y0 + ARROW_H / 2);
    p._onContentSelect({ x: 0, y: 0, clone() { return this; } });
    expect(p._readerScroll).toBe(before + pageJumpLines(visibleLineCount(1)));
  });

  test('selecting the up arrow goes back, clamped at the top', async () => {
    const p = await readerPanel();
    p.contentMesh.worldToLocal = () => localForContent(ARROW_DN_X0 + ARROW_W / 2, ARROW_Y0 + ARROW_H / 2);
    p._onContentSelect({ clone() { return this; } });
    const afterDown = p._readerScroll;
    expect(afterDown).toBeGreaterThan(0);

    p.contentMesh.worldToLocal = () => localForContent(ARROW_UP_X0 + ARROW_W / 2, ARROW_Y0 + ARROW_H / 2);
    p._onContentSelect({ clone() { return this; } });
    expect(p._readerScroll).toBeLessThan(afterDown);
  });

  test('selecting the body text area does not scroll', async () => {
    const p = await readerPanel();
    p.contentMesh.worldToLocal = () => localForContent(200, 200);
    p._onContentSelect({ clone() { return this; } });
    expect(p._readerScroll).toBe(0);
  });

  test('selecting content is inert when not in reader state', () => {
    const p = makePanel();
    p.contentMesh.worldToLocal = () => localForContent(ARROW_DN_X0 + ARROW_W / 2, ARROW_Y0 + ARROW_H / 2);
    expect(() => p._onContentSelect({ clone() { return this; } })).not.toThrow();
    expect(p._readerScroll).toBe(0);
  });

  test('dispose unregisters the content mesh too', async () => {
    const p = await readerPanel();
    const mesh = p.contentMesh;
    p.dispose();
    expect(unregisteredMeshes()).toContain(mesh);
  });
});
