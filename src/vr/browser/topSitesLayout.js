/**
 * Top-sites tile layout for the new-tab ("empty") panel.
 *
 * Grounding: Firefox Top Sites and the Chrome new-tab page put the user's
 * frecency-ranked destinations one click away on every fresh tab — the single
 * cheapest re-navigation path a browser has. In VR the win is larger: a tile
 * select is one dwell, while retyping a URL costs a whole keyboard round-trip
 * (hands-free users pay that cost in full).
 *
 * The tile grid sits below the empty state's centred heading/detail lines
 * (`_drawContent` draws those at h/2 ± 20), inside the content canvas.
 *
 * Pure / dependency-free so tests can assert geometry and hit-testing without
 * canvas or THREE.
 */

import { CONTENT_PX_W, CONTENT_PX_H } from './readerLayout.js';

export const TOP_SITE_COLS = 4;
export const TOP_SITE_MAX = 8;
export const TILE_H = 132;
export const TILE_GAP = 24;
export const TILE_TOP = Math.round(CONTENT_PX_H * 0.56);
const TILE_SIDE_PAD = 64;

/**
 * @param {number} count  number of tiles to lay out (clamped to TOP_SITE_MAX)
 * @param {number} [canvasW] content canvas width in px
 * @returns {Array<{x:number,y:number,w:number,h:number}>} rects in canvas px
 */
export function topSiteTiles(count, canvasW = CONTENT_PX_W) {
  const n = Math.max(0, Math.min(count, TOP_SITE_MAX));
  if (n === 0) {
    return [];
  }
  const cols = Math.min(TOP_SITE_COLS, n);
  const rows = Math.ceil(n / cols);
  const innerW = canvasW - 2 * TILE_SIDE_PAD;
  const tileW = Math.floor((innerW - (cols - 1) * TILE_GAP) / cols);
  const rects = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    // Centre a short last row under the full rows above it.
    const inRow = (row === rows - 1) ? (n - row * cols) : cols;
    const rowW = inRow * tileW + (inRow - 1) * TILE_GAP;
    const rowX0 = Math.round((canvasW - rowW) / 2);
    rects.push({
      x: rowX0 + col * (tileW + TILE_GAP),
      y: TILE_TOP + row * (TILE_H + TILE_GAP),
      w: tileW,
      h: TILE_H
    });
  }
  return rects;
}

/**
 * @returns {number} tile index containing (px,py), or -1
 */
export function hitTestTopSites(px, py, tiles) {
  if (!Array.isArray(tiles)) {
    return -1;
  }
  for (let i = 0; i < tiles.length; i++) {
    const r = tiles[i];
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) {
      return i;
    }
  }
  return -1;
}
