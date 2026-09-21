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

describe('FFRSystem — dynamic foveation tiers', () => {
  test('GPU load tiers steer intensity toward their targets', async () => {
    const { ffr } = await boot();
    ffr.enable(0);
    for (let i = 0; i < 60; i++) {
      ffr.setDynamicFFR(0.95);
    } // > high
    expect(ffr.intensity).toBeCloseTo(0.8, 1);
    for (let i = 0; i < 60; i++) {
      ffr.setDynamicFFR(0.3);
    }  // below low
    expect(ffr.intensity).toBeCloseTo(0.1, 1);
  });

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

  test('a 90° turn in 0.1s yields large angular velocity via EMA', async () => {
    const { ffr } = await boot();
    ffr.trackHeadPose(IDENT, 0.016);
    ffr.trackHeadPose(TILT, 0.1);
    // angleDelta = 2·acos(√2/2) ≈ 1.5708 rad → ~15.7 rad/s; EMA keeps 20%
    expect(ffr._headVelocity).toBeCloseTo(3.14, 1);
    expect(ffr.predictedGazeEnabled).toBe(true);
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

  test('getStatus reflects enabled/intensity/supported; dispose clears all', async () => {
    const { ffr, layer } = await boot();
    ffr.enable(0.4);
    expect(ffr.getStatus()).toEqual({ enabled: true, intensity: expect.closeTo(0.4), supported: true });
    ffr.dispose();
    expect(ffr.getStatus().supported).toBe(false);
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

  test('setDynamicFFR is a no-op before initialize (guard arm)', async () => {
    const ffr = new FFRSystem();
    expect(() => ffr.setDynamicFFR(0.9)).not.toThrow();
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

test('setDynamicFFR hits medium and low tiers', () => {
  const ffr = new FFRSystem();
  ffr.enabled = true;
  ffr.projectionLayer = { fixedFoveation: 0 };
  const th = ffr.gpuLoadThresholds;
  for (let i = 0; i < 60; i++) {
    ffr.setDynamicFFR((th.medium + th.high) / 2);
  }
  expect(ffr.projectionLayer.fixedFoveation).toBeCloseTo(0.5, 2);
  for (let i = 0; i < 60; i++) {
    ffr.setDynamicFFR((th.low + th.medium) / 2);
  }
  expect(ffr.projectionLayer.fixedFoveation).toBeCloseTo(0.2, 2);
});
