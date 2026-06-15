/**
 * Unit tests for cross-modal notification routing (accessibility equity).
 *
 * Verifies that an important notification is mirrored onto every available
 * non-visual channel — a severity-mapped haptic pulse on both hands and the
 * caption queue — and that it degrades cleanly when a channel is absent or
 * disabled. Pure logic, so no THREE / GPU / controller mocks are needed.
 */

const { notifyCrossModal, TOAST_HAPTIC } = require('../src/vr/accessibility/crossModal.js');

function makeHaptic() {
  return { playPatternBothHands: jest.fn() };
}

function makeCaption(enabled) {
  return { enabled, show: jest.fn() };
}

describe('notifyCrossModal — haptic channel', () => {
  test('maps each severity to its predefined pattern, once, on both hands', () => {
    for (const [type, pattern] of Object.entries(TOAST_HAPTIC)) {
      const haptic = makeHaptic();
      notifyCrossModal(haptic, null, 'msg', type);
      expect(haptic.playPatternBothHands).toHaveBeenCalledTimes(1);
      expect(haptic.playPatternBothHands).toHaveBeenCalledWith(pattern);
    }
  });

  test('falls back to the info pattern for an unknown/missing type', () => {
    const haptic = makeHaptic();
    notifyCrossModal(haptic, null, 'msg', 'bogus');
    expect(haptic.playPatternBothHands).toHaveBeenCalledWith(TOAST_HAPTIC.info);

    const haptic2 = makeHaptic();
    notifyCrossModal(haptic2, null, 'msg', undefined);
    expect(haptic2.playPatternBothHands).toHaveBeenCalledWith(TOAST_HAPTIC.info);
  });
});

describe('notifyCrossModal — caption channel', () => {
  test('pushes the message to captions only when captions are enabled', () => {
    const on = makeCaption(true);
    notifyCrossModal(null, on, 'hello', 'info');
    expect(on.show).toHaveBeenCalledWith('hello');

    const off = makeCaption(false);
    notifyCrossModal(null, off, 'hello', 'info');
    expect(off.show).not.toHaveBeenCalled();
  });
});

describe('notifyCrossModal — graceful degradation', () => {
  test('does not throw when both subsystems are absent', () => {
    expect(() => notifyCrossModal(null, null, 'msg', 'error')).not.toThrow();
  });

  test('drives every present channel in a single call', () => {
    const haptic = makeHaptic();
    const caption = makeCaption(true);
    notifyCrossModal(haptic, caption, 'spatial audio unavailable', 'warn');
    expect(haptic.playPatternBothHands).toHaveBeenCalledWith('warning');
    expect(caption.show).toHaveBeenCalledWith('spatial audio unavailable');
  });
});
