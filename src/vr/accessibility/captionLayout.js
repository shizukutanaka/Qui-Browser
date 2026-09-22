/**
 * Pure layout maths for the caption panel.
 *
 * Split out of `CaptionSystem` for the same reason `bookmarkLayout.js` and
 * `readerLayout.js` exist: the geometry must be reachable without importing
 * THREE. That lets the real budgets be exercised by the real-browser layout
 * harness (`tools/verify-text-layout.mjs`), which loads these modules over
 * HTTP and measures the produced rows with a real `ctx.measureText`. While the
 * numbers lived as unexported module locals inside a THREE-importing file, the
 * harness — and the unit tests — could only re-derive them by hand, which is
 * how they silently drifted from what was actually drawn.
 *
 * No imports beyond the pure text-width helpers.
 */

import { safeMeasureEm } from '../ui/textWrap.js';

// Panel geometry. Physical size in metres, texture size in px.
export const CAPTION_PANEL_W = 1.2;
export const CAPTION_PANEL_H = 0.32;
export const CAPTION_CANVAS_W = 1024;
export const CAPTION_CANVAS_H = 256;

export const CAPTION_PAD = 24;        // vertical inset for text rows
export const CAPTION_H_PAD = 24;      // horizontal inset so rows don't touch the edge
const CAPTION_MAX_FONT = 44;   // px — single short line
const CAPTION_MIN_FONT = 22;   // px — floor when many rows are stacked

/**
 * Caption line measure in **em**, not characters.
 *
 * Japanese broadcast subtitling standardises on ~16 full-width characters per
 * row and at most 2 rows (some house styles allow 13–20), while Latin subtitle
 * guidelines sit around 37–42 characters. Both are satisfied by one em figure:
 * at 1.0 em per full-width and ~0.5 per Latin character, 20 em gives 20
 * Japanese / 40 Latin characters per row.
 *
 * Expressing the measure in em also removes the circular dependency that made
 * the old fixed character budget wrong: font size is chosen from the row count
 * (`captionFontSizeFor`), but the safe wrap width depends on the font size. An
 * em budget is font-relative by definition, so a row is `measure × fontSize` px
 * wide for whatever font is finally picked. The previous 34-*character* budget
 * rendered 34 full-width glyphs at the 44px single-row font — 1496px on a
 * 1024px canvas, 46% outside the panel. Captions are the deaf/HoH channel, so
 * text leaving the panel is real information loss.
 */
const CAPTION_MEASURE_EM = 20;
export const MAX_ROWS_PER_LINE = 2;  // wrap a caption onto at most this many rows

/** Usable text width (px) inside the caption canvas. */
export const CAPTION_TEXT_W = CAPTION_CANVAS_W - 2 * CAPTION_H_PAD;

/**
 * Line measure in em for a given text scale.
 *
 * Clamped against the *largest* font this scale can produce
 * (`CAPTION_MAX_FONT * scale`), so a row is guaranteed to fit the canvas no
 * matter how many rows end up on screen — which is what breaks the wrap/font
 * circularity. At scale 1 the clamp is inactive; at the 1.5 large-text scale it
 * narrows the measure so 66px text still fits.
 *
 * @param {number} scale
 * @returns {number} em
 */
export function captionMeasureEm(scale = 1) {
  const s = scale > 0 ? scale : 1;
  return Math.max(6, Math.min(CAPTION_MEASURE_EM, safeMeasureEm(CAPTION_TEXT_W, CAPTION_MAX_FONT * s)));
}

/**
 * Row font size (px) for a given row count: scaled cap, bounded to the row.
 *
 * @param {number} nRows
 * @param {number} scale
 * @returns {number} px
 */
export function captionFontSizeFor(nRows, scale = 1) {
  const s = scale > 0 ? scale : 1;
  const rowH = (CAPTION_CANVAS_H - 2 * CAPTION_PAD) / Math.max(nRows, 1);
  return Math.max(CAPTION_MIN_FONT, Math.min(CAPTION_MAX_FONT * s, Math.floor(rowH * 0.62)));
}

// ── Follow mode ───────────────────────────────────────────────────────────────
//
// 'locked' — the panel is a child of the camera and tracks the head 1:1.
// 'lag'    — the panel lives in world space and eases toward the head-anchored
//            pose, so it hangs steady while the user scans around and drifts
//            back into place (the "lag" behaviour below).
//
// Live Captions in Virtual Reality (arXiv:2210.15072) compared head-locked,
// lag and appear-locked caption behaviours with DHH participants: head-locked
// was the broad favourite (≈82.5 %) — which is why it stays the default — but
// preference was genuinely split and the study's own recommendation is to
// offer the choice. 'lag' serves the minority who find a panel glued to the
// head fatiguing; 'appear' is deliberately not offered — it was the least
// comfortable behaviour in the study and drops captions mid-utterance.
export const CAPTION_FOLLOW_MODES = ['locked', 'lag'];

// Exponential smoothing time constant for 'lag' (ms). 300 ms settles the
// panel within ~1 s of a head move ending without visibly swimming during it.
export const CAPTION_FOLLOW_TAU_MS = 300;

// Pose-error thresholds above which 'lag' snaps instead of easing. A snap turn
// (30–90°) or a teleport would otherwise drag the panel visibly through the
// scene — lag is a settling aid, not a way to sweep text across the view.
export const CAPTION_FOLLOW_SNAP_RAD = 0.6; // ≈34° of angular error
export const CAPTION_FOLLOW_SNAP_M = 0.5;   // metres of positional error

/**
 * Per-frame blend weight for 'lag' mode, frame-rate independent exponential
 * smoothing: a = 1 − e^(−dt/τ). Pure so the follow maths is testable without
 * THREE.
 *
 * @param {number} dtMs frame delta in milliseconds
 * @returns {number} blend weight in [0, 1)
 */
export function captionFollowAlpha(dtMs) {
  const dt = Number(dtMs);
  if (!Number.isFinite(dt) || dt <= 0) {
    return 0;
  }
  return 1 - Math.exp(-dt / CAPTION_FOLLOW_TAU_MS);
}
