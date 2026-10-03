/**
 * Unit tests for FFRSystem (fixed foveated rendering).
 *
 * First-principles audit (Musk lens): the system must drive the layer the
 * compositor actually displays — three.js's base layer via
 * `renderer.xr.setFoveation()` — not a freshly-created XRProjectionLayer that
 * is never committed to session.updateRenderState().
 *
 * These tests exercise the renderer.xr path: initialize(session, renderer)
 * must return a boolean, must detect support on the layer three.js installed
 * (`renderer.xr.getBaseLayer()`), and every intensity write must reach
 * `renderer.xr.setFoveation()` — the same call three.js itself makes and
 * re-applies on each session start.
 */

const { FFRSystem } = require('../src/vr/rendering/FFRSystem.js');

function makeLayer(fixedFoveation) {
  return { fixedFoveation };
}

function makeRenderer(layer) {
  return {
    xr: {
      setFoveation: jest.fn(),
      getBaseLayer: jest.fn(() => layer)
    }
  };
}

function makeSession() {
  return { renderState: {} };
}

let warnSpy;
beforeEach(() => {
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

// ── initialize() ─────────────────────────────────────────────────────────────

describe('initialize', () => {
  test('returns true and marks enabled+supported when the installed base layer reports numeric fixedFoveation', async () => {
    const ffr = new FFRSystem();
    const renderer = makeRenderer(makeLayer(0));
    const ok = await ffr.initialize(makeSession(), renderer);
    expect(ok).toBe(true);
    expect(ffr.enabled).toBe(true);
    expect(ffr.getStatus().supported).toBe(true);
  });

  test('returns false when the base layer is absent', async () => {
    const ffr = new FFRSystem();
    const renderer = makeRenderer(null);
    const ok = await ffr.initialize(makeSession(), renderer);
    expect(ok).toBe(false);
    expect(ffr.enabled).toBe(false);
  });

  test('returns false when fixedFoveation is null (runtime lacks the attribute)', async () => {
    const ffr = new FFRSystem();
    const renderer = makeRenderer(makeLayer(null));
    const ok = await ffr.initialize(makeSession(), renderer);
    expect(ok).toBe(false);
    expect(ffr.enabled).toBe(false);
  });

  test('returns false when renderer/xr is missing', async () => {
    const ffr = new FFRSystem();
    expect(await ffr.initialize(makeSession(), null)).toBe(false);
    expect(await ffr.initialize(null, makeRenderer(makeLayer(0)))).toBe(false);
  });
});

// ── enable / disable route through renderer.xr.setFoveation ──────────────────

describe('enable/disable write to the displayed layer', () => {
  test('enable writes the clamped intensity to renderer.xr.setFoveation', async () => {
    const ffr = new FFRSystem();
    const renderer = makeRenderer(makeLayer(0));
    await ffr.initialize(makeSession(), renderer);
    ffr.enable(0.6);
    expect(renderer.xr.setFoveation).toHaveBeenLastCalledWith(0.6);
    expect(ffr.intensity).toBeCloseTo(0.6);
  });

  test('enable clamps out-of-range intensity', async () => {
    const ffr = new FFRSystem();
    const renderer = makeRenderer(makeLayer(0));
    await ffr.initialize(makeSession(), renderer);
    ffr.enable(1.5);
    expect(renderer.xr.setFoveation).toHaveBeenLastCalledWith(1);
    ffr.enable(-0.5);
    expect(renderer.xr.setFoveation).toHaveBeenLastCalledWith(0);
  });

  test('disable writes 0 foveation', async () => {
    const ffr = new FFRSystem();
    const renderer = makeRenderer(makeLayer(0));
    await ffr.initialize(makeSession(), renderer);
    ffr.enable(0.7);
    ffr.disable();
    expect(renderer.xr.setFoveation).toHaveBeenLastCalledWith(0);
  });

  test('enable before initialize warns and writes nothing', () => {
    const ffr = new FFRSystem();
    const renderer = makeRenderer(makeLayer(0));
    ffr.enable(0.5);
    expect(renderer.xr.setFoveation).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  test('a failed initialize leaves every writer a no-op', async () => {
    const ffr = new FFRSystem();
    const renderer = makeRenderer(makeLayer(null));
    await ffr.initialize(makeSession(), renderer);
    ffr.enable(0.5);
    ffr.setDynamicFFR(0.9);
    ffr.adjustIntensity(0.1);
    ffr.updatePredictedGazeFoveation();
    expect(renderer.xr.setFoveation).not.toHaveBeenCalled();
  });
});

// ── Load-driven + gaze-driven adjustments ────────────────────────────────────

describe('dynamic intensity adjustments', () => {
  test('adjustIntensity moves intensity by delta, clamped, and writes it', async () => {
    const ffr = new FFRSystem();
    const renderer = makeRenderer(makeLayer(0));
    await ffr.initialize(makeSession(), renderer);
    ffr.enable(0.5);
    ffr.adjustIntensity(0.2);
    expect(renderer.xr.setFoveation).toHaveBeenLastCalledWith(0.7);
    ffr.adjustIntensity(-1);
    expect(renderer.xr.setFoveation).toHaveBeenLastCalledWith(0);
  });

  test('setDynamicFFR drifts toward 0.8 under heavy GPU load', async () => {
    const ffr = new FFRSystem();
    const renderer = makeRenderer(makeLayer(0));
    await ffr.initialize(makeSession(), renderer);
    ffr.enable(0.5);
    ffr.setDynamicFFR(0.95);
    // 0.5 + (0.8 - 0.5) * 0.1 = 0.53
    expect(ffr.intensity).toBeCloseTo(0.53);
    expect(renderer.xr.setFoveation).toHaveBeenLastCalledWith(0.53);
  });

  test('still head increases foveation (fixation → safe to soften edges)', async () => {
    const ffr = new FFRSystem();
    const renderer = makeRenderer(makeLayer(0));
    await ffr.initialize(makeSession(), renderer);
    ffr.enable(0.5);
    const q = { x: 0, y: 0, z: 0, w: 1 };
    ffr.trackHeadPose(q, 1 / 60);
    ffr.trackHeadPose(q, 1 / 60); // identical → velocity 0
    ffr.updatePredictedGazeFoveation();
    // drift toward 0.8: 0.5 + 0.3*0.1 = 0.53
    expect(ffr.intensity).toBeCloseTo(0.53);
    expect(renderer.xr.setFoveation).toHaveBeenLastCalledWith(0.53);
  });

  test('fast head motion lowers foveation (scanning → keep edges sharp)', async () => {
    const ffr = new FFRSystem();
    const renderer = makeRenderer(makeLayer(0));
    await ffr.initialize(makeSession(), renderer);
    ffr.enable(0.5);
    ffr.trackHeadPose({ x: 0, y: 0, z: 0, w: 1 }, 1 / 60);
    // ~180° rotation in one frame → high angular velocity → target 0.2
    ffr.trackHeadPose({ x: 0, y: 1, z: 0, w: 0 }, 1 / 60);
    ffr.updatePredictedGazeFoveation();
    // drift toward 0.2: 0.5 - 0.3*0.1 = 0.47
    expect(ffr.intensity).toBeCloseTo(0.47);
    expect(renderer.xr.setFoveation).toHaveBeenLastCalledWith(expect.closeTo(0.47, 5));
  });
});

// ── Lifecycle ────────────────────────────────────────────────────────────────

describe('dispose', () => {
  test('dispose zeroes foveation and detaches', async () => {
    const ffr = new FFRSystem();
    const renderer = makeRenderer(makeLayer(0));
    await ffr.initialize(makeSession(), renderer);
    ffr.enable(0.5);
    ffr.dispose();
    expect(renderer.xr.setFoveation).toHaveBeenLastCalledWith(0);
    expect(ffr.enabled).toBe(false);
    renderer.xr.setFoveation.mockClear();
    ffr.enable(0.5);
    expect(renderer.xr.setFoveation).not.toHaveBeenCalled();
  });

  test('getStatus reports supported after a successful initialize', async () => {
    const ffr = new FFRSystem();
    const renderer = makeRenderer(makeLayer(0));
    await ffr.initialize(makeSession(), renderer);
    expect(ffr.getStatus()).toEqual(expect.objectContaining({ enabled: true, supported: true }));
  });
});
