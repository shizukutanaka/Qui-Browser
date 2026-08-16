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
 * High-contrast variants (honoured when the OS or user prefers-contrast signal
 * is on) swap the dark-glass backing for pure black and use maximum-opacity
 * fills so the contrast ratio is unambiguous — matching the same pattern already
 * used by the toast and caption subsystems (WCAG 1.4.11 Non-text Contrast).
 *
 * Pure / dependency-free so the focus-indicator logic is unit-testable.
 */

export const BUTTON_BG        = 'rgba(16,20,30,0.92)';   // idle: near-black
export const BUTTON_BG_HOVER  = 'rgba(64,96,150,0.97)';  // hover: clearly brighter blue
export const BUTTON_LINE       = 4;                       // idle border width (px)
export const BUTTON_LINE_HOVER = 6;                       // hover border width (px)

// High-contrast: pure-black backing, saturated-blue hover, wider borders.
export const BUTTON_BG_HC        = '#000000';
export const BUTTON_BG_HOVER_HC  = '#004adf';
export const BUTTON_LINE_HC       = 5;
export const BUTTON_LINE_HOVER_HC = 8;

/** Background fill for a button in the given hover state. */
export function buttonBg(hover, highContrast = false) {
  if (highContrast) {
    return hover ? BUTTON_BG_HOVER_HC : BUTTON_BG_HC;
  }
  return hover ? BUTTON_BG_HOVER : BUTTON_BG;
}

/** Border width (px) for a button in the given hover state. */
export function buttonLineWidth(hover, highContrast = false) {
  if (highContrast) {
    return hover ? BUTTON_LINE_HOVER_HC : BUTTON_LINE_HC;
  }
  return hover ? BUTTON_LINE_HOVER : BUTTON_LINE;
}

/**
 * Border and label colours for the ON/OFF toggle indicator.
 *
 * Toggle buttons encode state via both border hue (green = on) and the ON/OFF
 * label. In high-contrast mode the off-state colours are brightened so the
 * inactive indicator is clearly distinguishable from the pure-black background
 * (WCAG 1.4.11 Non-text Contrast ≥ 3:1, 1.4.3 Text ≥ 4.5:1).
 *
 * `hover` exists because the indicator colours are drawn ON TOP of the hover
 * fill, and the hover fill is deliberately much brighter than the idle one.
 * Measured: the off-state label `#8899aa` is a comfortable 6.39:1 against the
 * idle backing but collapses to **2.26:1** once the backing brightens to
 * `#3e5d92`, and the off-state border falls to 1.43:1 — so pointing at a
 * settings toggle used to make its state *less* readable than leaving it
 * alone, which is the exact opposite of what a focus treatment is for
 * (WCAG 2.4.7 Focus Visible, and a 1.4.3 failure in the focused state).
 * The on-state green already clears 3:1 on both backings and is unchanged.
 * High-contrast already cleared both backings too; only normal mode moves.
 *
 * @param {boolean} on
 * @param {boolean} [highContrast=false]
 * @param {boolean} [hover=false] true when drawn over the hover fill
 * @returns {{ border: string, label: string }}
 */
export function toggleIndicatorColors(on, highContrast = false, hover = false) {
  if (highContrast) {
    if (on) {
      return { border: '#00ff88', label: '#00ff88' };
    }
    // `#aaccee` is 12.6:1 on the pure-black idle backing but only 4.1:1 on the
    // saturated hover blue — which would leave high-contrast mode *weaker* on
    // hover than normal mode after its own hover fix below.
    return hover
      ? { border: '#e6f0ff', label: '#e6f0ff' }
      : { border: '#aaccee', label: '#aaccee' };
  }
  if (on) {
    return { border: '#44ff88', label: '#44ff88' };
  }
  return hover
    ? { border: '#ccd6e4', label: '#ccd6e4' }
    : { border: '#667788', label: '#8899aa' };
}

/**
 * Resolve an accent colour for action / stepper / cycle buttons, falling back
 * to pure white in high-contrast mode so decorative hues never obscure readability.
 *
 * @param {string}  defaultColor  normal-mode CSS colour string
 * @param {boolean} [highContrast=false]
 * @returns {string}
 */
export function buttonAccentColor(defaultColor, highContrast = false) {
  return highContrast ? '#ffffff' : defaultColor;
}
