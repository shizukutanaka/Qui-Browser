/**
 * Shared configuration for canvas-backed UI textures.
 *
 * Every in-VR UI surface (settings buttons, captions, the Japanese keyboard,
 * the tab strip, browser chrome, bookmark panel, avatar labels …) is drawn to
 * a 2D canvas and shown on a flat quad viewed roughly head-on. Such textures
 * never benefit from mipmaps, yet THREE.CanvasTexture enables them by default:
 *
 *   • Memory — a full mip pyramid costs ~33 % extra GPU memory per texture,
 *     multiplied across the dozens of UI textures a session creates.
 *   • Upload cost — for textures refreshed via `needsUpdate = true` (captions,
 *     tab strip, keyboard display, browser chrome), the mip chain is
 *     regenerated on *every* redraw, not just at creation.
 *   • Sharpness — mip downsampling blurs crisp text when the panel is even
 *     slightly distant; a linear min filter samples the full-resolution canvas.
 *
 * Disabling mipmaps and using a linear min filter fixes all three. This is the
 * standard Three.js guidance for flat UI textures (reuse identical settings in
 * one place rather than repeating them at every creation site).
 *
 * @param {THREE.Texture} tex  a freshly constructed CanvasTexture
 * @returns {THREE.Texture} the same texture, configured for crisp flat UI
 */
import * as THREE from 'three';

export function configureUITexture(tex) {
  if (!tex) {
    return tex;
  }
  tex.generateMipmaps = false;
  // Guard the constant so the helper is safe under a mocked `three` that may
  // not export LinearFilter; in production this is THREE.LinearFilter (1006).
  if (THREE.LinearFilter !== undefined) {
    tex.minFilter = THREE.LinearFilter;
  }
  // Canvas 2D paints in sRGB. Since three r152 a texture without an explicit
  // SRGBColorSpace is treated as linear data and re-encoded on output —
  // double-gamma: UI colors render washed out and wrong. Marking every UI
  // canvas texture here keeps that rule un-forgettable (WebPanel's three
  // textures and the tab strip had silently skipped it before).
  if (THREE.SRGBColorSpace !== undefined) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  return tex;
}
