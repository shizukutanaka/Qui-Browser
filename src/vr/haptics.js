/**
 * Guarded haptic calls — every user-visible confirmation goes through here so
 * the existence check lives in one place.
 */
export function haptic(app, hand, pattern) {
  app.hapticFeedback?.playPattern(hand, pattern);
}

export function hapticBothHands(app, pattern) {
  app.hapticFeedback?.playPatternBothHands(pattern);
}
