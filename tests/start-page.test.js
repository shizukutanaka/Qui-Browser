/**
 * First-run start page: the new-tab state of a fresh install used to be a
 * dead end (a title and nothing selectable — top sites come from history a
 * new user does not have). The bundled start page is the fix: same-origin
 * app content offered as a single tile, so the first thing a new user can
 * do in VR is complete a successful read.
 *
 * Canvas, THREE, and DOM are stubbed to keep the test headless (same
 * harness shape as webpanel-states.test.js).
 */

const fs = require('fs');
const path = require('path');

// ── THREE stub ────────────────────────────────────────────────────────────────
class MockMesh {
  constructor() {
    this.visible = true;
    this.geometry = { dispose() {} };
    this.material = { map: null, dispose() {} };
    this.position = { set() {} };
  }
  worldToLocal(v) {
    return v;
  }
}

jest.mock('three', () => ({
  Group: class {
    constructor() {
      this.position = { set() {} };
      this.rotation = {};
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
  },
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
      this.colorSpace = '';
    }
    dispose() {}
  },
  SRGBColorSpace: 'srgb',
  MathUtils: { degToRad: (d) => (d * Math.PI) / 180 }
}));

// ── canvas / document stub (fillText recorded with a plain function: ─────────
// jest.config sets resetMocks:true, which wipes jest.fn implementations).
const fillTextCalls = [];
const ctx2d = {
  clearRect() {},
  fillRect() {},
  strokeRect() {},
  beginPath() {},
  arc() {},
  fill() {},
  fillText: (text) => {
    fillTextCalls.push(String(text));
  },
  set fillStyle(v) {},
  set strokeStyle(v) {},
  set font(v) {},
  set textAlign(v) {},
  set lineWidth(v) {},
  set textBaseline(v) {}
};
global.document = {
  documentElement: { lang: '' },
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
const { extractReadableText } = require('../src/vr/browser/readableText.js');
const { t, setLanguage } = require('../src/i18n/i18n.js');
const { PANEL_W, PANEL_H, CHROME_H } = require('../src/vr/browser/panelGeometry.js');

const START_URL = 'https://qui.local/start.html';

function makePanel(opts = {}) {
  fillTextCalls.length = 0;
  return new WebPanel({
    scene: { add() {}, remove() {} },
    registerInteractable: () => {},
    unregisterInteractable: () => {},
    onNavigate: () => {},
    ...opts
  });
}

// Convert a canvas-px point into the local point _onContentSelect expects
// (the MockMesh worldToLocal is the identity, mirroring the real maths:
// px = (x / PANEL_W + 0.5) * canvasW, py = (0.5 - y / contentH) * canvasH).
function pointForCanvasPx(panel, px, py) {
  const w = panel.contentCanvas.width;
  const h = panel.contentCanvas.height;
  const contentH = PANEL_H * (1 - CHROME_H);
  const x = (px / w - 0.5) * PANEL_W;
  const y = (0.5 - py / h) * contentH;
  return {
    x,
    y,
    z: 0,
    clone() {
      return { x: this.x, y: this.y, z: this.z };
    }
  };
}

describe('bundled start page (public/start.html)', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'start.html'), 'utf8');

  test('exists as a static file the host can serve', () => {
    expect(html).toContain('<article>');
    expect(html).toContain('<h1>');
  });

  test('the reader can extract a real article from it (first read succeeds)', () => {
    const { title, blocks } = extractReadableText(html);
    expect(title).toContain('Qui Browser');
    expect(blocks.length).toBeGreaterThanOrEqual(8);
    const text = blocks.map((b) => b.text).join('\n');
    expect(text).toContain('プライバシー');
    expect(text).toContain('English');
  });
});

describe('start-page i18n keys', () => {
  test('resolve in both languages (and are actually used, not dead keys)', () => {
    setLanguage('en');
    expect(t('vr.content.startHere')).toBe('Start here');
    expect(t('vr.content.startGuide')).toBe('Qui Browser guide & sample');
    setLanguage('ja');
    expect(t('vr.content.startHere')).toBe('まずはここから');
    expect(t('vr.content.startGuide')).toBe('Qui Browser ガイドとサンプル');
    setLanguage('en');
  });
});

describe('WebPanel new-tab start tile', () => {
  test('first run: no top sites -> exactly one tile, pointing at the start page', () => {
    const panel = makePanel({
      topSitesProvider: () => [],
      startPageProvider: () => START_URL
    });
    expect(panel._contentState).toBe('empty');
    expect(panel._topSiteTiles).toHaveLength(1);
    expect(panel._startTileUrl).toBe(START_URL);
    expect(fillTextCalls).toContain('Start here');
  });

  test('selecting the start tile navigates to the start page', () => {
    const panel = makePanel({
      topSitesProvider: () => [],
      startPageProvider: () => START_URL
    });
    const navigated = [];
    panel.navigate = (url) => navigated.push(url);
    const tile = panel._topSiteTiles[0];
    const point = pointForCanvasPx(panel, tile.x + tile.w / 2, tile.y + tile.h / 2);
    panel._onContentSelect(point);
    expect(navigated).toEqual([START_URL]);
  });

  test('with top sites present, the start tile does not shadow them', () => {
    const sites = [{ url: 'https://example.com/', host: 'example.com', title: 'Example' }];
    const panel = makePanel({
      topSitesProvider: () => sites,
      startPageProvider: () => START_URL
    });
    expect(panel._topSiteTiles).toHaveLength(1);
    expect(panel._startTileUrl).toBe('');
    const navigated = [];
    panel.navigate = (url) => navigated.push(url);
    const tile = panel._topSiteTiles[0];
    const point = pointForCanvasPx(panel, tile.x + tile.w / 2, tile.y + tile.h / 2);
    panel._onContentSelect(point);
    expect(navigated).toEqual(['https://example.com/']);
  });

  test('no startPageProvider -> previous behaviour (no tiles, nothing drawn)', () => {
    const panel = makePanel({ topSitesProvider: () => [] });
    expect(panel._topSiteTiles).toHaveLength(0);
    expect(panel._startTileUrl).toBe('');
  });
});
