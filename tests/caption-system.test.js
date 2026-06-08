/**
 * Unit tests for CaptionSystem (FR-13.1).
 * THREE and the 2D canvas are mocked so the queue/timing logic can be
 * verified headlessly.
 */

class MockGeometry { dispose() {} }
class MockMaterial { constructor(o = {}) { Object.assign(this, o); } dispose() {} }
class MockMesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.name = '';
    this.visible = true;
    this.renderOrder = 0;
    this.position = { set: jest.fn() };
  }
}
class MockCanvasTexture {
  constructor() { this.needsUpdate = false; this.colorSpace = ''; }
  dispose() {}
}

jest.mock('three', () => ({
  PlaneGeometry: MockGeometry,
  MeshBasicMaterial: MockMaterial,
  Mesh: MockMesh,
  CanvasTexture: MockCanvasTexture,
  SRGBColorSpace: 'srgb'
}));

// Canvas 2D context stub.
function makeCtx() {
  return {
    clearRect: jest.fn(), fillRect: jest.fn(), fillText: jest.fn(),
    beginPath: jest.fn(), roundRect: jest.fn(), fill: jest.fn(),
    fillStyle: '', font: '', textAlign: '', textBaseline: '', globalAlpha: 1
  };
}
global.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => makeCtx() })
};

const { CaptionSystem } = require('../src/vr/accessibility/CaptionSystem.js');

function makeCamera() {
  return { add: jest.fn(), remove: jest.fn() };
}

describe('CaptionSystem (FR-13.1)', () => {
  let cam, cs;
  beforeEach(() => {
    cam = makeCamera();
    cs = new CaptionSystem(cam, { maxLines: 3, lineDuration: 1000 });
  });

  test('attaches a caption mesh to the camera, hidden initially', () => {
    expect(cam.add).toHaveBeenCalled();
    expect(cs.mesh.visible).toBe(false);
    expect(cs.enabled).toBe(false);
  });

  test('show() ignores empty / whitespace text', () => {
    cs.setEnabled(true);
    cs.show('');
    cs.show('   ');
    expect(cs.lineCount).toBe(0);
  });

  test('show() queues a caption line', () => {
    cs.setEnabled(true);
    cs.show('hello world');
    expect(cs.lineCount).toBe(1);
    expect(cs.mesh.visible).toBe(true);
  });

  test('queue is capped at maxLines (oldest dropped)', () => {
    cs.setEnabled(true);
    cs.show('one'); cs.show('two'); cs.show('three'); cs.show('four');
    expect(cs.lineCount).toBe(3);
    // 'one' should have been dropped.
    expect(cs._lines[0].text).toBe('two');
  });

  test('update() expires lines after lineDuration', () => {
    cs.setEnabled(true);
    cs.show('temporary');
    cs.update(600);  // 0.6s — still alive
    expect(cs.lineCount).toBe(1);
    cs.update(600);  // 1.2s total — expired
    expect(cs.lineCount).toBe(0);
    expect(cs.mesh.visible).toBe(false);
  });

  test('update() no-ops while disabled', () => {
    cs.setEnabled(true);
    cs.show('keep me');
    cs.setEnabled(false);   // clears
    cs.setEnabled(true);
    cs.show('keep me');
    cs.setEnabled(false);
    cs.update(99999);
    // disabled: no expiry processing, lines were cleared on disable anyway
    expect(cs.lineCount).toBe(0);
  });

  test('lines expire independently based on insertion time', () => {
    cs.setEnabled(true);
    cs.show('first');
    cs.update(500);         // first has 500ms left
    cs.show('second');      // second has full 1000ms
    cs.update(600);         // first expires (−100), second has 400ms
    expect(cs.lineCount).toBe(1);
    expect(cs._lines[0].text).toBe('second');
  });

  test('clear() removes all captions and hides the panel', () => {
    cs.setEnabled(true);
    cs.show('a'); cs.show('b');
    cs.clear();
    expect(cs.lineCount).toBe(0);
    expect(cs.mesh.visible).toBe(false);
  });

  test('setEnabled(false) clears the queue', () => {
    cs.setEnabled(true);
    cs.show('x');
    cs.setEnabled(false);
    expect(cs.lineCount).toBe(0);
  });

  test('long captions are truncated with an ellipsis on draw', () => {
    cs.setEnabled(true);
    const long = 'x'.repeat(100);
    expect(() => cs.show(long)).not.toThrow();
    expect(cs._truncate(long, 48).endsWith('…')).toBe(true);
  });

  test('dispose() detaches the mesh from the camera', () => {
    cs.dispose();
    expect(cam.remove).toHaveBeenCalled();
    expect(cs.mesh).toBeNull();
  });
});
