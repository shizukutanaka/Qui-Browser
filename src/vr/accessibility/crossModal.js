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

// A severity glyph prefixed to notification text so the level is conveyed by
// SHAPE, not colour alone — readable by colour-blind users (who can't separate
// the red error from the amber warning) and by caption-reliant users (whose
// text channel carries no colour at all). Distinct silhouettes: ✕ / ⚠ / ℹ.
export const SEVERITY_PREFIX = { error: '✕ ', warn: '⚠ ', info: 'ℹ ' };

// Toast colour schemes (panel background / text / border) per severity. The
// high-contrast set maximises legibility — solid black backing, white text —
// for low-vision / high-contrast users; severity is still distinguishable by
// the bright border AND the severity glyph, so dropping the tinted text loses
// no information.
export const TOAST_COLORS = {
  error: { bg: '#5a0a0a', fg: '#ffaaaa', bdr: '#ff4444' },
  warn:  { bg: '#4a3a00', fg: '#ffdd88', bdr: '#ffbb33' },
  info:  { bg: '#0a2a4a', fg: '#88ccff', bdr: '#44aaff' }
};
export const TOAST_COLORS_HC = {
  error: { bg: '#000000', fg: '#ffffff', bdr: '#ff5555' },
  warn:  { bg: '#000000', fg: '#ffffff', bdr: '#ffcc44' },
  info:  { bg: '#000000', fg: '#ffffff', bdr: '#55ccff' }
};

/**
 * Toast colour scheme for a severity, honouring a high-contrast preference.
 * Falls back to the error scheme for an unknown/missing type (matches the
 * prior inline behaviour). Pure.
 * @param {'error'|'warn'|'info'} type
 * @param {boolean} [highContrast=false]
 * @returns {{bg:string, fg:string, bdr:string}}
 */
export function toastColors(type, highContrast = false) {
  const set = highContrast ? TOAST_COLORS_HC : TOAST_COLORS;
  return set[type] || set.error;
}

/** Toast font size (px) for a text-size multiplier (low vision). */
export function toastFontPx(scale = 1) {
  return Math.round(26 * (Number(scale) || 1));
}

/**
 * Prepend the severity glyph to a message. Falls back to the info glyph for an
 * unknown/missing type. Pure — used by both the visual toast and the caption
 * mirror so the two stay in sync.
 *
 * @param {string} message
 * @param {'error'|'warn'|'info'} type
 * @returns {string}
 */
export function withSeverity(message, type) {
  return (SEVERITY_PREFIX[type] || SEVERITY_PREFIX.info) + message;
}

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
