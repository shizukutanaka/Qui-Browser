/**
 * New-tab "Top Sites" page for the WebPanel content canvas (C-3).
 *
 * BookmarkStore.getTopSites() has been fully implemented (host-aggregated
 * frecency) since the beginning, but nothing rendered it: a new tab opened
 * to a blank "Enter a URL" dead end. This module turns a site list into a
 * tile grid — pure geometry, no DOM and no THREE, so the layout and the hit
 * test are unit-testable. WebPanel owns the drawing and the hit dispatch.
 */

export const TILE_COLS = 4;
export const TILE_ROWS = 2;
export const MAX_TILES = TILE_COLS * TILE_ROWS;

// Canvas-px geometry. The content canvas is 1024×942; the top ~110px is the
// header band (title + hint text), tiles tile the rest with a fixed margin.
export const TILE_PAD_X = 24;
export const TILE_GAP = 16;
export const HEADER_PX = 110;

/**
 * Lay out `sites` as a grid of tap targets. Entries without a usable url are
 * dropped; the result is capped at MAX_TILES. Each tile carries the site's
 * url/title/host plus a canvas-px rect {x, y, w, h} that tileAt() reuses for
 * hit-testing, so layout and hit regions can never drift apart.
 *
 * @param {Array<{url:string, title?:string, host?:string}>} sites
 * @param {number} w canvas width in px
 * @param {number} h canvas height in px
 * @returns {Array<{x:number,y:number,w:number,h:number,url:string,title:string,host:string}>}
 */
export function topSiteTiles(sites, w, h) {
  const list = (Array.isArray(sites) ? sites : [])
    .filter((s) => s && typeof s.url === 'string' && s.url)
    .slice(0, MAX_TILES);
  const tiles = [];
  if (!list.length || !(w > 0) || !(h > HEADER_PX + TILE_PAD_X)) {
    return tiles;
  }

  const cols = Math.min(TILE_COLS, list.length);
  const rows = Math.ceil(list.length / cols);
  const gridW = w - TILE_PAD_X * 2;
  const tileW = (gridW - TILE_GAP * (cols - 1)) / cols;
  const gridH = h - HEADER_PX - TILE_PAD_X;
  const tileH = (gridH - TILE_GAP * (rows - 1)) / rows;

  list.forEach((s, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    tiles.push({
      x: TILE_PAD_X + c * (tileW + TILE_GAP),
      y: HEADER_PX + r * (tileH + TILE_GAP),
      w: tileW,
      h: tileH,
      url: s.url,
      title: typeof s.title === 'string' ? s.title : '',
      host: typeof s.host === 'string' && s.host ? s.host : s.url
    });
  });
  return tiles;
}

/**
 * Which tile (if any) contains the canvas point (px, py). Returns the tile
 * object (url included) or null. The header band and gaps are dead space.
 */
export function tileAt(px, py, tiles) {
  return (tiles || []).find(
    (t) => px >= t.x && px <= t.x + t.w && py >= t.y && py <= t.y + t.h
  ) || null;
}
