/**
 * Shared visual treatment for the canvas-drawn VR UI buttons.
 *
 * The hover / focus state must be clearly perceptible (WCAG 2.4.7 Focus Visible
 * and 1.4.11 Non-text Contrast). The previous treatment shifted the fill only
 * between two near-black blues — too subtle for low-vision / low-contrast-
 * sensitivity users to see which control is focused. So hover now BOTH brightens
 * the fill noticeably AND thickens the border. The thickness is a shape cue that
 * works independently of the border's hue — important because several buttons
 * already use border colour to encode state (toggle on/off) or type, which the
 * hover treatment must not clobber.
 *
 * Pure / dependency-free so the focus-indicator logic is unit-testable.
 */

export const BUTTON_BG        = 'rgba(16,20,30,0.92)';   // idle: near-black
export const BUTTON_BG_HOVER  = 'rgba(64,96,150,0.97)';  // hover: clearly brighter blue
export const BUTTON_LINE       = 4;                       // idle border width (px)
export const BUTTON_LINE_HOVER = 6;                       // hover border width (px)

/** Background fill for a button in the given hover state. */
export function buttonBg(hover) {
  return hover ? BUTTON_BG_HOVER : BUTTON_BG;
}

/** Border width (px) for a button in the given hover state. */
export function buttonLineWidth(hover) {
  return hover ? BUTTON_LINE_HOVER : BUTTON_LINE;
}
