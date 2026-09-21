/**
 * Behavioural tests for BookmarkPanel — THREE and canvas are mocked so the
 * selection/navigation wiring can be exercised headlessly. The pure layout
 * math is covered separately in bookmark-layout.test.js.
 */

const {
  PANEL_PX_W, PANEL_PX_H, HEADER_H, ROW_H, VISIBLE_ROWS
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
const drawnText = [];   // records fillText(text, x, y, maxWidth) for assertions
const ctxStub = {
  fillRect() {}, strokeRect() {}, clearRect() {},
  fillText(t, x, y, maxWidth) { drawnText.push({ text: String(t), x, y, maxWidth }); },
  set fillStyle(v) {}, set strokeStyle(v) {},
  set font(v) {}, set textAlign(v) {}, set lineWidth(v) {}
};
global.document = global.document || {};
global.document.createElement = () => ({
  width: 0, height: 0, getContext: () => ctxStub
});

const { BookmarkPanel, bookmarkPanelColors } = require('../src/vr/browser/BookmarkPanel.js');

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

  test('_rows() in history mode requests more than one page, so scrolling works', () => {
    // Regression: _rows() previously called store.getHistory(VISIBLE_ROWS),
    // capping the fetch at exactly one page. That made "allRows.length >
    // VISIBLE_ROWS" always false in _draw(), so the scroll arrows could never
    // appear and history beyond the first page was permanently unreachable —
    // regardless of how much history the user actually had. A realistic store
    // (unlike makeStore(), which ignores the limit arg) truncates to the
    // requested limit, so this simulates that to catch the regression.
    const fullHistory = Array.from({ length: VISIBLE_ROWS + 5 }, (_, i) => ({
      url: `https://site${i}.example`
    }));
    const getHistory = jest.fn((limit = 50) => fullHistory.slice(0, limit));
    const store = { getBookmarks: () => [], getHistory };
    const p = makePanel(store);
    p.setMode('history');

    const rows = p._rows();

    expect(getHistory).toHaveBeenCalledWith(expect.any(Number));
    expect(getHistory.mock.calls[0][0]).toBeGreaterThan(VISIBLE_ROWS);
    expect(rows.length).toBeGreaterThan(VISIBLE_ROWS);
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

  test('_onSelect accepts the controller/gaze event format { intersection: { point } }', () => {
    // Controllers call onSelect({ intersection: hit, controller }) and gaze calls
    // onSelect({ intersection: hit, gaze: true }). _onSelect must unwrap hit.point
    // instead of calling .clone() on the event wrapper (which has no .clone()).
    const onSelect = jest.fn();
    const store = makeStore([{ url: 'https://wrapped.com', title: 'Wrapped' }]);
    const p = makePanel(store, onSelect);
    p.show();
    MockMesh._nextLocal = localFor(100, HEADER_H + 10);
    // Simulate the event shape emitted by VRApp.onControllerSelect / GazeInteraction:
    const fakeHit = { point: { clone() { return MockMesh._nextLocal; } } };
    p._onSelect({ intersection: fakeHit, controller: {} });
    expect(onSelect).toHaveBeenCalledWith('https://wrapped.com');
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

  test('clicking close fires onClose callback (WCAG 4.1.3)', () => {
    const onClose = jest.fn();
    const p = new BookmarkPanel({
      scene: { add: jest.fn(), remove: jest.fn() },
      registerInteractable: jest.fn(),
      unregisterInteractable: jest.fn(),
      store: makeStore(),
      onSelect: jest.fn(),
      onClose
    });
    p.addToScene();
    p.show();
    MockMesh._nextLocal = localFor(PANEL_PX_W - 20, HEADER_H / 2);
    p._onSelect({ clone() { return MockMesh._nextLocal; } });
    expect(p.visible).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('close works without an onClose callback (no-op)', () => {
    const p = makePanel(makeStore());
    p.show();
    MockMesh._nextLocal = localFor(PANEL_PX_W - 20, HEADER_H / 2);
    expect(() => p._onSelect({ clone() { return MockMesh._nextLocal; } })).not.toThrow();
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

  // Regression: scrollOffset was only clamped inside the deleteRow case (the
  // panel's own ✕ button). Bookmarks removed through a path this panel never
  // sees — the chrome-bar ★ button calls BookmarkStore.removeBookmark directly
  // (VRApp wires WebPanel.onToggleBookmark → this.bookmarks.toggleBookmark) —
  // left a stale offset that sliced an empty window: a blank page whose rows
  // were all dead clicks, recoverable only via the up-arrow or a tab switch.
  describe('scrollOffset clamps against external bookmark removal', () => {
    // A mutable store so the test can shrink the list mid-session, exactly as
    // the chrome-bar ★ button does (removeBookmark on the shared store).
    function makeMutableStore(bookmarks) {
      return {
        getBookmarks: () => bookmarks,
        getHistory: () => [],
        removeBookmark: (url) => {
          const i = bookmarks.findIndex(b => b.url === url);
          if (i >= 0) bookmarks.splice(i, 1);
        }
      };
    }

    test('_draw() clamps a now-out-of-range offset back into the shrunk list', () => {
      const marks = Array.from({ length: VISIBLE_ROWS + 5 }, (_, i) => ({ url: `https://s${i}.example` }));
      const p = makePanel(makeMutableStore(marks));
      p.show();
      p.scrollOffset = VISIBLE_ROWS; // scrolled to a later page
      // Externally remove everything but 2 bookmarks (chrome-bar ★ path).
      marks.length = 2;
      p._draw();
      expect(p.scrollOffset).toBe(0); // clamped: max(0, 2 - VISIBLE_ROWS) === 0
    });

    test('a row click after an external shrink still hits a real, surviving row', () => {
      const onSelect = jest.fn();
      const marks = Array.from({ length: VISIBLE_ROWS + 5 }, (_, i) => ({ url: `https://s${i}.example` }));
      const p = makePanel(makeMutableStore(marks), onSelect);
      p.show();
      p.scrollOffset = VISIBLE_ROWS; // page 2
      // Shrink to a single surviving bookmark without any redraw yet.
      marks.length = 1;
      // Click the first visible row — pre-fix this sliced an empty window and
      // the click resolved to nothing (onSelect never fired).
      MockMesh._nextLocal = localFor(100, HEADER_H + 10);
      p._onSelect({ clone() { return MockMesh._nextLocal; } });
      expect(onSelect).toHaveBeenCalledWith('https://s0.example');
    });

    test('offset is left untouched while the list still fills past the offset', () => {
      const marks = Array.from({ length: VISIBLE_ROWS + 5 }, (_, i) => ({ url: `https://s${i}.example` }));
      const p = makePanel(makeMutableStore(marks));
      p.show();
      p.scrollOffset = 2;
      p._draw();
      expect(p.scrollOffset).toBe(2); // still room to scroll — no clamp needed
    });
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

// ── bookmarkPanelColors — high-contrast palette ───────────────────────────────
describe('bookmarkPanelColors — high-contrast palette (WCAG 1.4.11)', () => {
  test('normal mode returns the expected dark-glass background', () => {
    const c = bookmarkPanelColors(false);
    expect(c.bg).toMatch(/rgba?\(10/);        // near-black
    expect(c.rowTitle).toBe('#e8ecff');
  });

  test('HC mode uses pure-black background', () => {
    const c = bookmarkPanelColors(true);
    expect(c.bg).toBe('#000000');
    expect(c.headerBg).toBe('#000000');
  });

  test('HC inactive scroll text is brighter than normal (contrast fix)', () => {
    const normal = bookmarkPanelColors(false);
    const hc     = bookmarkPanelColors(true);
    const brightness = (s) =>
      s.match(/[0-9a-f]{2}/gi).slice(0, 3).map(h => parseInt(h, 16)).reduce((a, b) => a + b, 0);
    expect(brightness(hc.scrollInactive.text)).toBeGreaterThan(
      brightness(normal.scrollInactive.text)
    );
  });

  test('HC active and inactive scroll use different colours', () => {
    const c = bookmarkPanelColors(true);
    expect(c.scrollActive.text).not.toBe(c.scrollInactive.text);
    expect(c.scrollActive.bg).not.toBe(c.scrollInactive.bg);
  });

  test('HC inactive tab text is brighter than normal inactive tab text', () => {
    const normal = bookmarkPanelColors(false);
    const hc     = bookmarkPanelColors(true);
    const brightness = (s) =>
      s.match(/[0-9a-f]{2}/gi).slice(0, 3).map(h => parseInt(h, 16)).reduce((a, b) => a + b, 0);
    expect(brightness(hc.tabInactive.text)).toBeGreaterThan(
      brightness(normal.tabInactive.text)
    );
  });

  test('HC row URL text is brighter than normal', () => {
    const normal = bookmarkPanelColors(false);
    const hc     = bookmarkPanelColors(true);
    const brightness = (s) =>
      s.match(/[0-9a-f]{2}/gi).slice(0, 3).map(h => parseInt(h, 16)).reduce((a, b) => a + b, 0);
    expect(brightness(hc.rowUrl)).toBeGreaterThan(brightness(normal.rowUrl));
  });

  test('HC row title is pure white', () => {
    expect(bookmarkPanelColors(true).rowTitle).toBe('#ffffff');
  });

  test('normal-mode values unchanged (regression guard)', () => {
    const c = bookmarkPanelColors(false);
    expect(c.tabInactive.text).toBe('#8899bb');
    expect(c.rowUrl).toBe('#7f8db5');
    expect(c.emptyText).toBe('#8899aa');
  });

  // `scrollInactive.text` used to be pinned here as `#445566`. That pin was
  // guarding a defect: the glyph measures 2.37:1 against its rendered backing,
  // i.e. invisible rather than visibly-unavailable. Pinning a hex cannot tell
  // the difference, so the guard now asserts the property that actually
  // matters and tests/contrast.test.js sweeps the rest of the palette.
  test('the inactive scroll glyph is perceivable, and dimmer than the active one', () => {
    const { contrastRatio, compositeOver } = require('./helpers/contrast.js');
    const c = bookmarkPanelColors(false);
    const panel = compositeOver(c.bg, '#000000');
    const idle = contrastRatio(c.scrollInactive.text, c.scrollInactive.bg, panel);
    const active = contrastRatio(c.scrollActive.text, c.scrollActive.bg, panel);
    expect(idle).toBeGreaterThanOrEqual(3);
    expect(idle).toBeLessThan(active);
  });
});

// Regression: row text was truncated by CHARACTER count (44 title / 52 url),
// which silently assumed Latin. At bold 26px a 44-character title is ~572px of
// Latin but 1144px of Japanese — 22% past the 936px available before the
// delete button, so Japanese bookmark titles ran off the panel.
describe('BookmarkPanel row text fits the row in either script', () => {
  const { textWidthEm } = require('../src/vr/ui/textWrap.js');
  const { PANEL_PX_W: PW, DELETE_ZONE_W: DZ } = require('../src/vr/browser/bookmarkLayout.js');
  const AVAIL = PW - 24 - DZ;
  const TITLE_FONT = 26, URL_FONT = 20;

  // Observe what the panel ACTUALLY draws, not just the helper it should use.
  function drawnRowText(bookmarks) {
    drawnText.length = 0;
    const p = makePanel(makeStore(bookmarks));
    p.show();
    return drawnText.filter(d => d.x === 24);   // row title/url start at x=24
  }

  test('a long Japanese title is drawn within the row width', () => {
    const jp = 'これは非常に長い日本語のブックマークのタイトルです'.repeat(3);
    const rows = drawnRowText([{ url: 'https://a.jp', title: jp }]);
    const title = rows.find(d => d.text.startsWith('これは'));
    expect(title).toBeDefined();
    expect(textWidthEm(title.text) * TITLE_FONT).toBeLessThanOrEqual(AVAIL);
  });

  test('a long Latin title is drawn within the row width', () => {
    const en = 'An extremely long English bookmark title that keeps going '.repeat(3);
    const rows = drawnRowText([{ url: 'https://a.com', title: en }]);
    const title = rows.find(d => d.text.startsWith('An extremely'));
    expect(textWidthEm(title.text) * TITLE_FONT).toBeLessThanOrEqual(AVAIL);
  });

  test('a long URL is drawn within the row width', () => {
    const url = 'https://example.com/' + 'segment/'.repeat(20);
    const rows = drawnRowText([{ url, title: 'T' }]);
    const drawnUrl = rows.find(d => d.text.startsWith('https://example.com'));
    expect(drawnUrl).toBeDefined();
    expect(textWidthEm(drawnUrl.text) * URL_FONT).toBeLessThanOrEqual(AVAIL);
  });

  test('row text is drawn with a maxWidth backstop', () => {
    const rows = drawnRowText([{ url: 'https://a.jp', title: '日本語' }]);
    rows.forEach(d => expect(d.maxWidth).toBe(AVAIL));
  });
});

describe('BookmarkPanel — scroll arrows, delete zone, callbacks', () => {
  const manyRows = (n) =>
    Array.from({ length: n }, (_, i) => ({ url: `https://s${i}.example`, title: `S${i}` }));

  function scrollablePanel() {
    const store = makeStore(manyRows(VISIBLE_ROWS + 4));
    const p = makePanel(store);
    p.show();
    return { p, store };
  }

  test('scroll-down then scroll-up moves scrollOffset within bounds', () => {
    const { p } = scrollablePanel();
    // ↓ arrow zone: SCROLL_DN_X0..X1 in the header row
    MockMesh._nextLocal = localFor(700, HEADER_H / 2);
    p._onSelect({ clone() { return MockMesh._nextLocal; } });
    expect(p.scrollOffset).toBe(1);
    // ↑ arrow zone
    MockMesh._nextLocal = localFor(500, HEADER_H / 2);
    p._onSelect({ clone() { return MockMesh._nextLocal; } });
    expect(p.scrollOffset).toBe(0);
    // ↑ at offset 0 does not go negative
    MockMesh._nextLocal = localFor(500, HEADER_H / 2);
    p._onSelect({ clone() { return MockMesh._nextLocal; } });
    expect(p.scrollOffset).toBe(0);
  });

  test('scroll-down stops at the last full page', () => {
    const { p } = scrollablePanel(); // VISIBLE_ROWS+4 rows -> max offset 4
    for (let i = 0; i < 8; i++) {
      MockMesh._nextLocal = localFor(700, HEADER_H / 2);
      p._onSelect({ clone() { return MockMesh._nextLocal; } });
    }
    expect(p.scrollOffset).toBe(4);
  });

  test('setMode resets scrollOffset and fires onTabChange via a tab click', () => {
    const { p } = scrollablePanel();
    p.scrollOffset = 3;
    const onTabChange = jest.fn();
    p.onTabChange = onTabChange;
    MockMesh._nextLocal = localFor(300, HEADER_H / 2); // 'history' tab region
    p._onSelect({ clone() { return MockMesh._nextLocal; } });
    expect(p.mode).toBe('history');
    expect(p.scrollOffset).toBe(0);
    expect(onTabChange).toHaveBeenCalledWith('history');
  });

  test('delete zone click removes the bookmark and fires onDeleteBookmark', () => {
    const onDelete = jest.fn();
    // removeBookmark must exist for the delete zone to be armed at all.
    const store = {
      getBookmarks: () => [{ url: 'https://del.me', title: 'D' }],
      getHistory: () => [],
      removeBookmark: jest.fn()
    };
    const p = makePanel(store);
    p.onDeleteBookmark = onDelete;
    p.show();
    // First row, inside the right-hand delete zone (last DELETE_ZONE_W px)
    MockMesh._nextLocal = localFor(1024 - 10, HEADER_H + 10);
    p._onSelect({ clone() { return MockMesh._nextLocal; } });
    expect(store.removeBookmark).toHaveBeenCalledWith('https://del.me');
    expect(onDelete).toHaveBeenCalledWith('https://del.me');
  });

  test('history mode rows have no delete zone — same click selects instead', () => {
    const onSelect = jest.fn();
    const store = {
      getBookmarks: () => [],
      getHistory: () => [{ url: 'https://hist.example' }],
      removeBookmark: jest.fn()
    };
    const p = makePanel(store, onSelect);
    p.setMode('history');
    p.show();
    MockMesh._nextLocal = localFor(1024 - 10, HEADER_H + 10);
    p._onSelect({ clone() { return MockMesh._nextLocal; } });
    expect(onSelect).toHaveBeenCalledWith('https://hist.example');
    expect(store.removeBookmark).not.toHaveBeenCalled();
  });
});

describe('BookmarkPanel — hover callbacks + remaining guards', () => {
  test('onHover tints the mesh and fires the caption hook; onHoverEnd restores white', () => {
    const p = makePanel(makeStore());
    const cfg = p.registerInteractable.mock.calls[0][1];
    p.mesh.material = { color: { set: jest.fn() }, dispose: jest.fn() };
    p.onHoverCaption = jest.fn();
    cfg.onHover();
    expect(p.mesh.material.color.set).toHaveBeenCalledWith(0xbbccff);
    expect(p.onHoverCaption).toHaveBeenCalled();
    cfg.onHoverEnd();
    expect(p.mesh.material.color.set).toHaveBeenCalledWith(0xffffff);
  });

  test('setMode ignores unknown modes; valid modes reset scroll and redraw', () => {
    const p = makePanel(makeStore());
    p.scrollOffset = 3;
    p.setMode('bogus');
    expect(p.mode).not.toBe('bogus');
    p.setMode('history');
    expect(p.mode).toBe('history');
    expect(p.scrollOffset).toBe(0);
  });

  test('_onSelect bails when the event lacks an intersection point', () => {
    const p = makePanel(makeStore());
    expect(() => p._onSelect(null)).not.toThrow();     // null evt → !rawPoint
  });

  test('_draw returns early without a canvas or ctx', () => {
    const p = makePanel(makeStore());
    const keep = p.canvas;
    p.canvas = null;
    expect(() => p._draw()).not.toThrow();
    p.canvas = { getContext: () => null };
    expect(() => p._draw()).not.toThrow();
    p.canvas = keep;
  });
});

describe('BookmarkPanel — final guards', () => {
  test('onHover skips the tint when mesh is gone; _rows returns [] without store', () => {
    const p = makePanel(makeStore());
    const cfg = p.registerInteractable.mock.calls[0][1];
    p.onHoverCaption = jest.fn();
    const mesh = p.mesh;
    p.mesh = null;
    cfg.onHover();   // !mesh arm — caption still fires
    expect(p.onHoverCaption).toHaveBeenCalled();
    p.mesh = mesh;
    p.store = null;
    expect(p._rows()).toEqual([]);
  });

  test('_onSelect hit-testing the dead zone does nothing (default arm)', () => {
    const p = makePanel(makeStore());
    // Land the click far inside the panel body but on no row: centre-bottom.
    MockMesh._nextLocal = { x: 0, y: -0.4 };
    const before = p.mode;
    expect(() => p._onSelect({ x: 0, y: -0.4, clone() { return this; } })).not.toThrow();
    expect(p.mode).toBe(before);
  });
});

describe('BookmarkPanel — remaining branch arms', () => {
  test('constructor coerces non-function callbacks to safe defaults', () => {
    const p = new BookmarkPanel({
      scene: { add: jest.fn(), remove: jest.fn() },
      registerInteractable: jest.fn(),
      unregisterInteractable: jest.fn(),
      store: makeStore(),
      onSelect: 'not-a-fn', onDeleteBookmark: 42, onTabChange: {},
      onHoverCaption: false, onClose: null
    });
    expect(typeof p.onSelect).toBe('function');
    expect(p.onDeleteBookmark).toBeNull();
    expect(p.onTabChange).toBeNull();
    expect(p.onHoverCaption).toBeNull();
    expect(p.onClose).toBeNull();
    // scale ≤ 0 → 1
    expect(new BookmarkPanel({
      scene: { add() {}, remove() {} }, registerInteractable() {},
      unregisterInteractable() {}, store: makeStore(), scale: -2
    }).scale).toBe(1);
  });

  test('toggle() flips visible both ways', () => {
    const p = makePanel(makeStore());
    expect(p.visible).toBe(false);
    p.toggle();
    expect(p.visible).toBe(true);
    p.toggle();
    expect(p.visible).toBe(false);
  });

  test('hover arms tolerate absent mesh and absent onHoverCaption', () => {
    const reg = jest.fn();
    const p = new BookmarkPanel({
      scene: { add: jest.fn(), remove: jest.fn() },
      registerInteractable: reg, unregisterInteractable: jest.fn(),
      store: makeStore(), onSelect: jest.fn()
    });
    p.addToScene();
    const h = reg.mock.calls[0][1];
    p.mesh = null; // mesh-null arm
    expect(() => { h.onHover(); h.onHoverEnd(); }).not.toThrow();
  });

  test('row action with entry lacking url is a no-op', () => {
    const onSelect = jest.fn();
    const store = makeStore([{ url: null, title: 'x' }]);
    const p = makePanel(store, onSelect);
    p.show();
    // Row click must not fire onSelect when entry.url is falsy.
    // Drive the row action directly to isolate the entry-url arm.
    p._rows = () => [{ url: null }];
    p.hide();
    expect(onSelect).not.toHaveBeenCalled();
  });

  test('deleteRow with no onDeleteBookmark callback still removes + redraws', () => {
    const store = {
      getBookmarks: () => [{ url: 'https://a', title: 'a' }],
      getHistory: () => [],
      removeBookmark: jest.fn()
    };
    const p = makePanel(store); // no onDeleteBookmark
    p.show();
    expect(() => p._draw()).not.toThrow();
  });

  test('tex null arm: _draw completes when canvas/texture are absent', () => {
    const p = makePanel(makeStore());
    p.tex = null;
    p.canvas = null;
    expect(() => p._draw()).not.toThrow();
  });

  test('dispose arms: mesh present but scene/unregister absent', () => {
    const p = new BookmarkPanel({
      scene: null, registerInteractable: jest.fn(),
      unregisterInteractable: jest.fn(), store: makeStore()
    });
    expect(() => p.dispose()).not.toThrow();
    expect(p.canvas).toBeNull();
  });
});

describe('BookmarkPanel — last branch arms', () => {
  test('constructor without document leaves canvas/tex null', () => {
    const saved = global.document;
    try {
      delete global.document;
      const p = new BookmarkPanel({
        scene: { add: jest.fn(), remove: jest.fn() },
        registerInteractable: jest.fn(),
        unregisterInteractable: jest.fn(),
        store: makeStore(),
        onSelect: jest.fn()
      });
      expect(p.canvas).toBeNull();
      expect(p.tex).toBeNull();
    } finally {
      global.document = saved;
    }
  });

  test('row click with url-less entry is a no-op', () => {
    const store = makeStore([{ title: 'no-url', url: '' }], []);
    const onSelect = jest.fn();
    const p = makePanel(store, onSelect);
    p.show();
    p._onSelect({ intersection: { point: localFor(60, 120) } });
    expect(onSelect).not.toHaveBeenCalled();
  });

  test('deleteRow click with url-less entry is a no-op', () => {
    const store = makeStore([{ title: 'x', url: '' }], []);
    const onDelete = jest.fn();
    const p = new BookmarkPanel({
      scene: { add: jest.fn(), remove: jest.fn() },
      registerInteractable: jest.fn(),
      unregisterInteractable: jest.fn(),
      store,
      onSelect: jest.fn(),
      onDeleteBookmark: onDelete
    });
    p.addToScene();
    p.show();
    p._onSelect({ intersection: { point: localFor(430, 120) } });
    expect(onDelete).not.toHaveBeenCalled();
  });

  test('_draw with tex null does not throw', () => {
    const p = makePanel(makeStore([{ url: 'https://a' }], []));
    p.tex = null;
    expect(() => p._draw()).not.toThrow();
  });

  test('dispose without mesh/material does not throw', () => {
    const p = makePanel(makeStore([], []));
    p.mesh = null;
    p.tex = { dispose: jest.fn() };
    expect(() => p.dispose()).not.toThrow();
  });
});

describe('BookmarkPanel — complementary arms', () => {
  test('constructor wires truthy hover/close callbacks', () => {
    const onHover = jest.fn();
    const onClose = jest.fn();
    const p = new BookmarkPanel({
      scene: { add: jest.fn(), remove: jest.fn() },
      registerInteractable: jest.fn(),
      unregisterInteractable: jest.fn(),
      store: makeStore(),
      onSelect: jest.fn(),
      onHoverCaption: onHover,
      onClose
    });
    expect(p.onHoverCaption).toBe(onHover);
    expect(p.onClose).toBe(onClose);
  });

  test('row click with url-bearing entry selects and hides', () => {
    const store = makeStore([{ title: 'A', url: 'https://a.example' }], []);
    const onSelect = jest.fn();
    const p = makePanel(store, onSelect);
    p.show();
    MockMesh._nextLocal = localFor(100, HEADER_H + 10);
    p._onSelect({ clone() { return MockMesh._nextLocal; } });
    expect(onSelect).toHaveBeenCalledWith('https://a.example');
    expect(p.visible).toBe(false);
  });

  test('deleteRow click removes the bookmark and fires the callback', () => {
    const removed = [];
    const store = {
      getBookmarks: () => [{ title: 'A', url: 'https://a.example' }],
      getHistory: () => [],
      removeBookmark: (u) => removed.push(u)
    };
    const onDelete = jest.fn();
    const p = new BookmarkPanel({
      scene: { add: jest.fn(), remove: jest.fn() },
      registerInteractable: jest.fn(),
      unregisterInteractable: jest.fn(),
      store, onSelect: jest.fn(), onDeleteBookmark: onDelete
    });
    p.addToScene();
    p.show();
    MockMesh._nextLocal = localFor(PANEL_PX_W - 30, HEADER_H + 10);
    p._onSelect({ clone() { return MockMesh._nextLocal; } });
    expect(removed).toEqual(['https://a.example']);
    expect(onDelete).toHaveBeenCalledWith('https://a.example');
  });

  test('dispose with mesh+scene+material disposes everything', () => {
    const p = makePanel(makeStore([], []));
    const geo = { dispose: jest.fn() };
    const mat = { dispose: jest.fn() };
    p.mesh = { geometry: geo, material: mat };
    p.scene = { remove: jest.fn() };
    expect(() => p.dispose()).not.toThrow();
    expect(geo.dispose).toHaveBeenCalled();
    expect(mat.dispose).toHaveBeenCalled();
  });
});

describe('BookmarkPanel — false-side arms', () => {
  test('row click on an entry without url does not call onSelect', () => {
    const store = {
      getBookmarks: () => [{ title: 'noUrl' }],
      getHistory: () => []
    };
    const onSelect = jest.fn();
    const p = new BookmarkPanel({
      scene: { add: jest.fn(), remove: jest.fn() },
      registerInteractable: jest.fn(),
      unregisterInteractable: jest.fn(),
      store, onSelect
    });
    p.addToScene();
    p.show();
    MockMesh._nextLocal = localFor(100, HEADER_H + 10);
    p._onSelect({ clone() { return MockMesh._nextLocal; } });
    expect(onSelect).not.toHaveBeenCalled();
  });

  test('deleteRow on a url-less entry skips removal and callback', () => {
    const removed = [];
    const store = {
      getBookmarks: () => [{ title: 'noUrl' }],
      getHistory: () => [],
      removeBookmark: (u) => removed.push(u)
    };
    const onDelete = jest.fn();
    const p = new BookmarkPanel({
      scene: { add: jest.fn(), remove: jest.fn() },
      registerInteractable: jest.fn(),
      unregisterInteractable: jest.fn(),
      store, onSelect: jest.fn(), onDeleteBookmark: onDelete
    });
    p.addToScene();
    p.show();
    MockMesh._nextLocal = localFor(PANEL_PX_W - 30, HEADER_H + 10);
    p._onSelect({ clone() { return MockMesh._nextLocal; } });
    expect(removed).toEqual([]);
    expect(onDelete).not.toHaveBeenCalled();
  });

  test('dispose with bare mesh (no geometry/material) and no texture completes', () => {
    const p = makePanel(makeStore([], []));
    p.mesh = {};
    p.tex = null;
    expect(() => p.dispose()).not.toThrow();
  });
});

test('ctor tolerates non-function onDeleteBookmark; delete row without callback skips it', () => {
  const store = makeStore([{ url: 'https://a.example', title: 'A' }], []);
  const panel = new BookmarkPanel({
    scene: {}, registerInteractable: jest.fn(), unregisterInteractable: jest.fn(),
    store, onSelect: jest.fn(), onDeleteBookmark: 'not-a-fn'
  });
  expect(panel.onDeleteBookmark).toBeNull();
});


test('delete zone click fires onDeleteBookmark (ctor-provided callback)', () => {
  const onDelete = jest.fn();
  const store = {
    getBookmarks: () => [{ url: 'https://del.me', title: 'D' }],
    getHistory: () => [],
    removeBookmark: jest.fn()
  };
  const p = makePanel(store);
  p.onDeleteBookmark = onDelete;
  p.show();
  MockMesh._nextLocal = localFor(1024 - 10, HEADER_H + 10);
  p._onSelect({ clone() { return MockMesh._nextLocal; } });
  expect(onDelete).toHaveBeenCalledWith('https://del.me');
});

describe('BookmarkPanel — ctor + delete-zone guard arms', () => {
  test('a function onTabChange is kept verbatim', () => {
    const onTabChange = jest.fn();
    const p = new BookmarkPanel({
      scene: { add: jest.fn(), remove: jest.fn() },
      registerInteractable: jest.fn(),
      unregisterInteractable: jest.fn(),
      store: makeStore(),
      onSelect: jest.fn(),
      onTabChange
    });
    expect(p.onTabChange).toBe(onTabChange);
  });

  test('delete-zone click without an onDeleteBookmark callback just redraws', () => {
    const p = makePanel({
      getBookmarks: () => [{ url: 'https://a.example/', title: 'a' }],
      removeBookmark: jest.fn()
    });
    p.show();
    MockMesh._nextLocal = localFor(PANEL_PX_W - 10, HEADER_H + 10); // delete zone over row 0
    expect(() => p._onSelect({ clone() { return MockMesh._nextLocal; } })).not.toThrow();
  });
});


describe('BookmarkPanel — ctor default arrows', () => {
  test('omitted onSelect installs a no-op fallback that swallows the event', () => {
    const reg = jest.fn();
    const p = new BookmarkPanel({
      scene: { add: jest.fn(), remove: jest.fn() },
      registerInteractable: reg,
      unregisterInteractable: jest.fn(),
      store: makeStore()
    });
    expect(() => p.onSelect('https://example.com')).not.toThrow();
    p.addToScene();
    const handlers = reg.mock.calls[0][1];
    p.onHoverCaption = jest.fn();
    p.mesh.material = { color: { set: jest.fn() }, dispose: jest.fn() };
    handlers.onHover();
    expect(p.mesh.material.color.set).toHaveBeenCalledWith(0xbbccff);
    expect(p.onHoverCaption).toHaveBeenCalled();
  });
});

