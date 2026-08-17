/**
 * World-space geometry of the browser panels, and the distances they sit at.
 *
 * These were module-private constants inside `WebPanel.js`, `TabManager.js` and
 * `WindowManager.js` — all three of which import Three.js, so nothing could
 * read them without a GPU-less mock. That is why no test had ever checked the
 * one property that decides whether these controls can be used at all: the
 * angle each target subtends at the eye. Same reason the caption/reader budgets
 * were extracted in Session 68 and the palettes in Session 69 — a value that
 * cannot be imported cannot be verified.
 *
 * Metres throughout. Canvas pixel dimensions live here too, because a target
 * painted as a pixel range inside a texture only has a real size in
 * combination with the mesh it is drawn on.
 *
 * Pure: imports only the (pure) angular-size helpers.
 */

import { sizeForAngleM, HIT_TARGET_MIN_DEG } from '../ui/angularSize.js';

// ── Distances ───────────────────────────────────────────────────────────────

/** Default panel-to-user distance (m) — comfortable for most users. */
export const PANEL_DISTANCE_DEFAULT = 2.0;

/**
 * Panel distance (m) when the OS largeText preference is set.
 *
 * Text legibility in VR depends on angular size = physical_size / distance.
 * Bringing the panel from 2.0 m → 1.2 m gives a 1.67× angular size increase
 * for the same text — equivalent to a 67 % font scale with no DOM changes.
 * 1.2 m sits in the comfortable near-field reading zone (≥ minDistance 0.6 m)
 * without feeling claustrophobic.
 */
export const PANEL_DISTANCE_LARGE_TEXT = 1.2;

/** Bounds of the user-facing "Panel Distance" stepper (`vr.settings.panelDist`). */
export const PANEL_DISTANCE_MIN = 0.6;
export const PANEL_DISTANCE_MAX = 6.0;

// ── Web panel ───────────────────────────────────────────────────────────────

export const PANEL_W = 1.6;    // metres
export const PANEL_H = 1.0;
export const CHROME_H = 0.08;  // URL bar height as a fraction of PANEL_H

/** Chrome-bar mesh height in metres, and its canvas dimensions. */
export const CHROME_M_H = PANEL_H * CHROME_H;
export const CHROME_CANVAS_W = 1024;
export const CHROME_CANVAS_H = Math.round(CHROME_CANVAS_W * CHROME_H);

/** Content-viewport mesh height in metres (canvas dims live in readerLayout). */
export const CONTENT_M_H = PANEL_H * (1 - CHROME_H);

// ── Move bar (grab-to-move handle) ──────────────────────────────────────────

export const MOVE_BAR_W = PANEL_W * 0.3; // narrower than the full panel
export const MOVE_BAR_H = 0.035;         // VISIBLE bar height
export const MOVE_BAR_GAP = 0.015;       // gap below the panel's bottom edge

/**
 * Hit height of the grab handle — deliberately larger than the visible bar.
 *
 * `MOVE_BAR_H` subtends only **1.00°** at `PANEL_DISTANCE_DEFAULT`, below the
 * 1.5° minimum object size the gaze-dwell literature gives for dwell selection
 * (see `angularSize.js`). Gaze-dwell is this project's primary input path for
 * users who cannot use a controller, so the single control that repositions the
 * whole browser was effectively unreachable for exactly them. Tripling the
 * drawn bar to fix that would be a visual regression, so this applies Meta
 * Horizon OS's own prescribed remedy: invisible **hitslop** around a small
 * visual target. Sized to `HIT_TARGET_MIN_DEG` at the default distance, with
 * the bar painted into the middle band of an otherwise transparent texture —
 * the handle looks identical, the raycast target is three times taller.
 */
export const MOVE_BAR_HIT_H = sizeForAngleM(HIT_TARGET_MIN_DEG, PANEL_DISTANCE_DEFAULT);

// ── Tab strip ───────────────────────────────────────────────────────────────

export const STRIP_W = 1.6;   // metres — matches panel width
export const STRIP_H = 0.07;
export const STRIP_CANVAS_W = 1024;
export const STRIP_CANVAS_H = 96;
/** Width of the "+" new-tab zone, and of each tab's close zone, in canvas px. */
export const STRIP_NEW_TAB_PX = 90;
export const STRIP_CLOSE_PX = 36;
export const STRIP_TAB_MAX_PX = 220;

// ── Bookmark / history panel ────────────────────────────────────────────────

export const BOOKMARK_PANEL_W = 1.2; // metres (height derives from the canvas aspect)

/**
 * Width of each tab in the strip, in canvas pixels.
 * @param {number} tabCount
 * @param {number} [canvasW=STRIP_CANVAS_W]
 * @returns {number} 0 when there are no tabs
 */
export function tabWidthPx(tabCount, canvasW = STRIP_CANVAS_W) {
  const n = Math.max(0, Math.floor(Number(tabCount) || 0));
  if (n === 0) {
    return 0;
  }
  return Math.min(STRIP_TAB_MAX_PX, (canvasW - STRIP_NEW_TAB_PX) / n);
}

/**
 * Canvas-pixel span of a tab's close (✕) zone, relative to the tab's left edge.
 *
 * Shared by the draw path and the hit test because they used to disagree: the
 * red ✕ box was drawn `tabW - 38` wide by `height - 20` **square** — 76 px — so
 * with 8 tabs open (tabW ≈ 117 px) it extended ~38 px past the tab's own right
 * edge and sat on top of the neighbouring tab, while `_onStripSelect` only
 * treated the rightmost 36 px as "close". Aiming at the right half of a clearly
 * visible ✕ therefore switched to the next tab instead of closing anything.
 *
 * @param {number} tabW  tab width in canvas px
 * @returns {{x0: number, x1: number, w: number}} relative to the tab's left edge
 */
export function tabCloseZonePx(tabW) {
  const w = Math.max(0, Number(tabW) || 0);
  const zone = Math.min(STRIP_CLOSE_PX, w);
  return { x0: w - zone, x1: w, w: zone };
}
