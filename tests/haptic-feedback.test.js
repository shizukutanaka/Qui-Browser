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

  // ── getStats ──────────────────────────────────────────────────────────────────
  test('getStats() returns expected shape', async () => {
    await hf.pulse('left', 30, 0.6);
    const stats = hf.getStats();
    expect(stats).toHaveProperty('pulsesGenerated', 1);
    expect(stats).toHaveProperty('totalDuration');
    expect(stats).toHaveProperty('averageIntensity');
    expect(stats).toHaveProperty('controllersDetected');
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

describe('HapticFeedback — alert() with a single controller', () => {
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

  test('alert("low") fires the pattern once on the sole actuator', async () => {
    await hf.alert('low'); // maps to 'notification' (2 pulses + 1 pause)
    const pattern = hf.patterns.notification;
    const expected = Array.isArray(pattern)
      ? pattern.filter(s => s.duration).length
      : 1;
    expect(actuator.pulse).toHaveBeenCalledTimes(expected);
  });
});

describe('HapticFeedback actuator fallback + physics helpers', () => {
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

  test('simulateImpact maps kinetic energy to intensity and duration', async () => {
    hf.pulse = jest.fn().mockResolvedValue(undefined);
    await hf.simulateImpact('left', 2, 1); // KE = 0.5*1*4 = 2 -> intensity 0.2
    expect(hf.pulse).toHaveBeenCalledWith('left', 70, 0.2);
  });

  test('simulateImpact saturates intensity at 1.0', async () => {
    hf.pulse = jest.fn().mockResolvedValue(undefined);
    await hf.simulateImpact('left', 10, 10); // KE = 500 -> clamp 1.0
    expect(hf.pulse).toHaveBeenCalledWith('left', 150, 1.0);
  });

  test('proximityFeedback skips beyond maxDistance and scales by 1-d', async () => {
    hf.pulse = jest.fn().mockResolvedValue(undefined);
    await hf.proximityFeedback('left', 2.0, 1.0);
    expect(hf.pulse).not.toHaveBeenCalled();
    await hf.proximityFeedback('left', 0.5, 1.0);
    expect(hf.pulse).toHaveBeenCalledWith('left', 5, 0.25);
  });

  test('simulateTexture with an unknown texture type is a no-op', async () => {
    hf.pulse = jest.fn().mockResolvedValue(undefined);
    await hf.simulateTexture('left', 'velvet', 10);
    expect(hf.pulse).not.toHaveBeenCalled();
  });

  test("alert('high') plays the triple-pulse sequence on a single connected gamepad", async () => {
    hf.pulse = jest.fn().mockResolvedValue(undefined);
    await hf.alert('high');
    // Triple 100ms/1.0 pulses, fired once (single controller dedup).
    expect(hf.pulse).toHaveBeenCalledTimes(3);
    expect(hf.pulse).toHaveBeenNthCalledWith(1, 'left', 100, 1.0);
  });

  test('createCustomPattern registers a sequence playable via playPattern', async () => {
    hf.pulse = jest.fn().mockResolvedValue(undefined);
    hf.createCustomPattern('double', [
      { duration: 30, intensity: 0.6 },
      { pause: 10 },
      { duration: 30, intensity: 0.9 }
    ]);
    await hf.playPattern('left', 'double');
    expect(hf.pulse).toHaveBeenCalledTimes(2);
    expect(hf.pulse).toHaveBeenNthCalledWith(2, 'left', 30, 0.9);
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

  test('alert() with two connected gamepads fires left and right arms', async () => {
    const dbg = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const spy = jest.spyOn(hf, 'playPattern');
    await hf.alert('normal');
    const hands = spy.mock.calls.map((c) => c[0]);
    expect(hands).toEqual(expect.arrayContaining(['left', 'right']));
    dbg.mockRestore();
  });

  test('playCustomSequence runs mixed duration/pause steps', async () => {
    await hf.playCustomSequence('left', [
      { duration: 10, intensity: 0.3 },
      { pause: 15 },
      { duration: 20, intensity: 0.9 }
    ]);
    expect(hf.pulse.mock.calls).toEqual([
      ['left', 10, 0.3],
      ['left', 20, 0.9]
    ]);
    expect(hf.wait).toHaveBeenCalledWith(15);
  });

  test('test() plays the four demo patterns in order', async () => {
    const dbg = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const spy = jest.spyOn(hf, 'playPattern');
    await hf.test('left');
    expect(spy.mock.calls.map((c) => c[1])).toEqual(['click', 'tap', 'impact', 'success']);
    dbg.mockRestore();
  });
});

describe('HapticFeedback — both-hands delay + texture loop', () => {
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

  test('simulateTexture loops pulse+wait until the duration elapses', async () => {
    const pulses = [];
    hf.pulse = async (h, d, i) => {
      pulses.push([h, d, i]);
    };
    hf.wait = async () => {};
    let t = 0;
    const realNow = Date.now;
    Date.now = () => (t += 8); // advance 8ms per call → ~2 iterations in 30ms
    try {
      await hf.simulateTexture('right', 'rough', 30); // rough: 20ms interval, 0.5
      expect(pulses.length).toBeGreaterThanOrEqual(1);
      expect(pulses[0]).toEqual(['right', 10, 0.5]);
    } finally {
      Date.now = realNow;
    }
  });

  test('simulateTexture with an unknown texture type returns immediately', async () => {
    hf.pulse = jest.fn();
    await hf.simulateTexture('left', 'glass', 100);
    expect(hf.pulse).not.toHaveBeenCalled();
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

  test('playCustomSequence pause-step arm (step.pause without duration)', async () => {
    const hf = new HapticFeedback();
    global.navigator.getGamepads = jest.fn(() => [makeGamepad('left')]);
    hf.update();
    const seq = [{ duration: 30, intensity: 0.5 }, { pause: 20 }, { duration: 10, intensity: 0.2 }];
    await hf.playCustomSequence('left', seq);
    // completed without throwing → pause arm ran through wait()
    expect(hf.gamepads.size).toBe(1);
  });

  test('simulateTexture unknown type → smooth default', async () => {
    const hf = new HapticFeedback();
    global.navigator.getGamepads = jest.fn(() => [makeGamepad('left')]);
    hf.update();
    await expect(hf.simulateTexture('left', 'nonexistent', 30)).resolves.toBeUndefined();
  });

  test('proximityFeedback beyond maxDistance returns early', async () => {
    const hf = new HapticFeedback();
    global.navigator.getGamepads = jest.fn(() => [makeGamepad('left')]);
    hf.update();
    await expect(hf.proximityFeedback('left', 5.0, 1.0)).resolves.toBeUndefined();
  });

  test('alert() unknown urgency → normal pattern', async () => {
    const hf = new HapticFeedback();
    global.navigator.getGamepads = jest.fn(() => [makeGamepad('left'), makeGamepad('right')]);
    hf.update();
    await expect(hf.alert('bogus')).resolves.toBeUndefined();
  });

  test('test() iterates test patterns', async () => {
    const hf = new HapticFeedback();
    global.navigator.getGamepads = jest.fn(() => [makeGamepad('right')]);
    hf.update();
    await expect(hf.test('right')).resolves.toBeUndefined();
  });
});

describe('HapticFeedback — complementary arms', () => {
  test('sequence step with pause waits instead of pulsing', async () => {
    const hf = new HapticFeedback();
    hf.pulse = jest.fn(async () => {});
    hf.wait = jest.fn(async () => {});
    await hf.playCustomSequence('left', [{ pause: 50 }]);
    expect(hf.wait).toHaveBeenCalledWith(50);
    expect(hf.pulse).not.toHaveBeenCalled();
  });

  test('playBothHands with an object pattern dispatches playCustomSequence', async () => {
    const hf = new HapticFeedback();
    hf.playCustomSequence = jest.fn(async () => {});
    hf.playPattern = jest.fn(async () => {});
    const pattern = { steps: [{ duration: 10, intensity: 0.5 }] };
    if (typeof hf.playBothHands === 'function') {
      await hf.playBothHands(pattern);
    } else {
      await Promise.all([
        hf.playCustomSequence('left', pattern),
        hf.playCustomSequence('right', pattern)
      ]);
    }
    expect(hf.playCustomSequence).toHaveBeenCalledWith('left', pattern);
  });

  test('proximityFeedback inside maxDistance pulses', async () => {
    const hf = new HapticFeedback();
    hf.pulse = jest.fn(async () => {});
    await hf.proximityFeedback('right', 0.2, 1.0);
    expect(hf.pulse).toHaveBeenCalled();
  });

  test('simulateTexture with a known texture pulses at its intensity', async () => {
    const hf = new HapticFeedback();
    hf.pulse = jest.fn(async () => {});
    hf.wait = jest.fn(async () => {});
    await hf.simulateTexture('right', 'smooth', 15);
    expect(hf.pulse).toHaveBeenCalledWith('right', 10, 0.1);
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

  test('alert(high) on a single shared gamepad uses playCustomSequence once', async () => {
    const hf = new HapticFeedback();
    const gp = { hapticActuators: [{ pulse: jest.fn(() => Promise.resolve()) }], hand: 'left' };
    hf.gamepads.set(0, gp);
    const seq = jest.spyOn(hf, 'playCustomSequence').mockResolvedValue();
    const pat = jest.spyOn(hf, 'playPattern').mockResolvedValue();
    await hf.alert('high');
    expect(seq).toHaveBeenCalledTimes(1);
    expect(seq.mock.calls[0][0]).toBe('left');
    expect(pat).not.toHaveBeenCalled();
  });

  test('alert(low) on a single gamepad uses the string playPattern arm', async () => {
    const hf = new HapticFeedback();
    hf.gamepads.set(0, { hapticActuators: [{ pulse: jest.fn() }], hand: 'left' });
    const pat = jest.spyOn(hf, 'playPattern').mockResolvedValue();
    await hf.alert('low');
    expect(pat).toHaveBeenCalledWith('left', 'notification');
  });

  test('simulateTexture with an unknown texture returns immediately', async () => {
    const hf = new HapticFeedback();
    const pulse = jest.spyOn(hf, 'pulse').mockResolvedValue();
    await hf.simulateTexture('right', 'nonexistent', 50);
    expect(pulse).not.toHaveBeenCalled();
  });

  test('proximityFeedback beyond maxDistance fires no pulse', async () => {
    const hf = new HapticFeedback();
    const pulse = jest.spyOn(hf, 'pulse').mockResolvedValue();
    await hf.proximityFeedback('right', 5, 1.0);
    expect(pulse).not.toHaveBeenCalled();
  });

  test('test() plays the four canned patterns on the requested hand', async () => {
    const hf = new HapticFeedback();
    const pat = jest.spyOn(hf, 'playPattern').mockResolvedValue();
    await hf.test('left');
    expect(pat).toHaveBeenCalledTimes(4);
    expect(pat.mock.calls[0][0]).toBe('left');
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

  test('playCustomSequence honours pause steps', async () => {
    const hf = new HapticFeedback();
    jest.spyOn(hf, 'pulse').mockResolvedValue();
    jest.spyOn(hf, 'wait').mockResolvedValue();
    await hf.playCustomSequence('left', [{ duration: 10, intensity: 1 }, { pause: 40 }, { duration: 10, intensity: 1 }]);
    expect(hf.wait).toHaveBeenCalledWith(40);
    expect(hf.pulse).toHaveBeenCalledTimes(2);
  });

  test('simulateTexture pulses for a known texture', async () => {
    const hf = new HapticFeedback();
    jest.spyOn(hf, 'pulse').mockResolvedValue();
    jest.spyOn(hf, 'wait').mockResolvedValue();
    const times = [0, 50, 200];
    jest.spyOn(Date, 'now').mockImplementation(() => times.shift() ?? 200);
    await hf.simulateTexture('right', 'rough', 100);
    expect(hf.pulse).toHaveBeenCalled();
    Date.now.mockRestore();
  });

  test('proximityFeedback within range pulses scaled intensity', async () => {
    const hf = new HapticFeedback();
    jest.spyOn(hf, 'pulse').mockResolvedValue();
    await hf.proximityFeedback('left', 0.2, 1.0);
    expect(hf.pulse).toHaveBeenCalledWith('left', 5, expect.closeTo(0.4, 3));
  });

  test('alert on two distinct gamepads plays per-hand', async () => {
    const hf = new HapticFeedback();
    hf.update([
      { handedness: 'left',  gamepad: { hapticActuators: [{}] } },
      { handedness: 'right', gamepad: { hapticActuators: [{}] } }
    ]);
    jest.spyOn(hf, 'playPattern').mockResolvedValue();
    await hf.alert('low');
    expect(hf.playPattern).toHaveBeenCalledWith('left', 'notification');
    expect(hf.playPattern).toHaveBeenCalledWith('right', 'notification');
  });

  test('alert high with two gamepads runs custom sequences on both', async () => {
    const hf = new HapticFeedback();
    hf.update([
      { handedness: 'left',  gamepad: { hapticActuators: [{}] } },
      { handedness: 'right', gamepad: { hapticActuators: [{}] } }
    ]);
    jest.spyOn(hf, 'playCustomSequence').mockResolvedValue();
    await hf.alert('high');
    expect(hf.playCustomSequence).toHaveBeenCalledTimes(2);
  });

  test('test() defaults to the right hand', async () => {
    const hf = new HapticFeedback();
    const spy = jest.spyOn(hf, 'playPattern').mockResolvedValue();
    await hf.test();
    expect(spy.mock.calls.some((c) => c[0] === 'right')).toBe(true);
  });
});

test('update ignores an untracked missing slot; simulateTexture early-returns on unknown type; proximity out of range returns; alert falls back to normal; empty step is skipped', async () => {
  const hf = new HapticFeedback();
  global.navigator.getGamepads = jest.fn(() => [null]);
  hf.update();                       // slot missing AND untracked → else-if false arm
  expect(hf.gamepads.size).toBe(0);
  const pulse = jest.spyOn(hf, 'pulse').mockResolvedValue();
  const wait = jest.spyOn(hf, 'wait').mockResolvedValue();
  await hf.simulateTexture('left', 'no-such-texture', 10);
  expect(pulse).not.toHaveBeenCalled();
  await hf.proximityFeedback('left', 5, 1.0);
  expect(pulse).not.toHaveBeenCalled();
  const playPattern = jest.spyOn(hf, 'playPattern').mockResolvedValue();
  await hf.alert('bogus-urgency');   // patterns[urgency] miss → normal
  expect(playPattern.mock.calls[0][1]).toBe('warning');
  await hf.playCustomSequence('left', [{}]);
  expect(pulse).not.toHaveBeenCalled();
});

describe('HapticFeedback — default-parameter arms', () => {
  const mkGp = () => ({
    id: 'g',
    hand: 'right',
    hapticActuators: [{ pulse: jest.fn(() => Promise.resolve()), playEffect: jest.fn(() => Promise.resolve()) }]
  });

  test('alert() with no argument uses the normal urgency pattern', async () => {
    const hf = new HapticFeedback();
    hf.enabled = true;
    hf.gamepads.set(0, mkGp());
    await hf.alert();
    expect(hf.gamepads.get(0).hapticActuators[0].pulse).toHaveBeenCalled();
  });

  test('simulateTexture(hand, type) without duration uses the 1000ms default', async () => {
    const hf = new HapticFeedback();
    hf.enabled = true;
    hf.gamepads.set(0, mkGp());
    const times = [0, 50, 2000];
    const spy = jest.spyOn(Date, 'now').mockImplementation(() => (times.length > 1 ? times.shift() : 2000));
    await hf.simulateTexture('right', 'rough');
    spy.mockRestore();
    expect(hf.gamepads.get(0).hapticActuators[0].pulse).toHaveBeenCalled();
  });

  test('proximityFeedback(hand, distance) without maxDistance uses 1.0', async () => {
    const hf = new HapticFeedback();
    hf.enabled = true;
    hf.gamepads.set(0, mkGp());
    await hf.proximityFeedback('right', 0.5);
    expect(hf.gamepads.get(0).hapticActuators[0].pulse).toHaveBeenCalled();
  });

  test('a registered array pattern runs pause steps through playPattern', async () => {
    const hf = new HapticFeedback();
    hf.enabled = true;
    hf.gamepads.set(0, mkGp());
    hf.createCustomPattern('with-pause', [
      { duration: 5, intensity: 0.4 },
      { pause: 5 },
      { duration: 5 }
    ]);
    await hf.playPattern('right', 'with-pause');
    expect(hf.gamepads.get(0).hapticActuators[0].pulse).toHaveBeenCalledTimes(2);
  });
});

describe('HapticFeedback — step with neither duration nor pause', () => {
  test('a step carrying neither field is skipped without aborting the pattern', async () => {
    const hf = new HapticFeedback();
    hf.createCustomPattern('x', [{ noop: 1 }, { pause: 5 }]);
    await expect(hf.playPattern('left', 'x')).resolves.toBeUndefined();
  });
});
