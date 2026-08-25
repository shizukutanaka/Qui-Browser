/**
 * Canvas colour palette for the browser chrome bar (back / forward / reload /
 * address bar / bookmark star / close).
 *
 * Why this module exists: `WebPanel._drawChrome()` painted every one of these
 * colours as an inline literal and never consulted `prefersHighContrast()` —
 * only its sibling `_drawContent()` did. So a low-vision user who turned on the
 * OS "increase contrast" preference got a high-contrast *page viewport* sitting
 * directly above a chrome bar that ignored the preference entirely: the
 * browser's only control surface, and the one place a user must be able to read
 * the address they are on. Extracting the palette to a pure function (the same
 * shape as `bookmarkPanelColors`) makes the high-contrast variant possible and
 * makes both variants measurable by tests/contrast.test.js.
 *
 * Normal-mode values that were measured failing and are fixed here:
 *
 *   • Disabled ◀/▶ glyph was `#44445a` on `#22222e` — **1.66:1**, effectively
 *     invisible. WCAG 2 exempts inactive components (1.4.3 and 1.4.11 both
 *     carve them out), so this was not a conformance failure — but "exempt"
 *     assumes the user can still see that a disabled control is there. At
 *     1.66:1 on an emissive HMD panel the back button simply is not present to
 *     the eye. Now `#74788f` (3.6:1), still ~3× dimmer than the enabled
 *     `#ffffff` (10.8:1), so "unavailable" is still legible as a state.
 *   • Address-bar placeholder was `#888899` on `#2a2a4a` — **3.94:1** at 18px
 *     regular, under the 4.5:1 that 1.4.3 requires for body text. Placeholder
 *     text is ordinary text and gets no exemption. Now `#9aa0b8` (5.3:1).
 *   • The address bar's own boundary was `#2a2a4a` on `#1e1e3f` — **1.16:1**.
 *     An empty address bar renders as placeholder text and nothing else, so the
 *     fill was the only thing conveying where the tap target is; 1.4.11 names
 *     exactly this case (identifying a text input's extent). A `#7d88bd` border
 *     (4.7:1 against the bar surround) now carries the boundary.
 *
 * The button fills (`#3a3a5c` on `#1e1e3f`, 1.48:1) are deliberately left
 * alone: each button carries a ≥10:1 glyph that identifies the control, which
 * is what 1.4.11 asks for. Only the address bar has no glyph of its own.
 *
 * Pure / dependency-free.
 *
 * @param {boolean} [highContrast=false]
 * @returns {object} palette consumed by WebPanel._drawChrome
 */
export function webChromeColors(highContrast = false) {
  if (highContrast) {
    return {
      bg:              '#000000',
      btnEnabledBg:    '#004adf',
      btnEnabledText:  '#ffffff',
      btnDisabledBg:   '#222222',
      btnDisabledText: '#aaccee',
      reloadBg:        '#004adf',
      reloadText:      '#ffffff',
      reloadLoading:   '#ffff00',
      urlBg:           '#000000',
      urlErrorBg:      '#3a0000',
      urlBorder:       '#ffffff',
      urlText:         '#ffffff',
      urlPlaceholder:  '#cccccc',
      errorText:       '#ffaaaa',
      starBg:          '#004adf',
      starMarked:      '#ffdd00',
      starUnmarked:    '#ffffff',
      closeBg:         '#7a0000',
      closeText:       '#ffffff'
    };
  }
  return {
    bg:              '#1e1e3f',
    btnEnabledBg:    '#3a3a5c',
    btnEnabledText:  '#ffffff',
    btnDisabledBg:   '#22222e',
    btnDisabledText: '#74788f',
    reloadBg:        '#3a3a5c',
    reloadText:      '#ffffff',
    reloadLoading:   '#ffaa00',
    urlBg:           '#2a2a4a',
    urlErrorBg:      '#3a1a1a',
    urlBorder:       '#7d88bd',
    urlText:         '#e0e0ff',
    urlPlaceholder:  '#9aa0b8',
    errorText:       '#ff7777',
    starBg:          '#3a3a5c',
    starMarked:      '#ffcc44',
    starUnmarked:    '#aaaabb',
    closeBg:         '#5c1a1a',
    closeText:       '#ffffff'
  };
}

/**
 * Colours for the page-viewport surface below the chrome bar (the reader view
 * and the "cannot show this page" state screens).
 *
 * `WebPanel._drawContent`/`_drawReader` already honoured high contrast, so
 * this only lifts the existing literals out to where they can be measured —
 * with one fix: the inactive reader scroll arrow was `#445566` on the rendered
 * arrow backing, **2.12:1**. Same reasoning as the bookmark panel's arrows:
 * formally exempt as an inactive control, but it is also the only thing
 * telling the reader that paging exists, so it is now `#727f96` (4.0:1).
 *
 * @param {boolean} [highContrast=false]
 * @returns {object} palette consumed by WebPanel._drawContent / _drawReader
 */
export function webContentColors(highContrast = false) {
  if (highContrast) {
    return {
      bg:              '#000000',
      stateTitle:      '#ffffff',
      stateDetail:     '#dddddd',
      readerHeading:   '#ffffff',
      readerBody:      '#ffffff',
      // Links carry a number as their primary cue (WCAG 1.4.1); the colour is
      // reinforcement. In high contrast it still has to be distinguishable
      // from body text AND readable on the backing, so it is a light tint
      // rather than a saturated hue.
      readerLink:      '#8fd0ff',
      progress:        '#ffffff',
      arrowActiveBg:   '#004adf',
      arrowActiveText: '#ffffff',
      arrowIdleBg:     '#222222',
      arrowIdleText:   '#aaccee'
    };
  }
  return {
    bg:              '#1a1a2e',
    stateTitle:      '#a0a0b8',
    stateDetail:     '#8891ad',
    readerHeading:   '#ffffff',
    readerBody:      '#d6dcf0',
    readerLink:      '#7fb8ff',
    progress:        '#7788aa',
    arrowActiveBg:   'rgba(50,80,140,0.9)',
    arrowActiveText: '#aabbff',
    arrowIdleBg:     'rgba(30,35,55,0.6)',
    arrowIdleText:   '#727f96'
  };
}
