/**
 * FFRSystem — fixed-foveated-rendering state machine (52% covered; the
 * dynamic-FFR tiers, head-velocity EMA and predicted-gaze foveation were
 * unexercised). XRWebGLBinding is stubbed; the layer is a plain object.
 */

const makeBinding = (supported = true) => {
  const layer = supported ? { fixedFoveation: 0 } : {};
  return { layer, binding: jest.fn(() => ({ getProjectionLayer: () => layer })) };
};

let FFRSystem;
beforeAll(() => {
  ({ FFRSystem } = require('../src/vr/rendering/FFRSystem.js'));
});

const boot = async (supported = true) => {
  const { layer, binding } = makeBinding(supported);
  global.XRWebGLBinding = binding;
  const ffr = new FFRSystem();
  const ok = await ffr.initialize({ s: 1 }, { gl: 1 });
  delete global.XRWebGLBinding;
  return { ffr, layer, ok };
};

describe('FFRSystem — initialize/enable/disable', () => {
  test('initialize rejects missing session/gl', async () => {
    const ffr = new FFRSystem();
    expect(await ffr.initialize(null, null)).toBe(false);
    expect(ffr.enabled).toBe(false);
  });

  test('initialize returns false when fixedFoveation is unsupported', async () => {
    const { ok, ffr } = await boot(false);
    expect(ok).toBe(false);
    expect(ffr.enabled).toBe(false);
  });

  test('enable writes clamped intensity to the projection layer', async () => {
    const { ffr, layer, ok } = await boot();
    expect(ok).toBe(true);
    ffr.enable(0.7);
    expect(layer.fixedFoveation).toBeCloseTo(0.7);
    ffr.enable(5);   // clamps to 1
    expect(layer.fixedFoveation).toBe(1);
    ffr.enable(-2);  // clamps to 0
    expect(layer.fixedFoveation).toBe(0);
  });

  test('enable/disable no-op before initialization', () => {
    const ffr = new FFRSystem();
    expect(() => {
      ffr.enable(); ffr.disable();
    }).not.toThrow();
  });

  test('disable writes 0 to the layer', async () => {
    const { ffr, layer } = await boot();
    ffr.enable(0.9);
    ffr.disable();
    expect(layer.fixedFoveation).toBe(0);
  });
});

describe('FFRSystem — intensity control', () => {
  test('adjustIntensity nudges and clamps', async () => {
    const { ffr, layer } = await boot();
    ffr.enable(0.5);
    ffr.adjustIntensity(0.2);
    expect(ffr.intensity).toBeCloseTo(0.7);
    ffr.adjustIntensity(10);
    expect(ffr.intensity).toBe(1);
    ffr.adjustIntensity(-10);
    expect(ffr.intensity).toBe(0);
    expect(layer.fixedFoveation).toBe(0);
  });
});

describe('FFRSystem — head-velocity predicted gaze foveation (FR-4.2)', () => {
  const IDENT = { x: 0, y: 0, z: 0, w: 1 };
  const TILT = { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }; // 90° about X

  test('first pose only seeds; velocity starts at 0', async () => {
    const { ffr } = await boot();
    ffr.trackHeadPose(IDENT, 0.016);
    expect(ffr._headVelocity).toBe(0);
    expect(ffr.predictedGazeEnabled).toBe(false);
  });

  test('a 90° turn in 0.1s yields large angular velocity via the attack envelope', async () => {
    const { ffr } = await boot();
    ffr.trackHeadPose(IDENT, 0.016);
    ffr.trackHeadPose(TILT, 0.1);
    // angleDelta = 2·acos(√2/2) ≈ 1.5708 rad → ~15.7 rad/s. The attack
    // envelope (τ=0.07s) lets ~76% through in one 0.1s step — the old fixed
    // 20%-per-call EMA under-reported the same gesture at a long dt.
    expect(ffr._headVelocity).toBeCloseTo(11.9, 1);
    expect(ffr.predictedGazeEnabled).toBe(true);
  });

  test('head-velocity envelope attacks fast and releases slowly', async () => {
    const { ffr } = await boot();
    ffr.trackHeadPose(IDENT, 0.016);
    ffr.trackHeadPose(TILT, 0.1);        // one 0.1s attack step → ~76% through
    const peak = ffr._headVelocity;
    expect(peak).toBeGreaterThan(10);
    ffr.trackHeadPose(IDENT, 0.1);       // one 0.1s release step at τ=0.3s
    const decayFrac = 1 - ffr._headVelocity / peak;
    // Release keeps ~72% — visibly slower than the ~76% attack step, so a
    // brief flick can't pull the periphery's resolution back up twice.
    expect(decayFrac).toBeLessThan(0.4);
  });

  test('still head drives foveation up; fast head drives it down', async () => {
    const { ffr, layer } = await boot();
    ffr.enable(0.5);
    ffr.trackHeadPose(IDENT, 0.016);
    ffr.trackHeadPose(IDENT, 0.016); // zero delta → velocity → 0
    for (let i = 0; i < 100; i++) {
      ffr.trackHeadPose(IDENT, 0.016); ffr.updatePredictedGazeFoveation();
    }
    expect(layer.fixedFoveation).toBeCloseTo(0.8, 1); // fixation → aggressive

    ffr.trackHeadPose(IDENT, 0.016);
    for (let i = 0; i < 100; i++) {
      // Alternate poses so every step is a large angular delta (~32 rad/s).
      ffr.trackHeadPose(i % 2 ? IDENT : TILT, 0.05);
      ffr.updatePredictedGazeFoveation();
    }
    expect(layer.fixedFoveation).toBeCloseTo(0.2, 1); // scanning → gentle
  });

  test('dispose clears enabled and unwinds foveation', async () => {
    const { ffr, layer } = await boot();
    ffr.enable(0.4);
    expect(ffr.enabled).toBe(true);
    ffr.dispose();
    expect(ffr._baseFoveation).toBe(false);
    expect(layer.fixedFoveation).toBe(0);
    expect(ffr.enabled).toBe(false);
  });
});

describe('FFRSystem — remaining init/guard arms', () => {
  test('initialize returns false when getProjectionLayer() yields null', async () => {
    global.XRWebGLBinding = jest.fn(() => ({ getProjectionLayer: () => null }));
    const ffr = new FFRSystem();
    expect(await ffr.initialize({ s: 1 }, { gl: 1 })).toBe(false);
    delete global.XRWebGLBinding;
  });

  test('initialize returns false when XRWebGLBinding ctor throws', async () => {
    global.XRWebGLBinding = jest.fn(() => {
      throw new Error('no binding');
    });
    const ffr = new FFRSystem();
    expect(await ffr.initialize({ s: 1 }, { gl: 1 })).toBe(false);
    delete global.XRWebGLBinding;
  });

  test('base-layer fallback: foveation still works when XRWebGLBinding is unavailable', async () => {
    // Runtime without the 'layers' grant: XRWebGLBinding ctor throws, but the
    // base XRWebGLLayer still carries fixedFoveation via xr.setFoveation.
    global.XRWebGLBinding = jest.fn(() => {
      throw new Error('no binding');
    });
    const setFoveation = jest.fn();
    const xrManager = { setFoveation };
    const session = {
      renderState: { baseLayer: { fixedFoveation: 0 } }
    };
    const ffr = new FFRSystem();
    expect(await ffr.initialize(session, { gl: 1 }, xrManager)).toBe(true);
    expect(ffr.enabled).toBe(true);
    expect(ffr.projectionLayer).toBeNull();
    expect(ffr._baseFoveation).toBe(true);

    ffr.enable(0.7);
    expect(setFoveation).toHaveBeenCalledWith(0.7);
    ffr.adjustIntensity(-0.2);
    expect(setFoveation.mock.calls.at(-1)[0]).toBeCloseTo(0.5);
    ffr.disable();
    expect(setFoveation).toHaveBeenLastCalledWith(0);
    delete global.XRWebGLBinding;
  });

  test('dual-write: projection layer AND base layer both receive foveation', async () => {
    const { layer, binding } = makeBinding(true);
    global.XRWebGLBinding = binding;
    const setFoveation = jest.fn();
    const xrManager = { setFoveation };
    const session = { s: 1, renderState: { baseLayer: { fixedFoveation: 0 } } };
    const ffr = new FFRSystem();
    expect(await ffr.initialize(session, { gl: 1 }, xrManager)).toBe(true);

    ffr.enable(0.6);
    expect(layer.fixedFoveation).toBe(0.6);
    expect(setFoveation).toHaveBeenCalledWith(0.6);
    delete global.XRWebGLBinding;
  });

  test('adjustIntensity is a no-op before initialize and clamps to [0,1] after', async () => {
    const ffr = new FFRSystem();
    ffr.adjustIntensity(0.5); // guard arm — no throw, no state change
    expect(ffr.intensity).toBe(0.5); // still the constructor default

    const { ffr: on } = await boot(true);
    on.enable(0.9);
    on.adjustIntensity(0.5);
    expect(on.intensity).toBe(1); // clamped at the top
    on.adjustIntensity(-2);
    expect(on.intensity).toBe(0); // clamped at the bottom
  });

  test('updatePredictedGazeFoveation is a no-op when predicted gaze is off', () => {
    const ffr = new FFRSystem();
    expect(() => ffr.updatePredictedGazeFoveation()).not.toThrow();
  });
});

describe('FFRSystem — compositor write dedup (fixedFoveation is state, not a per-frame push)', () => {
  const IDENT = { x: 0, y: 0, z: 0, w: 1 };
  test('writes stop once the adaptive level has converged', async () => {
    const { layer, binding } = makeBinding(true);
    global.XRWebGLBinding = binding;
    const ffr = new FFRSystem();
    await ffr.initialize({ s: 1 }, { gl: 1 });
    delete global.XRWebGLBinding;

    let writes = 0;
    let val = layer.fixedFoveation;
    Object.defineProperty(layer, 'fixedFoveation', {
      get: () => val,
      set: (v) => {
        writes += 1;
        val = v;
      }
    });

    ffr.enable(0.5);
    expect(writes).toBe(1); // the enable write always lands

    ffr.trackHeadPose(IDENT, 0.016);
    ffr.trackHeadPose(IDENT, 0.016);
    for (let i = 0; i < 300; i++) {
      ffr.trackHeadPose(IDENT, 0.016);
      ffr.updatePredictedGazeFoveation(0.016);
    }
    const afterConverge = writes;
    expect(afterConverge).toBeGreaterThan(1); // it did write while chasing the target

    for (let i = 0; i < 50; i++) {
      ffr.trackHeadPose(IDENT, 0.016);
      ffr.updatePredictedGazeFoveation(0.016);
    }
    expect(writes).toBe(afterConverge); // converged: deadband stops the churn
  });

  test('a settled session is not reconfigured by sub-deadband nudges', async () => {
    const { layer, binding } = makeBinding(true);
    global.XRWebGLBinding = binding;
    const ffr = new FFRSystem();
    await ffr.initialize({ s: 1 }, { gl: 1 });
    delete global.XRWebGLBinding;

    let writes = 0;
    let val = layer.fixedFoveation;
    Object.defineProperty(layer, 'fixedFoveation', {
      get: () => val,
      set: (v) => {
        writes += 1;
        val = v;
      }
    });

    ffr.enable(0.5);
    const w0 = writes;
    ffr.adjustIntensity(0.005); // < 2% deadband — sub-perceptual, must not write
    expect(writes).toBe(w0);
    expect(layer.fixedFoveation).toBeCloseTo(0.5);
    ffr.adjustIntensity(0.05);  // past the deadband — a real level change lands
    expect(writes).toBe(w0 + 1);
    expect(layer.fixedFoveation).toBeCloseTo(0.555);
  });
});
