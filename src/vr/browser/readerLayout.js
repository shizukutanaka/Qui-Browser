/**
 * Pure layout for the reader viewport — the same split as `bookmarkLayout.js`:
 * all geometry/paging maths lives here so it is unit-testable without a canvas
 * (the test stubs have no `measureText`, and canvas output cannot be verified
 * headlessly), leaving `WebPanel._drawContent()` as a thin draw call.
 */

import { wrapTextToWidth } from '../ui/textWrap.js';

// Content-area canvas is 1024 × 942 (PANEL_W × PANEL_H*(1-CHROME_H) at 1024px).
export const CONTENT_PX_W = 1024;
export const CONTENT_PX_H = 942;
export const CONTENT_PAD = 48;
/** Baseline line height (px) at scale 1. */
export const LINE_H = 34;

/**
 * Line measure in **em**, not characters.
 *
 * Typography research gives different optimal line lengths per script — the
 * classic Latin measure is 45–75 characters, while horizontal Japanese is
 * comfortable at 15–35 characters (NINJAL reading-speed work puts the fastest
 * at ~30/line). Those look like conflicting targets until expressed in em:
 * Latin averages ~0.5 em per character and Japanese exactly 1.0, so a single
 * 34 em measure yields ~68 Latin characters and 34 Japanese characters —
 * both inside their recommended ranges.
 *
 * It also fits: 34 em at the 20px body font is 680px inside the 928px text
 * column. A naive 58-*character* budget (the previous model) rendered ~1160px
 * of Japanese and ran 25% off the panel edge.
 */
export const MEASURE_EM = 34;

/** Lines that fit the viewport at a given scale. */
export function visibleLineCount(scale = 1) {
  const lh = LINE_H * (scale > 0 ? scale : 1);
  return Math.max(1, Math.floor((CONTENT_PX_H - 2 * CONTENT_PAD) / lh));
}

/**
 * Line measure (em) at a given scale. Larger text wraps sooner because the
 * text column is a fixed physical width.
 */
export function measureEmFor(scale = 1) {
  return Math.max(8, MEASURE_EM / (scale > 0 ? scale : 1));
}

/**
 * Widest measure (em) the text column can physically render at `fontPx`,
 * so a caller can prove the chosen measure fits rather than assuming it.
 */
export function maxMeasureEmForFont(fontPx) {
  return (CONTENT_PX_W - 2 * CONTENT_PAD) / Math.max(1, fontPx);
}

/**
 * Turn extracted blocks into a flat, renderable line list.
 *
 * Headings get a blank line before them (never a leading blank at the very
 * top) so structure survives in a plain-text surface; paragraphs are separated
 * by a blank line. Wrapping is code-point-aware via the shared
 * `wrapTextToLines`, so spaceless Japanese hard-splits without severing
 * surrogate pairs.
 *
 * @param {Array<{type:'h'|'p', text:string}>} blocks
 * @param {{scale?: number, title?: string}} [opts]
 * @returns {Array<{text: string, style: 'title'|'h'|'p'|'blank'}>}
 */
export function layoutReaderLines(blocks, opts = {}) {
  const scale = opts.scale > 0 ? opts.scale : 1;
  const measure = measureEmFor(scale);
  const lines = [];

  const push = (text, style) => lines.push({ text, style });
  const blank = () => {
    if (lines.length) {
      push('', 'blank');
    }
  };

  if (opts.title) {
    for (const row of wrapTextToWidth(opts.title, measure)) {
      push(row, 'title');
    }
  }

  for (const b of Array.isArray(blocks) ? blocks : []) {
    if (!b || !b.text) {
      continue;
    }
    blank();
    const style = b.type === 'h' ? 'h' : 'p';
    for (const row of wrapTextToWidth(b.text, measure)) {
      push(row, style);
    }
  }

  return lines;
}

/**
 * Clamp a scroll offset into range. Mirrors `BookmarkPanel._clampScroll`: the
 * draw path and any input path must both route through this so they can never
 * disagree and render an empty window.
 *
 * @param {number} offset
 * @param {number} total   total line count
 * @param {number} visible lines that fit
 * @returns {number}
 */
export function clampReaderScroll(offset, total, visible) {
  const max = Math.max(0, (total || 0) - Math.max(1, visible || 1));
  const n = Number.isFinite(offset) ? Math.floor(offset) : 0;
  return Math.min(Math.max(0, n), max);
}

/**
 * The slice of lines to draw for a clamped offset.
 * @returns {Array<{text: string, style: string}>}
 */
export function readerWindow(lines, offset, visible) {
  const all = Array.isArray(lines) ? lines : [];
  const start = clampReaderScroll(offset, all.length, visible);
  return all.slice(start, start + Math.max(1, visible || 1));
}

/**
 * "12–40/318" style progress label, matching the bookmark panel's convention.
 * Empty string when everything fits (nothing to indicate).
 */
export function readerProgressLabel(offset, total, visible) {
  const n = total || 0;
  const v = Math.max(1, visible || 1);
  if (n <= v) {
    return '';
  }
  const start = clampReaderScroll(offset, n, v);
  return `${start + 1}–${Math.min(start + v, n)}/${n}`;
}

// ── Scroll affordance ────────────────────────────────────────────────────────
// Arrow zones at the bottom-right of the content area, mirroring the bookmark
// panel's convention so a controller ray and gaze-dwell both drive them
// through the same onSelect path.
export const ARROW_W = 96;
export const ARROW_H = 72;
export const ARROW_GAP = 12;
export const ARROW_Y0 = CONTENT_PX_H - ARROW_H - 16;
export const ARROW_DN_X0 = CONTENT_PX_W - ARROW_W - 16;
export const ARROW_UP_X0 = ARROW_DN_X0 - ARROW_W - ARROW_GAP;

/**
 * Lines a page-jump moves.
 *
 * Discrete paging rather than continuous scrolling is the research-supported
 * choice for reading in a headset: text speed and movement mode are significant
 * contributors to cybersickness in HMD reading tasks, and *unexpected or
 * uncontrolled* vection is the strongest predictor of sickness — so a
 * user-initiated jump of a known size is safer than text sliding under the
 * reader. Two lines of overlap preserve reading position across the jump, the
 * same convention as Page Up/Down in a text editor.
 */
export const PAGE_OVERLAP_LINES = 2;

export function pageJumpLines(visible) {
  return Math.max(1, (visible || 1) - PAGE_OVERLAP_LINES);
}

/**
 * Hit-test the reader content area in canvas pixels.
 *
 * @param {number} px
 * @param {number} py
 * @param {boolean} scrollable — arrows are only live when there is more to read
 * @returns {{type: 'scrollUp'|'scrollDown'|'none'}}
 */
export function readerHitTest(px, py, scrollable = false) {
  if (scrollable && py >= ARROW_Y0 && py <= ARROW_Y0 + ARROW_H) {
    if (px >= ARROW_UP_X0 && px <= ARROW_UP_X0 + ARROW_W) {
      return { type: 'scrollUp' };
    }
    if (px >= ARROW_DN_X0 && px <= ARROW_DN_X0 + ARROW_W) {
      return { type: 'scrollDown' };
    }
  }
  return { type: 'none' };
}

/** Font px for a line style at a given scale. */
export function fontPxFor(style, scale = 1) {
  const s = scale > 0 ? scale : 1;
  if (style === 'title') {
    return Math.round(30 * s);
  }
  if (style === 'h') {
    return Math.round(25 * s);
  }
  return Math.round(20 * s);
}
