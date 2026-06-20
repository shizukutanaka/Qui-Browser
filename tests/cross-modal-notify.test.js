/**
 * Unit tests for cross-modal notification routing (accessibility equity).
 *
 * Verifies that an important notification is mirrored onto every available
 * non-visual channel — a severity-mapped haptic pulse on both hands and the
 * caption queue — and that it degrades cleanly when a channel is absent or
 * disabled. Pure logic, so no THREE / GPU / controller mocks are needed.
 */

const {
  notifyCrossModal,
  TOAST_HAPTIC,
  withSeverity,
  SEVERITY_PREFIX,
  toastColors,
  toastFontPx,
  voiceCommandFeedback,
  VOICE_CMD_HAPTIC_PATTERN,
  voiceCommandFailedFeedback,
  VOICE_CMD_FAILED_HAPTIC_PATTERN,
  voiceErrorNotification,
  VOICE_FATAL_ERRORS,
  controllerDisconnectMessage
} = require('../src/vr/accessibility/crossModal.js');

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

describe('withSeverity — severity conveyed by shape, not colour', () => {
  test('prefixes a distinct glyph per severity', () => {
    expect(withSeverity('disk full', 'error')).toBe(`${SEVERITY_PREFIX.error}disk full`);
    expect(withSeverity('battery low', 'warn')).toBe(`${SEVERITY_PREFIX.warn}battery low`);
    expect(withSeverity('saved', 'info')).toBe(`${SEVERITY_PREFIX.info}saved`);
  });

  test('the three glyphs are all distinct', () => {
    const glyphs = Object.values(SEVERITY_PREFIX);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  test('falls back to the info glyph for an unknown/missing type', () => {
    expect(withSeverity('hi', 'bogus')).toBe(`${SEVERITY_PREFIX.info}hi`);
    expect(withSeverity('hi', undefined)).toBe(`${SEVERITY_PREFIX.info}hi`);
  });
});

describe('toast theming — honours high-contrast and large-text', () => {
  test('default scheme is tinted per severity', () => {
    expect(toastColors('error').bg).toBe('#5a0a0a');
    expect(toastColors('warn').fg).toBe('#ffdd88');
    expect(toastColors('info').bdr).toBe('#44aaff');
  });

  test('high-contrast scheme is solid black with white text', () => {
    for (const type of ['error', 'warn', 'info']) {
      const c = toastColors(type, true);
      expect(c.bg).toBe('#000000');
      expect(c.fg).toBe('#ffffff');
      // severity still distinguishable by the border
      expect(c.bdr).not.toBe('#000000');
    }
  });

  test('unknown type falls back to the error scheme', () => {
    expect(toastColors('bogus')).toEqual(toastColors('error'));
  });

  test('toastFontPx scales the base size and defaults to 26', () => {
    expect(toastFontPx()).toBe(26);
    expect(toastFontPx(1.3)).toBe(34); // round(33.8)
    expect(toastFontPx(0)).toBe(26);   // invalid coerced to 1
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

describe('voiceCommandFeedback — haptic parity for hands-free input', () => {
  test('fires the click pattern on both hands when haptics are available', () => {
    const haptic = makeHaptic();
    voiceCommandFeedback(haptic);
    expect(haptic.playPatternBothHands).toHaveBeenCalledTimes(1);
    expect(haptic.playPatternBothHands).toHaveBeenCalledWith(VOICE_CMD_HAPTIC_PATTERN);
  });

  test('does not throw when hapticFeedback is null', () => {
    expect(() => voiceCommandFeedback(null)).not.toThrow();
  });

  test('VOICE_CMD_HAPTIC_PATTERN is the lightweight click (not impact or error)', () => {
    expect(VOICE_CMD_HAPTIC_PATTERN).toBe('click');
  });

  test('fires exactly once per command (no double-pulse)', () => {
    const haptic = makeHaptic();
    voiceCommandFeedback(haptic);
    voiceCommandFeedback(haptic);
    expect(haptic.playPatternBothHands).toHaveBeenCalledTimes(2);
  });
});

describe('voiceCommandFailedFeedback — distinct "try again" pulse', () => {
  test('fires the notification pattern on both hands when haptics are available', () => {
    const haptic = makeHaptic();
    voiceCommandFailedFeedback(haptic);
    expect(haptic.playPatternBothHands).toHaveBeenCalledTimes(1);
    expect(haptic.playPatternBothHands).toHaveBeenCalledWith(VOICE_CMD_FAILED_HAPTIC_PATTERN);
  });

  test('does not throw when hapticFeedback is null', () => {
    expect(() => voiceCommandFailedFeedback(null)).not.toThrow();
  });

  test('failure pattern differs from success pattern (distinct cues)', () => {
    expect(VOICE_CMD_FAILED_HAPTIC_PATTERN).not.toBe(VOICE_CMD_HAPTIC_PATTERN);
  });

  test('VOICE_CMD_FAILED_HAPTIC_PATTERN is the gentle double-bump (not error/warning)', () => {
    expect(VOICE_CMD_FAILED_HAPTIC_PATTERN).toBe('notification');
  });
});

describe('controllerDisconnectMessage — WCAG 4.1.3 controller status', () => {
  test('names the left hand when handedness is "left"', () => {
    expect(controllerDisconnectMessage('left')).toMatch(/left/i);
  });

  test('names the right hand when handedness is "right"', () => {
    expect(controllerDisconnectMessage('right')).toMatch(/right/i);
  });

  test('returns a non-empty fallback for unknown/undefined handedness', () => {
    expect(controllerDisconnectMessage(undefined)).toBeTruthy();
    expect(controllerDisconnectMessage('unknown')).toBeTruthy();
    expect(controllerDisconnectMessage('none')).toBeTruthy();
  });

  test('left and right messages are distinct', () => {
    expect(controllerDisconnectMessage('left')).not.toBe(controllerDisconnectMessage('right'));
  });
});

describe('voiceErrorNotification — user-visible speech recognition errors', () => {
  test('not-allowed returns error severity with mic-denied message', () => {
    const r = voiceErrorNotification('not-allowed');
    expect(r.type).toBe('error');
    expect(r.message).toMatch(/microphone/i);
  });

  test('service-not-allowed also returns error severity', () => {
    const r = voiceErrorNotification('service-not-allowed');
    expect(r.type).toBe('error');
  });

  test('non-fatal errors (network, audio-capture, aborted) return warn severity', () => {
    for (const code of ['network', 'audio-capture', 'aborted', 'no-speech']) {
      expect(voiceErrorNotification(code).type).toBe('warn');
    }
  });

  test('VOICE_FATAL_ERRORS includes both permission-denied codes', () => {
    expect(VOICE_FATAL_ERRORS.has('not-allowed')).toBe(true);
    expect(VOICE_FATAL_ERRORS.has('service-not-allowed')).toBe(true);
  });

  test('fatal errors map to error type, non-fatal to warn — no silent failures', () => {
    const fatal = voiceErrorNotification('not-allowed');
    const nonfatal = voiceErrorNotification('network');
    expect(fatal.type).toBe('error');
    expect(nonfatal.type).toBe('warn');
    expect(fatal.type).not.toBe(nonfatal.type);
  });
});
