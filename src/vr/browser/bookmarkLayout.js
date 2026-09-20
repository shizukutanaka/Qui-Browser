import { safeMeasureEm } from '../ui/textWrap.js';
/**
 * Pure layout / hit-testing helpers for the in-VR bookmark & history panel.
 *
 * Kept free of Three.js so the row math can be unit-tested headlessly. The
 * panel canvas is laid out as:
 *
 *   ┌─────────────────────────────────────┐
 *   │ [Bookmarks] [History]          [✕]   │  header (HEADER_H)
 *   ├─────────────────────────────────────┤
 *   │ row 0                                │
 *   │ row 1                                │  rows (ROW_H each)
 *   │ …                                    │
 *   └─────────────────────────────────────┘
 */

export const PANEL_PX_W = 1024;
export const PANEL_PX_H = 768;
export const HEADER_H = 96;
export const ROW_H = 72;

// Number of list rows that fit below the header.
export const VISIBLE_ROWS = Math.floor((PANEL_PX_H - HEADER_H) / ROW_H);

// Width of the per-row delete (✕) button zone on the right side.
export const DELETE_ZONE_W = 64;

// Scroll arrow zones inside the header (between the history tab and close button).
// ↑ arrow: 480–640 px, ↓ arrow: 660–820 px.
export const SCROLL_UP_X0  = 480;
export const SCROLL_UP_X1  = 640;
export const SCROLL_DN_X0  = 660;
export const SCROLL_DN_X1  = 820;

/**
 * Resolve a click at canvas pixel (px, py) into a semantic action.
 *
 * @param {number} px  x in [0, PANEL_PX_W]
 * @param {number} py  y in [0, PANEL_PX_H] (0 = top)
 * @param {number} rowCount  number of entries currently in the active list
 * @param {object} [opts]
 * @param {boolean} [opts.deleteZone=false]  when true, the right DELETE_ZONE_W
 *   pixels of each row return `{type:'deleteRow', index}` instead of `{type:'row'}`.
 * @param {boolean} [opts.scrollZone=false]  when true, the ↑/↓ arrow regions in
 *   the header return `{type:'scrollUp'}` / `{type:'scrollDown'}`.
 * @returns {{type:'tab',tab:'bookmarks'|'history'}
 *          |{type:'close'}
 *          |{type:'scrollUp'}
 *          |{type:'scrollDown'}
 *          |{type:'row',index:number}
 *          |{type:'deleteRow',index:number}
 *          |{type:'none'}}
 */
export function hitTest(px, py, rowCount = 0, { deleteZone = false, scrollZone = false } = {}) {
  if (px < 0 || py < 0 || px > PANEL_PX_W || py > PANEL_PX_H) {
    return { type: 'none' };
  }

  // Header band.
  if (py < HEADER_H) {
    // Close button occupies the right 96px.
    if (px > PANEL_PX_W - 96) {
      return { type: 'close' };
    }
    // Two tab buttons on the left (220px each).
    if (px < 220) {
      return { type: 'tab', tab: 'bookmarks' };
    }
    if (px < 440) {
      return { type: 'tab', tab: 'history' };
    }
    // Scroll arrows in the middle of the header (only when scrollZone enabled).
    if (scrollZone) {
      if (px >= SCROLL_UP_X0 && px <= SCROLL_UP_X1) {
        return { type: 'scrollUp' };
      }
      if (px >= SCROLL_DN_X0 && px <= SCROLL_DN_X1) {
        return { type: 'scrollDown' };
      }
    }
    return { type: 'none' };
  }

  // List rows.
  const index = Math.floor((py - HEADER_H) / ROW_H);
  if (index >= 0 && index < Math.min(rowCount, VISIBLE_ROWS)) {
    if (deleteZone && px > PANEL_PX_W - DELETE_ZONE_W) {
      return { type: 'deleteRow', index };
    }
    return { type: 'row', index };
  }
  return { type: 'none' };
}

/**
 * Map a normalized UV (u,v) on the panel mesh — with v=0 at the BOTTOM as in
 * Three.js texture space — to canvas pixels with y=0 at the TOP.
 * @returns {{px:number, py:number}}
 */
export function uvToPixels(u, v) {
  return {
    px: u * PANEL_PX_W,
    py: (1 - v) * PANEL_PX_H
  };
}

/**
 * Truncate a string to a max number of *characters*, adding an ellipsis.
 *
 * Counts and slices by Unicode code point (via Array.from), not UTF-16 code
 * unit, so a cut never lands in the middle of a surrogate pair. String.length
 * / String.slice would otherwise split astral characters — emoji and CJK
 * Extension kanji such as 𠮷 (U+20BB7) or 𩸽 (U+29E3D), which appear in real
 * Japanese names and words — leaving a broken � at the truncation boundary.
 * For ASCII the behaviour is identical to the old code.
 */
export function truncate(text, max = 48) {
  const s = String(text === null || text === undefined ? '' : text);
  const chars = Array.from(s);
  return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : s;
}

// ── Row text budgets ────────────────────────────────────────────────────────
// Kept in this pure module (rather than as locals in BookmarkPanel.js, which
// imports THREE) so the real values are reachable by unit tests and by the
// real-browser layout harness (tools/verify-text-layout.mjs).
export const ROW_TEXT_X = 24;
export const ROW_TITLE_FONT = 26;   // bold sans
export const ROW_URL_FONT = 20;     // monospace
/** Usable width: text starts at ROW_TEXT_X and must clear the delete zone. */
export const ROW_TEXT_W = PANEL_PX_W - ROW_TEXT_X - DELETE_ZONE_W;
/**
 * Budgets in em (UAX #11 East Asian Width) so one number is correct for both
 * scripts — a 44-*character* budget was ~572px of Latin but 1144px of
 * Japanese, 22% past the available width, so Japanese titles ran under the
 * delete button.
 */
export const ROW_TITLE_EM = safeMeasureEm(ROW_TEXT_W, ROW_TITLE_FONT);
export const ROW_URL_EM = safeMeasureEm(ROW_TEXT_W, ROW_URL_FONT);

/**
 * Canvas colour palette for the bookmark / history panel.
 *
 * In high-contrast mode the panel switches to a pure-black backing and bright
 * foreground colours; the normal-mode palette must clear WCAG 1.4.11 Non-text
 * Contrast (≥ 3:1) and 1.4.3 Text Contrast (≥ 4.5:1) on its own, because
 * high-contrast mode is an opt-in OS preference and most users never set it.
 *
 * The inactive scroll-arrow glyph used to be `#445566`, which measures 2.37:1
 * against the rendered arrow backing — a glyph you cannot see rather than one
 * you can see is unavailable. WCAG 2 formally exempts inactive components from
 * both 1.4.3 and 1.4.11, so this was not a conformance failure; it was worse
 * than that in practice, because the greyed glyph is the only evidence in the
 * panel that a scroll control exists at all. It is now `#727f96` (4.5:1),
 * still far dimmer than the active `#aabbff` so the disabled meaning survives.
 *
 * Pure and exported so the contrast choices are unit-testable without a GPU;
 * tests/contrast.test.js sweeps every pair below against both WCAG 2 and APCA.
 *
 * @param {boolean} [highContrast=false]
 * @returns {object} colour palette used by _draw / _drawTab
 */
export function bookmarkPanelColors(highContrast = false) {
  if (highContrast) {
    return {
      bg:              '#000000',
      headerBg:        '#000000',
      scrollActive:    { bg: '#004adf', text: '#ffffff' },
      scrollInactive:  { bg: '#222222', text: '#aaccee' },
      pageIndicator:   '#ccddee',
      closeBg:         '#7a0000',
      rowTitle:        '#ffffff',
      rowUrl:          '#aabbdd',
      tabActive:       { bg: '#1a3080', text: '#ffffff' },
      tabInactive:     { bg: '#111111', text: '#ccddee' },
      rowZebraEven:    'rgba(255,255,255,0.0)',
      rowZebraOdd:     'rgba(255,255,255,0.10)',
      deleteZoneBg:    '#7a0000',
      deleteText:      '#ffffff',
      emptyText:       '#aabbcc'
    };
  }
  return {
    bg:              'rgba(10,13,20,0.95)',
    headerBg:        '#161b2e',
    scrollActive:    { bg: 'rgba(50,80,140,0.9)', text: '#aabbff' },
    scrollInactive:  { bg: 'rgba(30,35,55,0.6)',  text: '#727f96' },
    pageIndicator:   '#7788aa',
    closeBg:         '#5c1a1a',
    rowTitle:        '#e8ecff',
    rowUrl:          '#7f8db5',
    tabActive:       { bg: '#2d3a66', text: '#ffffff' },
    tabInactive:     { bg: '#1a1f33', text: '#8899bb' },
    rowZebraEven:    'rgba(255,255,255,0.03)',
    rowZebraOdd:     'rgba(255,255,255,0.06)',
    deleteZoneBg:    'rgba(90,20,20,0.8)',
    deleteText:      '#ffaaaa',
    emptyText:       '#8899aa'
  };
}
