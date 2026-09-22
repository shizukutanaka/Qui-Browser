/**
 * Pure layout for the reader viewport — the same split as `bookmarkLayout.js`:
 * all geometry/paging maths lives here so it is unit-testable without a canvas
 * (the test stubs have no `measureText`, and canvas output cannot be verified
 * headlessly), leaving `WebPanel._drawContent()` as a thin draw call.
 */

import { wrapTextToWidth, safeMeasureEm, textWidthEm } from '../ui/textWrap.js';

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

// ── Scroll affordance ────────────────────────────────────────────────────────
// Arrow zones at the bottom-right of the content area, mirroring the bookmark
// panel's convention so a controller ray and gaze-dwell both drive them
// through the same onSelect path.
export const ARROW_W = 96;
export const ARROW_H = 72;
const ARROW_GAP = 12;
export const ARROW_Y0 = CONTENT_PX_H - ARROW_H - 16;
export const ARROW_DN_X0 = CONTENT_PX_W - ARROW_W - 16;
export const ARROW_UP_X0 = ARROW_DN_X0 - ARROW_W - ARROW_GAP;

/**
 * Vertical strip at the bottom of the content area reserved for the paging
 * affordance — the ▲▼ arrows and the "12–34/56" progress label.
 *
 * `visibleLineCount` used to fill the *whole* content height, so the last text
 * line was drawn straight through that strip: measured at scale 1 the last
 * baseline lands at y=864 with ink to y=868, inside the arrow band that starts
 * at y=854, and a long line runs under the buttons horizontally too (the text
 * column reaches x=976, the arrows start at x=804). It got worse, not better,
 * with the reader text-scale control that low-vision users need — at scale 1.3
 * the last line collides with the progress label as well.
 */
const CONTENT_BOTTOM_GAP = 8;
export const CONTENT_BOTTOM_RESERVED = (CONTENT_PX_H - ARROW_Y0) + CONTENT_BOTTOM_GAP;

/**
 * Baseline-to-baseline pitch (px) a line of `style` occupies at `scale`.
 *
 * WCAG 1.4.12's 1.5 line-height guidance exists for dyslexic and low-vision
 * readers — glyphs need air between rows. A single 34px pitch gave title and
 * heading lines ratios of 1.13 and 1.36 (a two-line Japanese title rendered
 * with ~1px of gap between rows). Pitch is now the greater of the shared
 * 34px floor and 1.5× the style's own font size: title 45px (ratio 1.5),
 * heading 38px (1.52), body and blank stay 34px (1.7), code stays 34px (2.0).
 *
 * @param {'title'|'h'|'p'|'c'|'blank'} style
 * @param {number} [scale=1]
 * @returns {number} px
 */
export function linePitchFor(style, scale = 1) {
  const s = scale > 0 ? scale : 1;
  return Math.max(LINE_H * s, Math.ceil(1.5 * fontPxFor(style, s)));
}

/** Pixel budget available for reader lines in the content area. */
export function readerAvailPx(reserveBottom = false) {
  return CONTENT_PX_H - 2 * CONTENT_PAD
    - (reserveBottom ? CONTENT_BOTTOM_RESERVED : 0);
}

/** Rendered height (px) of the whole line list — pitches summed per style. */
export function contentHeightPx(lines, scale = 1) {
  let px = 0;
  for (const l of Array.isArray(lines) ? lines : []) {
    px += linePitchFor(l && l.style, scale);
  }
  return px;
}

/**
 * Whether the article is scrollable — taller than the open viewport.
 *
 * The scroll affordance (arrows + progress label) is drawn iff this holds,
 * and the bottom strip is reserved whenever it does. Same stable rule the
 * count-based version used: reserving only shrinks the window, so an article
 * that overflows unreserved still overflows reserved.
 */
export function readerOverflows(lines, scale = 1) {
  return contentHeightPx(lines, scale) > readerAvailPx(false);
}

/**
 * Whole lines that fit inside `availPx` starting at `start`. Always ≥1 — a
 * start line is drawn even when its own pitch already overflows the window,
 * so no offset can render an empty viewport.
 */
export function readerFitCount(lines, start, availPx, scale = 1) {
  const all = Array.isArray(lines) ? lines : [];
  const s = Math.min(Math.max(0, Math.floor(Number(start) || 0)), all.length);
  if (s >= all.length) {
    return 0;
  }
  let used = 0;
  let n = 0;
  for (let i = s; i < all.length; i++) {
    const pitch = linePitchFor(all[i] && all[i].style, scale);
    if (n > 0 && used + pitch > availPx) {
      break;
    }
    used += pitch;
    n++;
  }
  return Math.max(1, n);
}

/**
 * Furthest scroll offset (line index) whose window still reaches the end of
 * the article — the first index where the remaining lines fit inside
 * `availPx`. For a uniform pitch this is exactly `total - floor(avail/pitch)`;
 * with per-style pitches the tail is summed instead of counted.
 */
export function lastReaderStart(lines, availPx, scale = 1) {
  const all = Array.isArray(lines) ? lines : [];
  let used = 0;
  for (let i = all.length - 1; i >= 0; i--) {
    used += linePitchFor(all[i] && all[i].style, scale);
    if (used > availPx) {
      return i + 1;
    }
  }
  return 0;
}

/**
 * Line measure (em) at a given scale. Larger text wraps sooner because the
 * text column is a fixed physical width.
 */
export function measureEmFor(scale = 1) {
  return Math.max(8, MEASURE_EM / (scale > 0 ? scale : 1));
}

/**
 * Measure (em) for a specific line style.
 *
 * Styles are drawn at different font sizes (`fontPxFor`), but the text column
 * is one fixed physical width — so one measure cannot serve them all. Wrapping
 * a title at the *body* measure produced 34 em of glyphs at the title's larger
 * font, which overflowed the column (a long Japanese page title ran ~105px
 * past it). Each style is therefore also clamped by what its own font can fit.
 *
 * @param {'title'|'h'|'p'|'c'} style
 * @param {number} scale
 * @returns {number} em
 */
function measureEmForStyle(style, scale = 1) {
  const textW = CONTENT_PX_W - 2 * CONTENT_PAD;
  return Math.min(measureEmFor(scale), safeMeasureEm(textW, fontPxFor(style, scale)));
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
 * by a blank line. Wrapping is em-width-aware via the shared
 * `wrapTextToWidth`, so spaceless Japanese hard-splits without severing
 * surrogate pairs or grapheme clusters.
 *
 * @param {Array<{type:'h'|'p'|'pre', text:string}>} blocks
 * @param {{scale?: number, title?: string}} [opts]
 * @returns {Array<{text: string, style: 'title'|'h'|'p'|'c'|'blank'}>}
 */
export function layoutReaderLines(blocks, opts = {}) {
  const scale = opts.scale > 0 ? opts.scale : 1;
  const lines = [];

  const push = (text, style) => lines.push({ text, style });
  const blank = () => {
    if (lines.length) {
      push('', 'blank');
    }
  };

  if (opts.title) {
    for (const row of wrapTextToWidth(opts.title, measureEmForStyle('title', scale))) {
      push(row, 'title');
    }
  }

  for (const b of Array.isArray(blocks) ? blocks : []) {
    if (!b || !b.text) {
      continue;
    }
    blank();
    if (b.type === 'pre') {
      // Code: each physical source line is its own visual row (wrapped only
      // when it exceeds the measure) so line structure survives. Leading
      // indentation is split off before wrapping — wrapTextToWidth trims
      // leading whitespace — and re-attached to every emitted row (hanging
      // indent), so a wrapped statement keeps its nesting level legible.
      const em = measureEmForStyle('c', scale);
      for (const raw of b.text.split('\n')) {
        const m = raw.match(/^(\s*)([\s\S]*)$/);
        const indent = m[1];
        const body = m[2];
        if (body === '') {
          push(raw === '' ? '' : indent, 'c');
          continue;
        }
        const innerEm = Math.max(1, em - textWidthEm(indent));
        for (const row of wrapTextToWidth(body, innerEm)) {
          push(indent + row, 'c');
        }
      }
      continue;
    }
    const style = b.type === 'h' ? 'h' : 'p';
    for (const row of wrapTextToWidth(b.text, measureEmForStyle(style, scale))) {
      push(row, style);
    }
  }

  return lines;
}

/**
 * Clamp a scroll offset (line index) into range. Mirrors
 * `BookmarkPanel._clampScroll`: the draw path and any input path must both
 * route through this so they can never disagree and render an empty window.
 * The bottom reserve is applied whenever the article overflows — the same
 * rule the arrows use, so hit-test and draw stay consistent.
 *
 * @param {Array<{text: string, style: string}>} lines
 * @param {number} offset
 * @param {number} [scale=1]
 * @returns {number} clamped line index
 */
export function clampReaderScroll(lines, offset, scale = 1) {
  const max = lastReaderStart(lines, readerAvailPx(readerOverflows(lines, scale)), scale);
  const n = Number.isFinite(offset) ? Math.floor(offset) : 0;
  return Math.min(Math.max(0, n), max);
}

/**
 * The slice of lines to draw for a clamped offset — as many whole lines as
 * fit inside the effective pixel budget (bottom strip reserved while the
 * article is scrollable).
 * @returns {Array<{text: string, style: string}>}
 */
export function readerWindow(lines, offset, scale = 1) {
  const all = Array.isArray(lines) ? lines : [];
  const start = clampReaderScroll(all, offset, scale);
  const count = readerFitCount(all, start, readerAvailPx(readerOverflows(all, scale)), scale);
  return all.slice(start, start + count);
}

/**
 * "12–40/318" style progress label, matching the bookmark panel's convention.
 * Empty string when everything fits (nothing to indicate).
 */
export function readerProgressLabel(lines, offset, scale = 1) {
  const all = Array.isArray(lines) ? lines : [];
  const n = all.length;
  if (!readerOverflows(all, scale)) {
    return '';
  }
  const start = clampReaderScroll(all, offset, scale);
  const count = readerFitCount(all, start, readerAvailPx(true), scale);
  return `${start + 1}–${Math.min(start + count, n)}/${n}`;
}


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

/**
 * Offset delta for one page jump — the window fitted at `offset` minus two
 * lines of overlap. The jump size is still a known line count (the discrete
 * paging rationale above is unchanged); it is just measured from the styled
 * window now that line heights vary per style.
 */
export function readerPageJump(lines, offset, scale = 1) {
  const start = clampReaderScroll(lines, offset, scale);
  const count = readerFitCount(lines, start, readerAvailPx(readerOverflows(lines, scale)), scale);
  return Math.max(1, count - PAGE_OVERLAP_LINES);
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
  if (style === 'c') {
    // Code renders a touch smaller — density matters more than emphasis,
    // and monospace advance (~0.6em) packs more per line anyway.
    return Math.round(17 * s);
  }
  return Math.round(20 * s);
}
