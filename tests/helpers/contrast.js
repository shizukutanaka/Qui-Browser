/**
 * Colour-contrast measurement for the canvas-drawn VR UI.
 *
 * Why this exists: every surface in this app is painted into a `<canvas>` and
 * composited into a WebGL texture, so no browser devtools "contrast checker"
 * can ever inspect it and no human can eyeball it in a headless test. That is
 * the same blind spot that let the Japanese text-overflow family (Sessions
 * 62–68) survive six sessions — the fix there was to make the rule measurable
 * (`tools/verify-text-layout.mjs`); this is the same move for colour.
 *
 * Before this module the only contrast maths in the repo lived inline inside
 * `tests/button-style.test.js`. That copy handled 6-digit hex ONLY, so it could
 * not evaluate a single `rgba()` value — and `rgba()` is exactly what the
 * button backing, the toast backing, the bookmark rows and the scroll arrows
 * are painted with. The colours most likely to be wrong were the ones it was
 * structurally unable to check.
 *
 * Two metrics are provided, deliberately:
 *
 *  - `contrastRatio` — WCAG 2.x (SC 1.4.3 / 1.4.11). This is the normative
 *    standard and the only one this project gates on.
 *  - `apcaLc` — APCA, the WCAG 3 candidate contrast method. WCAG 2's ratio is
 *    known to over-state contrast for light-on-dark pairs near black, which is
 *    every surface here, on an emissive head-mounted display. APCA is reported
 *    (see `docs/OUTSTANDING_ISSUES.md` G) but not enforced: it is not a
 *    requirement, and conforming to it would be a visual redesign rather than
 *    a defect fix.
 *
 * Pure and dependency-free, so the palette invariants are unit-testable.
 */

/**
 * Parse a CSS colour string into 8-bit RGB plus alpha.
 * Accepts `#rgb`, `#rrggbb`, `rgb(r,g,b)` and `rgba(r,g,b,a)` — the four forms
 * this codebase actually paints with. Returns `null` for anything else rather
 * than guessing, so an unsupported form fails loudly in a test instead of
 * silently scoring as black.
 *
 * @param {string} css
 * @returns {{r:number,g:number,b:number,a:number}|null}
 */
export function parseCssColor(css) {
  const s = String(css === null || css === undefined ? '' : css).trim();
  const fn = s.match(/^rgba?\(([^)]*)\)$/i);
  if (fn) {
    const parts = fn[1].split(',').map((p) => parseFloat(p.trim()));
    if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) {
      return null;
    }
    const a = parts.length > 3 && Number.isFinite(parts[3]) ? parts[3] : 1;
    return {
      r: clamp255(parts[0]),
      g: clamp255(parts[1]),
      b: clamp255(parts[2]),
      a: Math.min(1, Math.max(0, a))
    };
  }
  const hx = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!hx) {
    return null;
  }
  const h = hx[1].length === 3
    ? hx[1].split('').map((c) => c + c).join('')
    : hx[1];
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: 1
  };
}

function clamp255(n) {
  return Math.min(255, Math.max(0, n));
}

/**
 * Composite a possibly-translucent colour over an opaque backdrop, returning
 * the opaque colour a viewer actually sees.
 *
 * Contrast is a property of rendered pixels, not of declared colours: a button
 * painted `rgba(16,20,30,0.92)` over a black panel is not `rgb(16,20,30)`, and
 * scoring the declared value would report a ratio that no user experiences.
 *
 * @param {string} css      foreground, may carry alpha
 * @param {string} backdrop opaque colour underneath
 * @returns {string} `#rrggbb`
 */
export function compositeOver(css, backdrop) {
  const f = parseCssColor(css);
  const b = parseCssColor(backdrop);
  if (!f) {
    return typeof backdrop === 'string' ? String(backdrop) : '#000000';
  }
  if (!b || f.a >= 1) {
    return toHex(f.r, f.g, f.b);
  }
  return toHex(
    f.r * f.a + b.r * (1 - f.a),
    f.g * f.a + b.g * (1 - f.a),
    f.b * f.a + b.b * (1 - f.a)
  );
}

function toHex(r, g, b) {
  const h = (n) => Math.round(clamp255(n)).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** WCAG 2.x sRGB relative luminance of an opaque colour. */
export function relativeLuminance(css) {
  const c = parseCssColor(css);
  if (!c) {
    return 0;
  }
  const lin = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/**
 * WCAG 2.x contrast ratio, in [1, 21].
 *
 * Both colours are composited over `backdrop` first, so translucent fills are
 * scored as rendered. The foreground is composited over the *rendered*
 * background, which is what actually happens on a canvas.
 *
 * @param {string} fg
 * @param {string} bg
 * @param {string} [backdrop='#000000'] opaque surface beneath a translucent bg
 * @returns {number}
 */
export function contrastRatio(fg, bg, backdrop = '#000000') {
  const rbg = compositeOver(bg, backdrop);
  const rfg = compositeOver(fg, rbg);
  const a = relativeLuminance(rfg);
  const b = relativeLuminance(rbg);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Minimum WCAG 2.x contrast ratio required for a piece of UI.
 *
 * "Large text" is ≥ 18.66px bold or ≥ 24px regular (WCAG's 14pt-bold / 18pt at
 * the 1px = 0.75pt CSS convention). Non-text UI (borders, indicators, state
 * affordances) is governed by 1.4.11 at a flat 3:1.
 *
 * @param {{fontPx?: number, bold?: boolean, nonText?: boolean}} spec
 * @returns {number} 3 or 4.5
 */

export function wcagMinimum(spec = {}) {
  if (spec.nonText) {
    return 3;
  }
  const px = Number(spec.fontPx) || 0;
  const large = spec.bold ? px >= 18.66 : px >= 24;
  return large ? 3 : 4.5;
}
