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
