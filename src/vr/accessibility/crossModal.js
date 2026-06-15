/**
 * Cross-modal notification routing (accessibility equity).
 *
 * An important in-VR notification must never be conveyed by sight alone — a
 * visual-only toast is invisible to a blind / low-vision user and is missed by
 * anyone whose gaze is elsewhere. Given the feedback subsystems already present
 * in the app, this mirrors a message onto every available *non-visual* channel:
 *
 *   • a severity-mapped haptic pulse on BOTH hands (so a one-handed / single-
 *     controller user still feels it), and
 *   • the caption queue, when captions are enabled (so caption-reliant users,
 *     and anyone not looking at the toast, still receive the text).
 *
 * Pure and dependency-free so the routing is unit-testable without a GPU or
 * controllers. Both subsystems are optional: a missing one is simply skipped,
 * and each honours its own enable flag (haptics via HapticFeedback.enabled,
 * captions via CaptionSystem.enabled), so this stays opt-out through existing
 * controls and never forces feedback the user has turned off.
 */

// Maps a toast severity to a predefined HapticFeedback pattern (see
// HapticFeedback.patterns). Distinct rhythms let the hand alone tell error /
// warning / info apart without sight.
export const TOAST_HAPTIC = { error: 'error', warn: 'warning', info: 'notification' };

/**
 * @param {{playPatternBothHands: function}|null} hapticFeedback
 * @param {{enabled: boolean, show: function}|null} captionSystem
 * @param {string} message
 * @param {'error'|'warn'|'info'} type
 */
export function notifyCrossModal(hapticFeedback, captionSystem, message, type) {
  if (hapticFeedback) {
    const pattern = TOAST_HAPTIC[type] || TOAST_HAPTIC.info;
    hapticFeedback.playPatternBothHands(pattern);
  }
  if (captionSystem && captionSystem.enabled) {
    captionSystem.show(message);
  }
}
