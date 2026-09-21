/**
 * WCAG 1.4.3 contrast pins for the landing palette — computed from the real
 * custom properties, not eyeball estimates. An accessibility-first product
 * whose own landing page fails AA is the worst kind of claim-vs-code gap.
 *
 * Both themes are exercised: default (:root) and body.a11y-high-contrast.
 * Pairs listed here are every foreground/background combination the landing
 * page actually renders text on top of.
 */
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'src/styles/main.css'), 'utf8');

function vars(blockRe) {
  const out = {};
  const block = css.match(blockRe)[0];
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6})/g)) {
    let h = m[2].slice(1);
    if (h.length === 3) { h = h.split('').map((c) => c + c).join(''); }
    out[m[1]] = h;
  }
  return out;
}

const normal = vars(/:root\s*\{[^}]+\}/);
const hc = vars(/body\.a11y-high-contrast\s*\{[^}]+\}/);

function lum(hex) {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(fg, bg) {
  const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

// [label, fg, bg, theme-vars] — every text-on-fill pair the landing paints.
const PAIRS = [
  ['body text on background', 'ffffff', 'color-background', normal],
  ['subtle text on background', 'color-text-subtle', 'color-background', normal],
  ['subtle text on surface card', 'color-text-subtle', 'color-surface', normal],
  ['vr accent text on background', 'color-vr', 'color-background', normal],
  ['cta text on vr fill', 'ffffff', 'color-vr-strong', normal],
  ['cta text on hover fill', 'ffffff', 'color-primary-hover', normal],
  ['hc body text on black', 'color-text', 'color-background', hc],
  ['hc accent text on black', 'color-vr', 'color-background', hc],
  ['hc cta text on yellow fill', '000000', 'color-vr-strong', hc],
  ['hc cta text on hover fill', '000000', 'color-primary-hover', hc]
];

describe('landing-page contrast — WCAG 1.4.3 AA (4.5:1 normal text)', () => {
  for (const [label, fgSpec, bgSpec, theme] of PAIRS) {
    test(`${label} ≥ 4.5:1`, () => {
      const fg = theme[fgSpec] ?? fgSpec;
      const bg = theme[bgSpec] ?? bgSpec;
      expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
