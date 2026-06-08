/**
 * Unit tests for LayersSystem (FR-1.5).
 *
 * XRWebGLBinding and related WebXR Layers APIs are stubbed so the core logic
 * can be verified without a hardware XR runtime.
 */

// ── XRWebGLBinding stub ───────────────────────────────────────────────────────
let lastBinding = null;

class MockXRWebGLBinding {
  constructor(session, gl) {
    this.session = session;
    this.gl      = gl;
    lastBinding  = this;
  }
  createQuadLayer(init) {
    return {
      _init    : init,
      transform: null,
      width    : init.width,
      height   : init.height
    };
  }
  getViewSubImage(layer, view) {
    return {
      framebuffer  : {},
      colorTexture : {},
      viewport     : { x: 0, y: 0, width: 2048, height: 1280 }
    };
  }
}

// Make it a global so LayersSystem can `typeof XRWebGLBinding`.
global.XRWebGLBinding = MockXRWebGLBinding;

const { LayersSystem } = require('../src/vr/rendering/LayersSystem.js');

function makeGL() {
  return {
    FRAMEBUFFER : 0x8D40,
    RGBA        : 0x1908,
    UNSIGNED_BYTE: 0x1401,
    TEXTURE_2D  : 0x0DE1,
    bindFramebuffer : jest.fn(),
    viewport        : jest.fn(),
    bindTexture     : jest.fn(),
    texSubImage2D   : jest.fn()
  };
}
function makeSession() {
  return { updateRenderState: jest.fn() };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('LayersSystem (FR-1.5)', () => {
  let ls, gl, session;

  beforeEach(() => {
    ls      = new LayersSystem();
    gl      = makeGL();
    session = makeSession();
    lastBinding = null;
  });

  // ── initialize ──────────────────────────────────────────────────────────────

  test('initialize() returns true and sets supported flag', () => {
    const ok = ls.initialize(session, gl);
    expect(ok).toBe(true);
    expect(ls.isSupported).toBe(true);
    expect(ls.glBinding).toBeInstanceOf(MockXRWebGLBinding);
  });

  test('initialize() returns false when session is null', () => {
    expect(ls.initialize(null, gl)).toBe(false);
    expect(ls.isSupported).toBe(false);
  });

  test('initialize() returns false when XRWebGLBinding is absent', () => {
    const saved = global.XRWebGLBinding;
    delete global.XRWebGLBinding;
    expect(ls.initialize(session, gl)).toBe(false);
    global.XRWebGLBinding = saved;
  });

  test('initialize() returns false and does not throw when binding throws', () => {
    class ThrowingBinding { constructor() { throw new Error('not allowed'); } }
    global.XRWebGLBinding = ThrowingBinding;
    expect(() => ls.initialize(session, gl)).not.toThrow();
    expect(ls.isSupported).toBe(false);
    global.XRWebGLBinding = MockXRWebGLBinding;
  });

  // ── createQuadLayer ─────────────────────────────────────────────────────────

  test('createQuadLayer() returns an XRQuadLayer and increments count', () => {
    ls.initialize(session, gl);
    const refSpace = {};
    const layer = ls.createQuadLayer({
      id: 'panel_0', space: refSpace, width: 1.6, height: 0.08
    });
    expect(layer).not.toBeNull();
    expect(layer.width).toBe(1.6);
    expect(ls.count).toBe(1);
  });

  test('createQuadLayer() returns null before initialize()', () => {
    expect(ls.createQuadLayer({ id: 'x', space: {}, width: 1, height: 1 })).toBeNull();
  });

  test('createQuadLayer() sets transform when provided', () => {
    ls.initialize(session, gl);
    const transform = { position: { x: 0, y: 1.5, z: -2 } };
    const layer = ls.createQuadLayer({ id: 'p', space: {}, transform, width: 1, height: 1 });
    expect(layer.transform).toBe(transform);
  });

  // ── removeLayer ─────────────────────────────────────────────────────────────

  test('removeLayer() removes the layer and calls updateRenderState', () => {
    ls.initialize(session, gl);
    ls.createQuadLayer({ id: 'a', space: {}, width: 1, height: 1 });
    ls.createQuadLayer({ id: 'b', space: {}, width: 1, height: 1 });
    ls.removeLayer('a', session, null);
    expect(ls.count).toBe(1);
    expect(session.updateRenderState).toHaveBeenCalled();
  });

  // ── updateRenderState ───────────────────────────────────────────────────────

  test('updateRenderState() passes baseLayer first in layers array', () => {
    ls.initialize(session, gl);
    const base = { type: 'baseLayer' };
    ls.createQuadLayer({ id: 'q', space: {}, width: 1, height: 1 });
    ls.updateRenderState(session, base);
    const call = session.updateRenderState.mock.calls[0][0];
    expect(call.layers[0]).toBe(base);
    expect(call.layers.length).toBe(2);
  });

  test('updateRenderState() no-ops when not supported', () => {
    ls.updateRenderState(session, null); // not initialised
    expect(session.updateRenderState).not.toHaveBeenCalled();
  });

  // ── renderCanvasToLayer ─────────────────────────────────────────────────────

  test('renderCanvasToLayer() calls gl.bindFramebuffer for each view', () => {
    ls.initialize(session, gl);
    const layer  = ls.createQuadLayer({ id: 'c', space: {}, width: 1, height: 1 });
    const canvas = {};
    const frame  = {};
    const views  = [{}, {}];
    ls.renderCanvasToLayer(layer, canvas, frame, views);
    expect(gl.bindFramebuffer).toHaveBeenCalledTimes(views.length + 1); // +1 for null unbind
  });

  test('renderCanvasToLayer() no-ops before initialize()', () => {
    ls.renderCanvasToLayer({}, {}, {}, [{}]);
    expect(gl.bindFramebuffer).not.toHaveBeenCalled();
  });

  // ── dispose ─────────────────────────────────────────────────────────────────

  test('dispose() clears layers and resets state', () => {
    ls.initialize(session, gl);
    ls.createQuadLayer({ id: 'd', space: {}, width: 1, height: 1 });
    ls.dispose();
    expect(ls.count).toBe(0);
    expect(ls.isSupported).toBe(false);
    expect(ls.glBinding).toBeNull();
  });
});
