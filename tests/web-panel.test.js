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
  });
});
