/**
 * WebPanel drawn-vs-live hit-test (the BookmarkPanel #1131 defect class):
 * _drawTopSites paints the provider's list at draw time, but the click handler
 * must resolve the tile against THAT drawn list — re-fetching the provider at
 * click time can navigate to a different site than the one painted under the
 * dwell point.
 */

// ── THREE stub ────────────────────────────────────────────────────────────────
class MockMesh {
  constructor() {
    this.visible = true;
    this.geometry = { dispose() {} };
    this.material = { map: null, dispose() {}, color: { set() {} } };
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
    }
    dispose() {}
  },
  SRGBColorSpace: 'srgb',
  MathUtils: { degToRad: (d) => (d * Math.PI) / 180 }
}));

const ctx2d = {
  clearRect() {},
  fillRect() {},
  fillText() {},
  strokeRect() {},
  beginPath() {},
  arc() {},
  fill() {},
  set fillStyle(v) {},
  set strokeStyle(v) {},
  set font(v) {},
  set textAlign(v) {},
  set lineWidth(v) {},
  set textBaseline(v) {}
};
global.document = {
  createElement(tag) {
    if (tag === 'canvas') {
      return { width: 0, height: 0, getContext: () => ctx2d };
    }
    if (tag === 'iframe') {
      return { src: '', style: { cssText: '' }, onload: null, onerror: null, setAttribute() {} };
    }
    return {};
  },
  body: { appendChild() {}, removeChild() {} }
};

const { WebPanel } = require('../src/vr/browser/WebPanel.js');
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
  const localX = (px / CONTENT_PX_W - 0.5) * 1.6; // PANEL_W
  const localY = (1 - py / CONTENT_PX_H - 0.5) * (1.0 * (1 - 0.08)); // PANEL_H*(1-CHROME_H)
  return {
    x: localX,
    y: localY,
    clone() {
      return this;
    }
  };
}

const SITES_A = [
  { url: 'https://a1.example', title: 'A1', host: 'a1.example' },
  { url: 'https://a2.example', title: 'A2', host: 'a2.example' }
];
const SITES_B = [
  { url: 'https://b1.example', title: 'B1', host: 'b1.example' },
  { url: 'https://b2.example', title: 'B2', host: 'b2.example' }
];

describe('WebPanel drawn top-sites hit-test', () => {
  test('a select resolves the tile against the list painted at draw time, not a re-fetched live list', () => {
    let current = SITES_A;
    const navigated = [];
    const p = makePanel({ topSitesProvider: () => current });
    p.navigate = (u) => navigated.push(u);
    p._drawContent(); // painted SITES_A
    current = SITES_B; // provider's answer changes before the dwell lands
    const r = p._topSiteTiles[1];
    p._onContentSelect(evtAtCanvasPx(r.x + r.w / 2, r.y + r.h / 2));
    expect(navigated).toEqual(['https://a2.example']);
  });

  test('the drawn snapshot is a copy — mutating the provider array in place cannot swap the target', () => {
    const shared = SITES_A.map((s) => ({ ...s }));
    const navigated = [];
    const p = makePanel({ topSitesProvider: () => shared });
    p.navigate = (u) => navigated.push(u);
    p._drawContent();
    // The store mutates the same array it handed out (deleteRow-style churn).
    shared.splice(0, shared.length, ...SITES_B.map((s) => ({ ...s })));
    const r = p._topSiteTiles[1];
    p._onContentSelect(evtAtCanvasPx(r.x + r.w / 2, r.y + r.h / 2));
    expect(navigated).toEqual(['https://a2.example']);
  });

  test('a select after a re-draw resolves against the newest painted list', () => {
    let current = SITES_A;
    const navigated = [];
    const p = makePanel({ topSitesProvider: () => current });
    p.navigate = (u) => navigated.push(u);
    p._drawContent();
    current = SITES_B;
    p._drawContent(); // repaint now shows SITES_B — the snapshot must follow the paint
    const r = p._topSiteTiles[1];
    p._onContentSelect(evtAtCanvasPx(r.x + r.w / 2, r.y + r.h / 2));
    expect(navigated).toEqual(['https://b2.example']);
  });

  test('selecting outside any tile stays a no-op', () => {
    const navigated = [];
    const p = makePanel({ topSitesProvider: () => SITES_A });
    p.navigate = (u) => navigated.push(u);
    p._drawContent();
    p._onContentSelect(evtAtCanvasPx(20, 20));
    expect(navigated).toEqual([]);
  });
});
