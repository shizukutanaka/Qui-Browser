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
export const CAPTION_MAX_FONT = 44;   // px — single short line
export const CAPTION_MIN_FONT = 22;   // px — floor when many rows are stacked

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
export const CAPTION_MEASURE_EM = 20;
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
