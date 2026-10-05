/**
 * Round-842 dead-surface pins (untouched files only):
 *  - CaptionSystem._dirty was a write-only flag: set in show()/clear()/constructor,
 *    cleared at the end of _draw(), but never read — _draw() is invoked
 *    unconditionally wherever a redraw is needed. Removed.
 *  - panelGeometry.CHROME_CANVAS_H was exported but had zero readers in src or
 *    tests (WebPanel derives the same expression inline). Removed.
 *
 * These tests fail while the dead surface exists and pass after removal, and
 * pin the surrounding live behaviour so the removals stay safe.
 */

jest.mock('three', () => {
  class MockGeometry {
    dispose() {}
  }
  class MockMaterial {
    constructor(opts) {
      Object.assign(this, opts);
    }
    dispose() {}
  }
  class MockMesh {
    constructor(geo, mat) {
      this.geometry = geo;
      this.material = mat;
      this.position = { set: jest.fn(), y: 0 };
      this.visible = true;
      this.renderOrder = 0;
      this.name = '';
    }
  }
  class MockCanvasTexture {
    constructor(c) {
      this.image = c;
      this.needsUpdate = false;
    }
    dispose() {}
  }
  return {
    PlaneGeometry: MockGeometry,
    MeshBasicMaterial: MockMaterial,
    Mesh: MockMesh,
    CanvasTexture: MockCanvasTexture,
    SRGBColorSpace: 'srgb'
  };
});

function makeCtx() {
  return {
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    fillText: jest.fn(),
    beginPath: jest.fn(),
    roundRect: jest.fn(),
    fill: jest.fn(),
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1
  };
}
global.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => makeCtx() })
};

const { CaptionSystem } = require('../src/vr/accessibility/CaptionSystem.js');
const panelGeometry = require('../src/vr/browser/panelGeometry.js');

function makeCamera() {
  return { add: jest.fn(), remove: jest.fn() };
}

describe('round-842 dead surface', () => {
  test('CaptionSystem carries no write-only _dirty flag', () => {
    const cs = new CaptionSystem(makeCamera());
    cs.show('hello');
    cs.clear();
    cs.update(500);
    expect('_dirty' in cs).toBe(false);
  });

  test('panelGeometry exports no unread CHROME_CANVAS_H', () => {
    expect('CHROME_CANVAS_H' in panelGeometry).toBe(false);
  });
});

describe('live behaviour pinned across the removals', () => {
  test('show/lastLine/clear still work without the flag', () => {
    const cs = new CaptionSystem(makeCamera(), { lineDuration: 1000 });
    cs.show('first');
    expect(cs.lastLine()).toBe('first');
    cs.clear();
    expect(cs.lastLine()).toBeNull();
  });

  test('chrome canvas width still derived and exported for tests', () => {
    expect(panelGeometry.CHROME_CANVAS_W).toBe(1024);
    expect(panelGeometry.CHROME_M_H).toBeCloseTo(0.08);
  });
});
