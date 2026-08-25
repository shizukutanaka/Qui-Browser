/**
 * Tests for WebPanel visual-state logic:
 *   - back/forward disabled state (driven by historyIdx / history.length)
 *   - the content state machine, which the READER now solely owns
 *
 * The panel used to carry a hidden <iframe> that could never be displayed and
 * whose load event overwrote the reader's result — measured clobbering a
 * successfully read article back to 'unavailable'. It is gone; `createElement`
 * below refuses to make one so its return can never quietly come back.
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
      throw new Error('WebPanel must not create an iframe');
    }
    return {};
  },
  body: { appendChild() {}, removeChild() {} }
};

const { WebPanel, urlBarMaxChars } = require('../src/vr/browser/WebPanel.js');

/** Drain pending microtasks so an awaited reader load can settle. */
const flush = () => new Promise((r) => setImmediate(r));

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
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  test('_loadError starts false', () => {
    const p = makePanel();
    expect(p._loadError).toBe(false);
  });

  test('an observable HTTP failure sets _loadError and fires onLoadError', async () => {
    global.fetch = () => Promise.resolve({ ok: false, status: 403, text: () => Promise.resolve('') });
    const onLoadError = jest.fn();
    const p = makePanel({ onLoadError });
    p.currentUrl = 'https://bad.example';
    await p._loadReaderText('https://bad.example');
    expect(p._loadError).toBe(true);
    expect(p._contentState).toBe('error');
    expect(onLoadError).toHaveBeenCalledWith('https://bad.example');
  });

  test('an opaque fetch rejection is NOT flagged as an error', async () => {
    // No CORS header, or offline — indistinguishable, and the ordinary case
    // without a proxy. Reddening the URL bar here would cry wolf on nearly
    // every navigation, so the panel says 'unavailable' and claims nothing.
    global.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
    const onLoadError = jest.fn();
    const p = makePanel({ onLoadError });
    p.currentUrl = 'https://nocors.example';
    await p._loadReaderText('https://nocors.example');
    expect(p._loadError).toBe(false);
    expect(p._contentState).toBe('unavailable');
    expect(onLoadError).not.toHaveBeenCalled();
  });

  test('_loadError is cleared when a new _loadUrl call is made', () => {
    const p = makePanel();
    p._loadError = true;               // prime an error
    p._loadUrl('https://good.example');
    expect(p._loadError).toBe(false);   // cleared at the start of the new load
  });

  test('_loadError is cleared once a later load succeeds', async () => {
    global.fetch = () => Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('') });
    const p = makePanel();
    p.currentUrl = 'https://site.example';
    await p._loadReaderText('https://site.example');
    expect(p._loadError).toBe(true);

    global.fetch = () => Promise.resolve({
      ok: true, status: 200,
      text: () => Promise.resolve('<html><body><p>' + 'prose here. '.repeat(40) + '</p></body></html>')
    });
    await p._loadReaderText('https://site.example');
    expect(p._loadError).toBe(false);
    expect(p._contentState).toBe('reader');
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

// ── dispose() teardown — a load landing after the panel is gone ─────────────
// The iframe's handlers had to be nulled for exactly this reason. With the
// frame deleted, the reader's sequence number does the same job: dispose()
// bumps it, so an in-flight fetch settles nothing.
describe('WebPanel dispose() invalidates an in-flight load', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  test('dispose() advances the reader sequence', () => {
    const p = makePanel();
    const before = p._readerSeq;
    p.dispose();
    expect(p._readerSeq).toBeGreaterThan(before);
  });

  test('a load completing after dispose() does not reach onNavigate', async () => {
    let release;
    global.fetch = () => new Promise((r) => { release = r; });
    const onNavigate = jest.fn();
    const p = makePanel({ onNavigate });
    p._loadUrl('https://example.com'); // navigation in flight

    p.dispose(); // tab/panel closed mid-load
    release({
      ok: true, status: 200,
      text: () => Promise.resolve('<html><body><p>' + 'prose. '.repeat(40) + '</p></body></html>')
    });
    await flush();

    expect(onNavigate).not.toHaveBeenCalled();
    expect(p.loading).toBe(true); // never settled — the panel is gone
  });

  test('a load erroring after dispose() does not reach onLoadError', async () => {
    let reject;
    global.fetch = () => new Promise((_, r) => { reject = r; });
    const onLoadError = jest.fn();
    const p = makePanel({ onLoadError });
    p._loadUrl('https://example.com');

    p.dispose();
    reject(new TypeError('Failed to fetch'));
    await flush();

    expect(onLoadError).not.toHaveBeenCalled();
  });
});

// ── Content area reflects real state (no silent stale placeholder) ───────────
// The content canvas was painted once in _build() and never again, so the
// viewport kept reading "Enter a URL to navigate" after a navigation the user
// believed had succeeded. It is now repainted by whatever the reader finds —
// and by nothing else, which is the point of deleting the frame.
describe('WebPanel content-area state', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  test('starts empty', () => {
    const p = makePanel();
    expect(p._contentState).toBe('empty');
  });

  test('goes to loading while a navigation is in flight', async () => {
    let release;
    global.fetch = () => new Promise((r) => { release = r; });
    const p = makePanel();
    p._loadUrl('https://example.com');
    expect(p._contentState).toBe('loading');
    expect(p.loading).toBe(true);
    // Let it settle so the abort timer is cleared and Jest can exit.
    release({ ok: false, status: 404, text: () => Promise.resolve('') });
    await flush();
  });

  test('a successful read is NOT overwritten — the regression the frame caused', async () => {
    // Measured against a same-origin article before the fix: state reached
    // 'reader' with 9 lines, then the hidden frame's load event clobbered it
    // to 'unavailable'. Nothing but the reader may settle the state now.
    global.fetch = () => Promise.resolve({
      ok: true, status: 200,
      text: () => Promise.resolve(
        '<html><head><title>Real Title</title></head><body><article><p>'
        + 'Sentence of real prose. '.repeat(30) + '</p></article></body></html>')
    });
    const onNavigate = jest.fn();
    const p = makePanel({ onNavigate });
    p.navigate('https://example.com/article');
    await flush();

    expect(p._contentState).toBe('reader');
    expect(p._readerLines.length).toBeGreaterThan(3);
    expect(p.loading).toBe(false);
    // The title comes from the markup we actually read, not the URL — the
    // frame could only ever supply one for a same-origin page.
    expect(p.currentTitle).toBe('Real Title');
    expect(onNavigate).toHaveBeenCalledWith('https://example.com/article', 'Real Title');
  });

  test('an unreadable page reports unavailable and still records the visit', async () => {
    global.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
    const onNavigate = jest.fn();
    const p = makePanel({ onNavigate });
    p.navigate('https://example.com');
    await flush();
    expect(p._contentState).toBe('unavailable');
    expect(p.loading).toBe(false);
    expect(onNavigate).toHaveBeenCalled();
  });

  test('an errored load reports error', async () => {
    global.fetch = () => Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('') });
    const p = makePanel();
    await p._loadReaderText('https://example.com');
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

  test('a non-ok response is a real error — the origin answered and said no', async () => {
    global.fetch = () => Promise.resolve({ ok: false, status: 403, text: () => Promise.resolve('') });
    const p = makePanel();
    await p._loadReaderText('https://example.com/a');
    expect(p._contentState).toBe('error');
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
    visibleLinesFor, pageJumpLines, CONTENT_PX_W, CONTENT_PX_H
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
    // visibleLinesFor, not visibleLineCount: a scrollable article reserves the
    // bottom strip the arrows and progress label occupy, so fewer lines show.
    expect(p._readerScroll)
      .toBe(before + pageJumpLines(visibleLinesFor(p._readerLines.length, 1)));
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

describe('WebPanel.setReaderProxyUrl — live proxy switch', () => {
  test('repaints the unavailable screen, whose wording depends on the proxy', async () => {
    // A failed fetch shows "run a reader proxy" guidance; once the user sets
    // one, the stale wording would be wrong, so the state screen repaints.
    global.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
    const p = makePanel();
    await p._loadReaderText('https://example.com/a');
    expect(p._contentState).toBe('unavailable');

    const draws = jest.spyOn(p, '_drawContent');
    p.setReaderProxyUrl('http://p:8080');
    expect(p.readerProxyUrl).toBe('http://p:8080');
    expect(draws).toHaveBeenCalledTimes(1);

    // Same value again is a no-op — no churn on redundant settings writes.
    p.setReaderProxyUrl('http://p:8080');
    expect(draws).toHaveBeenCalledTimes(1);
    draws.mockRestore();
  });

  test('does not repaint while showing the reader (nothing visible changes)', () => {
    const p = makePanel();
    p._contentState = 'reader';
    const draws = jest.spyOn(p, '_drawContent');
    p.setReaderProxyUrl('http://p:8080');
    expect(draws).not.toHaveBeenCalled();
    draws.mockRestore();
  });

  test('the next reader fetch actually goes through the newly set proxy', async () => {
    const seen = [];
    global.fetch = (u) => {
      seen.push(u);
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('<html><body><article><p>Hello world text.</p></article></body></html>') });
    };
    const p = makePanel();
    p.setReaderProxyUrl('http://p:8080');
    await p._loadReaderText('https://example.com/a');
    expect(seen[0]).toBe('http://p:8080/fetch?url=https%3A%2F%2Fexample.com%2Fa');
  });
});
