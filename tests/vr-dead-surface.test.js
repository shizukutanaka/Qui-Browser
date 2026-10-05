/**
 * Dead public surface guard (round 836).
 *
 * These members had zero call sites anywhere in src/ or tests/ — speculative
 * extension points that were never wired up (YAGNI):
 *   - ComfortSystem.getStatus / FFRSystem.getStatus / FFRSystem.setThresholds
 *   - WebPanel.onDomOverlayStart / onDomOverlayEnd / domOverlaySupported
 *
 * The tests pin their absence so the stubs cannot silently come back.
 */

// ── THREE stub (same pattern as webpanel-states.test.js) ─────────────────────
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
  Vector3: class {},
  PlaneGeometry: class {
    dispose() {}
  },
  MeshBasicMaterial: class {
    dispose() {}
  },
  ShaderMaterial: class {
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

// ── canvas / document stub ────────────────────────────────────────────────────
const ctx2d = {
  clearRect() {},
  fillRect() {},
  strokeRect() {},
  beginPath() {},
  arc() {},
  fill() {},
  fillText() {},
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
      return {
        src: '',
        style: { cssText: '' },
        onload: null,
        onerror: null,
        setAttribute() {}
      };
    }
    return {};
  },
  body: { appendChild() {}, removeChild() {} }
};

const { FFRSystem } = require('../src/vr/rendering/FFRSystem.js');
const { ComfortSystem } = require('../src/vr/comfort/ComfortSystem.js');
const { WebPanel } = require('../src/vr/browser/WebPanel.js');

function makePanel() {
  return new WebPanel({
    scene: { add() {}, remove() {} },
    registerInteractable() {},
    unregisterInteractable() {}
  });
}

describe('dead diagnostic surface is gone', () => {
  test('FFRSystem exposes no getStatus/setThresholds (zero call sites)', () => {
    const ffr = new FFRSystem();
    expect(ffr.getStatus).toBeUndefined();
    expect(ffr.setThresholds).toBeUndefined();
  });

  test('ComfortSystem exposes no getStatus (zero call sites)', () => {
    const comfort = new ComfortSystem(null, { fov: 90 }, null);
    expect(comfort.getStatus).toBeUndefined();
  });

  test('WebPanel dom-overlay stubs are gone', () => {
    expect(WebPanel.prototype.onDomOverlayStart).toBeUndefined();
    expect(WebPanel.prototype.onDomOverlayEnd).toBeUndefined();
    const panel = makePanel();
    expect(panel.domOverlaySupported).toBeUndefined();
  });
});
