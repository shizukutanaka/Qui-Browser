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
    class ThrowingBinding {
      constructor() {
        throw new Error('not allowed');
      }
    }
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

  test('removeLayer() destroys the layer — tab churn must not leak GPU layers', () => {
    ls.initialize(session, gl);
    const layer = ls.createQuadLayer({ id: 'a', space: {}, width: 1, height: 1 });
    layer.destroy = jest.fn();
    ls.removeLayer('a', session, null);
    expect(layer.destroy).toHaveBeenCalledTimes(1);
  });

  test('removeLayer() tolerates a layer without destroy() and a destroy() that throws', () => {
    ls.initialize(session, gl);
    ls.createQuadLayer({ id: 'a', space: {}, width: 1, height: 1 }); // no destroy fn
    const layer = ls.createQuadLayer({ id: 'b', space: {}, width: 1, height: 1 });
    layer.destroy = () => {
      throw new Error('session already ended');
    };
    expect(() => ls.removeLayer('a', session, null)).not.toThrow();
    expect(() => ls.removeLayer('b', session, null)).not.toThrow();
    expect(ls.count).toBe(0);
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

  test('dispose() destroys every registered layer — subsystem teardown frees GPU backing', () => {
    ls.initialize(session, gl);
    const a = ls.createQuadLayer({ id: 'a', space: {}, width: 1, height: 1 });
    const b = ls.createQuadLayer({ id: 'b', space: {}, width: 1, height: 1 });
    a.destroy = jest.fn();
    b.destroy = jest.fn();
    ls.dispose();
    expect(a.destroy).toHaveBeenCalledTimes(1);
    expect(b.destroy).toHaveBeenCalledTimes(1);
    expect(ls.count).toBe(0);
  });
});

describe('LayersSystem renderCanvasToLayer + error paths', () => {
  let ls, gl, session;
  beforeEach(() => {
    ls = new LayersSystem();
    gl = makeGL();
    session = makeSession();
    lastBinding = null;
  });

  test('blits the canvas into each view\'s sub-image, then unbinds', () => {
    ls.initialize(session, gl);
    const layer = ls.createQuadLayer({ id: 'p', space: {}, width: 1, height: 1 });
    const source = { _canvas: true };
    ls.renderCanvasToLayer(layer, source, {}, [{}, {}]);
    expect(gl.bindFramebuffer).toHaveBeenCalledTimes(3); // per-view + final null
    expect(gl.viewport).toHaveBeenCalledTimes(2);
    expect(gl.bindTexture).toHaveBeenCalledTimes(2);
    expect(gl.texSubImage2D).toHaveBeenCalledTimes(2);
    // finally: framebuffer released
    expect(gl.bindFramebuffer).toHaveBeenLastCalledWith(gl.FRAMEBUFFER, null);
  });

  test('views without a sub-image framebuffer are skipped, others still blit', () => {
    ls.initialize(session, gl);
    const layer = ls.createQuadLayer({ id: 'p', space: {}, width: 1, height: 1 });
    const orig = ls.glBinding.getViewSubImage.bind(ls.glBinding);
    let i = 0;
    ls.glBinding.getViewSubImage = (l, v) =>
      i++ === 0 ? { framebuffer: null } : orig(l, v);
    ls.renderCanvasToLayer(layer, {}, {}, [{}, {}]);
    expect(gl.texSubImage2D).toHaveBeenCalledTimes(1);
  });

  test('a GL failure warns once, not per-call', () => {
    ls.initialize(session, gl);
    const layer = ls.createQuadLayer({ id: 'p', space: {}, width: 1, height: 1 });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    gl.bindFramebuffer.mockImplementation(() => {
      throw new Error('gl dead');
    });
    ls.renderCanvasToLayer(layer, {}, {}, [{}]);
    ls.renderCanvasToLayer(layer, {}, {}, [{}]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  test('no-ops before initialize / without gl / without views', () => {
    const raw = new LayersSystem();
    expect(() => raw.renderCanvasToLayer({}, {}, {}, [{}])).not.toThrow();
    ls.initialize(session, gl);
    ls._gl = null;
    const layer = ls.createQuadLayer({ id: 'p', space: {}, width: 1, height: 1 });
    expect(() => ls.renderCanvasToLayer(layer, {}, {}, [{}])).not.toThrow();
    ls._gl = gl;
    expect(() => ls.renderCanvasToLayer(layer, {}, {}, [])).not.toThrow();
  });

  test('createQuadLayer failure returns null and warns', () => {
    ls.initialize(session, gl);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    ls.glBinding.createQuadLayer = () => {
      throw new Error('unsupported');
    };
    const layer = ls.createQuadLayer({ id: 'x', space: {}, width: 1, height: 1 });
    expect(layer).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('updateRenderState failure warns but does not throw', () => {
    ls.initialize(session, gl);
    session.updateRenderState.mockImplementation(() => {
      throw new Error('gone');
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => ls.updateRenderState(session, null)).not.toThrow();
    expect(warn).toHaveBeenCalledWith('LayersSystem: updateRenderState failed', expect.any(Error));
    warn.mockRestore();
  });
});

test('removeLayer with a live session re-applies render state', () => {
  const ls = new LayersSystem();
  const spy = jest.spyOn(ls, 'updateRenderState').mockImplementation(() => {});
  const session = { updateRenderState: jest.fn() };
  ls.removeLayer('l1', session, 'base');
  expect(spy).toHaveBeenCalledWith(session, 'base');
  spy.mockClear();
  ls.removeLayer('l2');               // no session → guard arm
  expect(spy).not.toHaveBeenCalled();
});

test('renderCanvasToLayer tolerates a layer with no GL binding context', () => {
  const ls = new LayersSystem();
  const layer = { id: 'q', canvas: { width: 4, height: 4, getContext: () => null } };
  ls._layers.set('q', layer);
  expect(() => ls.renderCanvasToLayer('q', null, {})).not.toThrow();
});

describe('LayersSystem — renderCanvasToLayer with a cleared GL context', () => {
  test('dispose() then render is a no-op — the if(gl) finally arm stays quiet', () => {
    const ls = new LayersSystem({ xr: {} });
    ls.dispose();
    expect(() => ls.renderCanvasToLayer({}, {}, {}, [])).not.toThrow();
  });
});
