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

/**
 * Resolve a click at canvas pixel (px, py) into a semantic action.
 *
 * @param {number} px  x in [0, PANEL_PX_W]
 * @param {number} py  y in [0, PANEL_PX_H] (0 = top)
 * @param {number} rowCount  number of entries currently in the active list
 * @returns {{type:'tab',tab:'bookmarks'|'history'}
 *          |{type:'close'}
 *          |{type:'row',index:number}
 *          |{type:'none'}}
 */
export function hitTest(px, py, rowCount = 0) {
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
    return { type: 'none' };
  }

  // List rows.
  const index = Math.floor((py - HEADER_H) / ROW_H);
  if (index >= 0 && index < Math.min(rowCount, VISIBLE_ROWS)) {
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
 * Truncate a string to a max length, adding an ellipsis.
 */
export function truncate(text, max = 48) {
  const s = String(text === null || text === undefined ? '' : text);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
