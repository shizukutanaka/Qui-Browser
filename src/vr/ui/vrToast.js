/**
 * Cross-modal VR toast: a short-lived canvas-texture quad pinned to the camera,
 * mirrored to the ARIA alert region and announced on haptic + caption channels
 * (a toast must never be conveyed by sight alone).
 *
 * Extracted from VRApp — `app` supplies camera/semanticDOM/haptics/captions and
 * the _toastTimers registry so dispose() can still clear pending dismissals.
 */

import * as THREE from 'three';
import { configureUITexture } from './canvasTexture.js';
import { notifyCrossModal, withSeverity, toastColors, toastFontPx } from '../accessibility/crossModal.js';
import { getPrefs, largeTextScale, prefersHighContrast } from '../../a11y/accessibility.js';

export function showVRToast(app, message, { type = 'error', duration = 4000 } = {}) {
  // Mirror to the hidden ARIA alert region unconditionally, before the
  // VR-session guard below. Several subsystem-failure toasts (haptics,
  // spatial audio) fire during initializeSystems() — before the user
  // has entered VR at all — so gating the mirror on isVREnabled/camera the
  // same way the 3D mesh is gated would silently drop them a second time.
  app.semanticDOM?.announceAlert(withSeverity(message, type));

  if (!app.isVREnabled || !app.camera) {
    return;
  }

  const W = 512, H = 80;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Honour the high-contrast / large-text accessibility preferences (same
  // signals as the 2D layer and the caption panel).
  const c = toastColors(type, prefersHighContrast());
  const fontPx = toastFontPx(largeTextScale(getPrefs().largeText));

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = c.bdr;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, W - 4, H - 4);
  // Prefix a severity glyph so the level reads without relying on colour alone.
  const labeled = withSeverity(message, type);
  ctx.fillStyle = c.fg;
  ctx.font = `bold ${fontPx}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Truncate by code point (not UTF-16 unit) so a long translated/Japanese
  // toast can't be cut mid-surrogate-pair, leaving a broken � (see truncate()).
  const labeledChars = Array.from(labeled);
  const shown = labeledChars.length > 60
    ? labeledChars.slice(0, 57).join('') + '…'
    : labeled;
  ctx.fillText(shown, W / 2, H / 2);

  const tex = configureUITexture(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.085),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false })
  );
    // Centred slightly below eye level, 0.8 m in front.
  mesh.position.set(0, -0.12, -0.8);
  mesh.renderOrder = 999; // always on top
  app.camera.add(mesh);

  // Track the auto-dismiss timer so dispose() can clear it; otherwise the
  // callback fires later against a torn-down VRApp (null camera, freed GPU
  // resources) and produces a console error in tests / hot-reload / SPA nav.
  const timer = setTimeout(() => {
    app._toastTimers.delete(timer);
    if (app.camera) {
      app.camera.remove(mesh);
    }
    mesh.geometry.dispose();
    tex.dispose();
    mesh.material.dispose();
  }, duration);
  app._toastTimers.add(timer);

  // Accessibility equity: a toast must never be conveyed by sight alone, so
  // mirror it onto every available non-visual channel (haptic + captions).
  // The caption gets the same severity-labelled text the panel shows.
  notifyCrossModal(app.hapticFeedback, app.captionSystem, labeled, type);
}
