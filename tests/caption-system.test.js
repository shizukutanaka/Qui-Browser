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

  test('long captions wrap across rows instead of being cut at one line', () => {
    cs.setEnabled(true);
    const sentence = 'the quick brown fox jumps over the lazy dog and keeps on running';
    expect(() => cs.show(sentence)).not.toThrow();
    const rows = cs._wrap(sentence, 34);
    expect(rows.length).toBeGreaterThan(1);
    rows.forEach(r => expect(r.length).toBeLessThanOrEqual(34));
    // No information lost: the words rejoin to the original.
    expect(rows.join(' ')).toBe(sentence);
  });

  test('_wrap hard-splits a word longer than a row', () => {
    const rows = cs._wrap('x'.repeat(80), 34);
    expect(rows.length).toBe(3); // 34 + 34 + 12
    rows.forEach(r => expect(r.length).toBeLessThanOrEqual(34));
    expect(rows.join('')).toBe('x'.repeat(80));
  });

  test('_layoutRows caps a caption at two rows with an ellipsis', () => {
    cs.setEnabled(true);
    cs.show(Array(20).fill('word').join(' ')); // far more than 2 rows worth
    const laid = cs._layoutRows();
    expect(laid.length).toBe(2);
    expect(laid[1].text.endsWith('…')).toBe(true);
  });

  test('scale defaults to 1 with the baseline font cap and wrap width', () => {
    expect(cs.scale).toBe(1);
    expect(cs._wrapChars()).toBe(34);
    expect(cs._fontSizeFor(1)).toBe(44); // single line → full 44px cap
  });

  test('a larger scale raises the font cap and wraps sooner (low vision)', () => {
    const big = new CaptionSystem(makeCamera(), { scale: 1.5 });
    expect(big._fontSizeFor(1)).toBe(66);          // 44 * 1.5
    expect(big._wrapChars()).toBe(23);             // round(34 / 1.5)
    expect(big._wrapChars()).toBeLessThan(cs._wrapChars());
  });

  test('setScale clamps to a sane range and redraws', () => {
    expect(cs.setScale(10)).toBe(3);    // clamped up
    expect(cs.setScale(0.1)).toBe(0.5); // clamped down
    expect(cs.setScale(1.4)).toBeCloseTo(1.4, 5);
  });

  test('font never drops below the floor even when many rows stack', () => {
    const big = new CaptionSystem(makeCamera(), { scale: 1.5 });
    expect(big._fontSizeFor(6)).toBeGreaterThanOrEqual(22);
  });

  test('dispose() detaches the mesh from the camera', () => {
    cs.dispose();
    expect(cam.remove).toHaveBeenCalled();
    expect(cs.mesh).toBeNull();
  });
});
