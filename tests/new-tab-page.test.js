/**
 * C-3: New-tab "Top Sites" tile layout — pure geometry for the WebPanel
 * content canvas. BookmarkStore.getTopSites() has been fully implemented
 * (frecency-aggregated hosts) since Session 61 but had zero render targets;
 * a new tab opened to a blank "Enter a URL" dead end. This layout is what
 * fills that space.
 */

const {
  topSiteTiles, tileAt, MAX_TILES, HEADER_PX
} = require('../src/vr/browser/newTabPage.js');

const site = (i) => ({ url: `https://${i}.example`, title: `Site ${i}`, host: `${i}.example` });

describe('newTabPage tile layout (C-3)', () => {
  test('lays out up to MAX_TILES sites in a grid below the header band', () => {
    const tiles = topSiteTiles(Array.from({ length: 9 }, (_, i) => site(i)), 1024, 942);
    expect(tiles).toHaveLength(MAX_TILES);
    expect(tiles[0].y).toBe(HEADER_PX);              // row 0 under the header
    expect(tiles[4].y).toBeGreaterThan(tiles[0].y);  // second row lower
    expect(tiles[1].x).toBeGreaterThan(tiles[0].x);  // columns march right
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.x + t.w).toBeLessThanOrEqual(1024);
      expect(t.y + t.h).toBeLessThanOrEqual(942);
    }
    expect(tiles[0].url).toBe('https://0.example');
  });

  test('no sites (or null/garbage) → no tiles', () => {
    expect(topSiteTiles([], 1024, 942)).toEqual([]);
    expect(topSiteTiles(null, 1024, 942)).toEqual([]);
    expect(topSiteTiles('no', 1024, 942)).toEqual([]);
  });

  test('entries without a usable url are dropped', () => {
    const tiles = topSiteTiles([{ url: '' }, { title: 'x' }, null, site(0)], 1024, 942);
    expect(tiles.map((t) => t.host)).toEqual(['0.example']);
  });

  test('tileAt hits inside a tile rect and misses outside it', () => {
    const tiles = topSiteTiles([site(0), site(1)], 1024, 942);
    expect(tileAt(tiles[0].x + 2, tiles[0].y + 2, tiles).url).toBe('https://0.example');
    expect(tileAt(tiles[0].x - 1, tiles[0].y + 2, tiles)).toBeNull();
    expect(tileAt(512, 10, tiles)).toBeNull();   // header band is not a tile
    expect(tileAt(0, 0, null)).toBeNull();
  });
});
