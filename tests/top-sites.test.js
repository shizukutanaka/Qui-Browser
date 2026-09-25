/**
 * New-tab Top Sites: the tile layout geometry, hit-testing, and the WebPanel
 * wiring that turns a dwell on a tile into a navigation.
 *
 * Grounding: Firefox Top Sites / Chrome's new-tab page — frecency-ranked
 * destinations one click away on every fresh tab. In VR the win is bigger:
 * a tile select is one dwell, retyping a URL is a whole keyboard round-trip.
 */

// ── THREE stub ────────────────────────────────────────────────────────────────
class MockMesh {
  constructor() {
    this.visible = true;
    this.geometry = { dispose() {} };
    this.material = { map: null, dispose() {}, color: { set() {} } };
    this.position = { set() {} };
  }
  worldToLocal(v) { return v; }
}
jest.mock('three', () => ({
  Group: class {
    constructor() { this.position = { set() {} }; this._objects = []; }
    add(o) { this._objects.push(o); }
    remove(o) { this._objects = this._objects.filter(x => x !== o); }
    traverse(fn) { this._objects.forEach(fn); fn(this); }
  },
  Mesh: MockMesh,
  PlaneGeometry: class { dispose() {} },
  MeshBasicMaterial: class { dispose() {} },
  CanvasTexture: class { constructor() { this.needsUpdate = false; } dispose() {} },
  SRGBColorSpace: 'srgb',
  MathUtils: { degToRad: (d) => d * Math.PI / 180 }
}));

// ── canvas / document stub ────────────────────────────────────────────────────
const ctx2d = {
  clearRect() {}, fillRect() {}, fillText() {}, strokeRect() {},
  beginPath() {}, arc() {}, fill() {},
  set fillStyle(v) {}, set strokeStyle(v) {},
  set font(v) {}, set textAlign(v) {}, set lineWidth(v) {},
  set textBaseline(v) {}
};
global.document = {
  createElement(tag) {
    if (tag === 'canvas') return { width: 0, height: 0, getContext: () => ctx2d };
    if (tag === 'iframe') {
      return { src: '', style: { cssText: '' }, onload: null, onerror: null, setAttribute() {} };
    }
    return {};
  },
  body: { appendChild() {}, removeChild() {} }
};

const { WebPanel } = require('../src/vr/browser/WebPanel.js');
const {
  topSiteTiles, hitTestTopSites,
  TOP_SITE_MAX, TOP_SITE_COLS, TILE_H, TILE_GAP, TILE_TOP
} = require('../src/vr/browser/topSitesLayout.js');
const { CONTENT_PX_W, CONTENT_PX_H } = require('../src/vr/browser/readerLayout.js');

function makePanel(opts = {}) {
  return new WebPanel({
    scene: { add() {}, remove() {} },
    registerInteractable: () => {},
    unregisterInteractable: () => {},
    onNavigate: () => {},
    ...opts
  });
}

/** Map a content-canvas pixel coordinate to the point _onContentSelect sees. */
function evtAtCanvasPx(px, py) {
  const localX = ((px / CONTENT_PX_W) - 0.5) * 1.6;              // PANEL_W
  const localY = (((1 - (py / CONTENT_PX_H)) - 0.5)) * (1.0 * (1 - 0.08)); // PANEL_H*(1-CHROME_H)
  return { x: localX, y: localY, clone() { return this; } };
}

// ── topSiteTiles geometry ─────────────────────────────────────────────────────
describe('topSiteTiles', () => {
  test('lays out up to TOP_SITE_MAX tiles as a 4-wide grid inside the canvas', () => {
    const tiles = topSiteTiles(TOP_SITE_MAX);
    expect(tiles).toHaveLength(8);
    for (const r of tiles) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(TILE_TOP);
      expect(r.x + r.w).toBeLessThanOrEqual(CONTENT_PX_W);
      expect(r.y + r.h).toBeLessThanOrEqual(CONTENT_PX_H);
      expect(r.h).toBe(TILE_H);
    }
    // Rows of TOP_SITE_COLS: first four share one y, next four the next.
    expect(new Set(tiles.slice(0, 4).map(r => r.y)).size).toBe(1);
    expect(new Set(tiles.slice(4).map(r => r.y)).size).toBe(1);
    expect(tiles[4].y).toBe(tiles[0].y + TILE_H + TILE_GAP);
  });

  test('a short last row is centred under the full rows', () => {
    const tiles = topSiteTiles(6);
    expect(tiles).toHaveLength(6);
    const row2 = tiles.slice(4);
    const row2Center = row2[0].x + (row2[1].x + row2[1].w - row2[0].x) / 2;
    expect(Math.abs(row2Center - CONTENT_PX_W / 2)).toBeLessThanOrEqual(2);
  });

  test('clamps over-large counts and tolerates degenerate input', () => {
    expect(topSiteTiles(99)).toHaveLength(TOP_SITE_MAX);
    expect(topSiteTiles(0)).toEqual([]);
    expect(topSiteTiles(-3)).toEqual([]);
    expect(topSiteTiles(4)).toHaveLength(4);
  });
});

// ── hitTestTopSites ───────────────────────────────────────────────────────────
describe('hitTestTopSites', () => {
  test('returns the tile containing the point, -1 elsewhere', () => {
    const tiles = topSiteTiles(4);
    for (let i = 0; i < tiles.length; i++) {
      const r = tiles[i];
      expect(hitTestTopSites(r.x + r.w / 2, r.y + r.h / 2, tiles)).toBe(i);
      expect(hitTestTopSites(r.x + r.w - 1, r.y + r.h - 1, tiles)).toBe(i);
      expect(hitTestTopSites(r.x - 1, r.y - 1, tiles)).toBe(-1);
    }
    expect(hitTestTopSites(10, 10, tiles)).toBe(-1);
    expect(hitTestTopSites(0, 0, null)).toBe(-1);
  });
});

// ── WebPanel empty-state tiles ────────────────────────────────────────────────
describe('WebPanel new-tab top sites', () => {
  const SITES = [
    { url: 'https://a.example', title: 'A', host: 'a.example' },
    { url: 'https://b.example', title: 'B', host: 'b.example' }
  ];

  test('the provider supplies tiles to the empty state', () => {
    const p = makePanel({ topSitesProvider: () => SITES });
    p._drawContent();
    expect(p._topSiteTiles).toHaveLength(2);
  });

  test('selecting a tile navigates to its URL (one dwell, no keyboard)', () => {
    const navigated = [];
    const p = makePanel({ topSitesProvider: () => SITES });
    p.navigate = (u) => navigated.push(u);
    p._drawContent();
    const r = p._topSiteTiles[1];
    p._onContentSelect(evtAtCanvasPx(r.x + r.w / 2, r.y + r.h / 2));
    expect(navigated).toEqual(['https://b.example']);
  });

  test('selecting outside a tile is a no-op', () => {
    const navigated = [];
    const p = makePanel({ topSitesProvider: () => SITES });
    p.navigate = (u) => navigated.push(u);
    p._drawContent();
    p._onContentSelect(evtAtCanvasPx(20, 20));
    expect(navigated).toEqual([]);
  });

  test('no provider = no tiles and a harmless select', () => {
    const p = makePanel();
    p._drawContent();
    expect(p._topSiteTiles).toEqual([]);
    expect(() => p._onContentSelect(evtAtCanvasPx(500, 700))).not.toThrow();
  });

  test('a private panel keeps isPrivate (Quest Browser: private state is per-window)', () => {
    const pub = makePanel();
    const priv = makePanel({ privateMode: true });
    expect(pub.isPrivate).toBe(false);
    expect(priv.isPrivate).toBe(true);
  });
});
