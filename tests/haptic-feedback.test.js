/**
 * Unit tests for HapticFeedback.
 * Gamepad API is fully mocked so tests run headlessly.
 */

// Minimal actuator stub that resolves immediately.
const makeActuator = () => ({
  pulse: jest.fn().mockResolvedValue(undefined),
  playEffect: jest.fn().mockResolvedValue(undefined)
});

const makeGamepad = (hand = 'left') => ({
  id: `Mock Controller (${hand})`,
  hand,
  hapticActuators: [makeActuator()]
});

// navigator.getGamepads() stub — replaced per test as needed.
global.navigator = global.navigator || {};
global.navigator.getGamepads = jest.fn(() => []);

const { HapticFeedback } = require('../src/vr/interaction/HapticFeedback.js');

describe('HapticFeedback', () => {
  let hf;

  beforeEach(() => {
    hf = new HapticFeedback();
    // Inject two mock controllers.
    global.navigator.getGamepads = jest.fn(() => [
      makeGamepad('left'),
      makeGamepad('right')
    ]);
    hf.update(); // populate gamepads map
  });

  afterEach(() => {
    global.navigator.getGamepads = jest.fn(() => []);
  });

  // ── construction ─────────────────────────────────────────────────────────────
  test('starts with enabled=true and empty stats', () => {
    const h = new HapticFeedback();
    expect(h.enabled).toBe(true);
    expect(h.stats.pulsesGenerated).toBe(0);
  });

  // ── update / controller detection ────────────────────────────────────────────
  test('update() populates gamepads map from navigator', () => {
    expect(hf.gamepads.size).toBe(2);
    expect(hf.stats.controllersDetected).toBe(2);
  });

  test('update() increments controllersDetected on first detection only', () => {
    hf.update(); // second call — controllers already in map
    expect(hf.stats.controllersDetected).toBe(2);
  });

  test('update() removes disconnected controllers', () => {
    global.navigator.getGamepads = jest.fn(() => [null, null]);
    hf.update();
    expect(hf.gamepads.size).toBe(0);
  });

  // ── XR input-source path ──────────────────────────────────────────────────
  test('update(inputSources) populates from XR sources — navigator list is empty per spec', async () => {
    global.navigator.getGamepads = jest.fn(() => []); // XR pads MUST NOT appear here
    const h = new HapticFeedback();
    const actuator = makeActuator();
    const src = { handedness: 'right', gamepad: { hapticActuators: [actuator] } };
    h.update([src]);
    expect(h.gamepads.size).toBe(1);
    await h.pulse('right', 40, 0.7);
    expect(actuator.pulse).toHaveBeenCalledWith(0.7, 40);
  });

  test('update(inputSources) prunes a source that leaves the session', () => {
    const h = new HapticFeedback();
    const src = { handedness: 'left', gamepad: { hapticActuators: [makeActuator()] } };
    h.update([src]);
    expect(h.gamepads.size).toBe(1);
    h.update([]);
    expect(h.gamepads.size).toBe(0);
  });

  test('hand routing honours handedness — left pulse does not hit the right pad', async () => {
    const h = new HapticFeedback();
    const leftAct = makeActuator();
    const rightAct = makeActuator();
    h.update([
      { handedness: 'left',  gamepad: { hapticActuators: [leftAct] } },
      { handedness: 'right', gamepad: { hapticActuators: [rightAct] } }
    ]);
    await h.pulse('left', 30, 0.5);
    expect(leftAct.pulse).toHaveBeenCalled();
    expect(rightAct.pulse).not.toHaveBeenCalled();
  });

  // ── pulse ─────────────────────────────────────────────────────────────────────
  test('pulse() calls actuator.pulse with clamped values', async () => {
    await hf.pulse('left', 50, 0.5);
    const gamepad = hf.gamepads.get(0);
    expect(gamepad.hapticActuators[0].pulse).toHaveBeenCalledWith(0.5, 50);
    expect(hf.stats.pulsesGenerated).toBe(1);
  });

  test('pulse() clamps intensity to [0, 1]', async () => {
    await hf.pulse('left', 50, 2.0);
    const gamepad = hf.gamepads.get(0);
    const call = gamepad.hapticActuators[0].pulse.mock.calls[0];
    expect(call[0]).toBe(1.0);
  });

  test('pulse() clamps duration to [1, 5000]', async () => {
    await hf.pulse('left', -10, 0.5);
    const gamepad = hf.gamepads.get(0);
    const call = gamepad.hapticActuators[0].pulse.mock.calls[0];
    expect(call[1]).toBe(1);
  });

  test('pulse() is a no-op when disabled', async () => {
    hf.enabled = false;
    await hf.pulse('left', 50, 0.5);
    expect(hf.stats.pulsesGenerated).toBe(0);
  });

  // setEnabled() is the entry point the "Haptics" settings-panel toggle wires
  // to — disabling it must silence every pattern (all route through pulse()).
  test('setEnabled(false) silences pulses; setEnabled(true) restores them', async () => {
    const gamepad = hf.gamepads.get(0); // 'left' controller
    hf.setEnabled(false);
    await hf.playPattern('left', 'click');
    expect(gamepad.hapticActuators[0].pulse).not.toHaveBeenCalled();
    expect(hf.stats.pulsesGenerated).toBe(0);

    hf.setEnabled(true);
    await hf.playPattern('left', 'click');
    expect(gamepad.hapticActuators[0].pulse).toHaveBeenCalled();
    expect(hf.stats.pulsesGenerated).toBeGreaterThan(0);
  });

  test('pulse() is a no-op when gamepads map is empty', async () => {
    hf.gamepads.clear();
    await hf.pulse('left', 50, 0.5);
    expect(hf.stats.pulsesGenerated).toBe(0);
  });

  test('pulse() updates running average intensity', async () => {
    await hf.pulse('left', 50, 0.4);
    await hf.pulse('left', 50, 0.8);
    expect(hf.stats.averageIntensity).toBeCloseTo(0.6, 5);
  });

  // ── playPattern ───────────────────────────────────────────────────────────────
  test('playPattern() plays all steps of a complex pattern', async () => {
    await hf.playPattern('left', 'notification');
    expect(hf.stats.pulsesGenerated).toBe(2);
  });

  test('playPattern() handles simple (non-array) pattern', async () => {
    await hf.playPattern('left', 'click');
    expect(hf.stats.pulsesGenerated).toBe(1);
  });

  test('playPattern() warns on unknown pattern', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await hf.playPattern('left', '__nonexistent__');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('playPattern() continues remaining steps after a failed step', async () => {
    // Make the first pulse fail.
    const gamepad = hf.gamepads.get(0);
    gamepad.hapticActuators[0].pulse
      .mockRejectedValueOnce(new Error('actuator error'))
      .mockResolvedValue(undefined);
    await hf.playPattern('left', 'notification'); // 2-pulse pattern
    // Second pulse should still run; stats.pulsesGenerated would be 1.
    expect(hf.stats.pulsesGenerated).toBe(1);
  });

  // ── playPatternBothHands ──────────────────────────────────────────────────────
  test('playPatternBothHands() fires on both controllers', async () => {
    await hf.playPatternBothHands('click');
    // 1 pulse per hand × 2 hands
    expect(hf.stats.pulsesGenerated).toBe(2);
  });
});

// One-controller edge: getGamepadForHand falls back to the first gamepad,
// so 'left' and 'right' both resolve to the SAME actuator — a "both hands"
// pattern would fire twice on the single connected controller.
describe('HapticFeedback — single connected controller', () => {
  let hf, actuator;
  beforeEach(() => {
    actuator = makeActuator();
    const gp = makeGamepad('right');
    gp.hand = 'right';
    gp.hapticActuators = [actuator];
    global.navigator.getGamepads = jest.fn(() => [gp]);
    hf = new HapticFeedback();
    hf.update();
  });
  afterEach(() => {
    global.navigator.getGamepads = jest.fn(() => []);
  });

  test('playPatternBothHands pulses the sole controller once, not twice', async () => {
    await hf.playPatternBothHands('click');
    const pattern = hf.patterns.click;
    const expected = Array.isArray(pattern) ? pattern.length : 1;
    expect(actuator.pulse).toHaveBeenCalledTimes(expected);
  });
});

describe('HapticFeedback actuator fallback', () => {
  let hf;

  beforeEach(() => {
    hf = new HapticFeedback();
    global.navigator.getGamepads = jest.fn(() => [makeGamepad('left')]);
    hf.update();
  });

  afterEach(() => {
    global.navigator.getGamepads = jest.fn(() => []);
  });

  test('pulse() falls back to playEffect("dual-rumble") when actuator.pulse is absent', async () => {
    const gp = hf.gamepads.get(0);
    gp.hapticActuators = [{ playEffect: jest.fn().mockResolvedValue(undefined) }];
    await hf.pulse('left', 100, 0.8);
    expect(gp.hapticActuators[0].playEffect).toHaveBeenCalledWith('dual-rumble', {
      duration: 100,
      strongMagnitude: 0.8,
      weakMagnitude: 0.4
    });
  });

  test('pulse() with neither API resolves without throwing', async () => {
    hf.gamepads.get(0).hapticActuators = [{}];
    await expect(hf.pulse('left', 10, 0.5)).resolves.toBeUndefined();
  });

  test('stats.averageIntensity is a running mean over pulses', async () => {
    await hf.pulse('left', 10, 1.0);
    await hf.pulse('left', 10, 0.5);
    expect(hf.stats.pulsesGenerated).toBe(2);
    expect(hf.stats.averageIntensity).toBeCloseTo(0.75);
  });
});

describe('HapticFeedback sequence patterns + utilities', () => {
  let hf;
  beforeEach(() => {
    hf = new HapticFeedback();
    hf.wait = jest.fn().mockResolvedValue(undefined); // keep waits instant
    global.navigator.getGamepads = jest.fn(() => [makeGamepad('left'), makeGamepad('right')]);
    hf.update();
    hf.pulse = jest.fn().mockResolvedValue(undefined);
  });
  afterEach(() => {
    global.navigator.getGamepads = jest.fn(() => []);
  });

  test('playPattern("notification") runs pulse-pause-pulse in order', async () => {
    await hf.playPattern('left', 'notification');
    expect(hf.pulse.mock.calls).toEqual([
      ['left', 30, 0.5],
      ['left', 30, 0.5]
    ]);
    expect(hf.wait).toHaveBeenCalledWith(30);
  });

  test('a failing step warns but the rest of the sequence still plays', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    hf.pulse.mockRejectedValueOnce(new Error('boom'));
    await hf.playPattern('left', 'notification');
    // Second pulse still ran despite the first rejecting.
    expect(hf.pulse).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('unknown pattern warns and returns', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await hf.playPattern('left', 'no-such-pattern');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no-such-pattern'));
    expect(hf.pulse).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('HapticFeedback — both-hands delay', () => {
  let hf;
  beforeEach(() => {
    hf = new HapticFeedback();
    global.navigator.getGamepads = jest.fn(() => [
      makeGamepad('left'), makeGamepad('right')
    ]);
    hf.update();
  });
  afterEach(() => {
    global.navigator.getGamepads = jest.fn(() => []);
  });

  test('playPatternBothHands with delay>0 waits between hands', async () => {
    const delays = [];
    hf.wait = (ms) => {
      delays.push(ms); return Promise.resolve();
    };
    await hf.playPatternBothHands('click', 50);
    expect(delays).toEqual([50]);
  });

  test('playPatternBothHands with delay=0 plays back-to-back (no wait)', async () => {
    const delays = [];
    hf.wait = (ms) => {
      delays.push(ms); return Promise.resolve();
    };
    await hf.playPatternBothHands('click');
    expect(delays).toEqual([]);
  });
});

describe('HapticFeedback — remaining branch arms', () => {
  test('update() removes a disconnected gamepad', () => {
    const hf = new HapticFeedback();
    global.navigator.getGamepads = jest.fn(() => [makeGamepad('left')]);
    hf.update();
    expect(hf.gamepads.size).toBe(1);
    global.navigator.getGamepads = jest.fn(() => [null]); // slot emptied
    hf.update();
    expect(hf.gamepads.size).toBe(0);
  });
});

describe('HapticFeedback — remaining arms', () => {
  test('update() logs and deletes a controller that loses its actuators', async () => {
    const hf = new HapticFeedback();
    global.navigator.getGamepads = jest.fn(() => [
      { hapticActuators: [{}], id: 'g0' }
    ]);
    hf.update();
    expect(hf.gamepads.size).toBe(1);
    // same index, now without actuators -> disconnect arm
    global.navigator.getGamepads = jest.fn(() => [{ id: 'g0' }]);
    hf.update();
    expect(hf.gamepads.size).toBe(0);
  });
});

describe('HapticFeedback — sequence/pattern sliver arms', () => {
  test('update() drops a disconnected gamepad', () => {
    const hf = new HapticFeedback();
    global.navigator.getGamepads = jest.fn(() => [{ index: 0, hapticActuators: [{}] }]);
    hf.update();
    expect(hf.gamepads.size).toBe(1);
    global.navigator.getGamepads = jest.fn(() => [null]);
    hf.update();
    expect(hf.gamepads.size).toBe(0);
  });
});

test('update ignores an untracked missing slot', () => {
  const hf = new HapticFeedback();
  global.navigator.getGamepads = jest.fn(() => [null]);
  hf.update();                       // slot missing AND untracked → else-if false arm
  expect(hf.gamepads.size).toBe(0);
});

describe('HapticFeedback — array-pattern arms', () => {
  const mkGp = () => ({
    id: 'g',
    hand: 'right',
    hapticActuators: [{ pulse: jest.fn(() => Promise.resolve()), playEffect: jest.fn(() => Promise.resolve()) }]
  });

  test('an array pattern runs pause steps through playPattern', async () => {
    const hf = new HapticFeedback();
    hf.enabled = true;
    hf.gamepads.set(0, mkGp());
    hf.patterns['with-pause'] = [
      { duration: 5, intensity: 0.4 },
      { pause: 5 },
      { duration: 5 }
    ];
    await hf.playPattern('right', 'with-pause');
    expect(hf.gamepads.get(0).hapticActuators[0].pulse).toHaveBeenCalledTimes(2);
  });

  test('a step carrying neither duration nor pause is skipped without aborting the pattern', async () => {
    const hf = new HapticFeedback();
    hf.patterns.x = [{ noop: 1 }, { pause: 5 }];
    await expect(hf.playPattern('left', 'x')).resolves.toBeUndefined();
  });
});
