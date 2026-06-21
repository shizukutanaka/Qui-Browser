/**
 * Unit tests for the pure bookmark-panel layout / hit-testing helpers.
 */
const {
  PANEL_PX_W, PANEL_PX_H, HEADER_H, ROW_H, VISIBLE_ROWS, DELETE_ZONE_W,
  SCROLL_UP_X0, SCROLL_UP_X1, SCROLL_DN_X0, SCROLL_DN_X1,
  hitTest, uvToPixels, truncate
} = require('../src/vr/browser/bookmarkLayout.js');

describe('hitTest', () => {
  test('out-of-bounds returns none', () => {
    expect(hitTest(-1, 10, 5).type).toBe('none');
    expect(hitTest(10, -1, 5).type).toBe('none');
    expect(hitTest(PANEL_PX_W + 1, 10, 5).type).toBe('none');
    expect(hitTest(10, PANEL_PX_H + 1, 5).type).toBe('none');
  });

  test('close button in header right', () => {
    const a = hitTest(PANEL_PX_W - 20, HEADER_H / 2, 5);
    expect(a.type).toBe('close');
  });

  test('bookmarks tab', () => {
    const a = hitTest(100, HEADER_H / 2, 5);
    expect(a).toEqual({ type: 'tab', tab: 'bookmarks' });
  });

  test('history tab', () => {
    const a = hitTest(300, HEADER_H / 2, 5);
    expect(a).toEqual({ type: 'tab', tab: 'history' });
  });

  test('gap between tabs and close is none', () => {
    const a = hitTest(600, HEADER_H / 2, 5);
    expect(a.type).toBe('none');
  });

  test('first row maps to index 0', () => {
    const a = hitTest(100, HEADER_H + 10, 5);
    expect(a).toEqual({ type: 'row', index: 0 });
  });

  test('second row maps to index 1', () => {
    const a = hitTest(100, HEADER_H + ROW_H + 10, 5);
    expect(a).toEqual({ type: 'row', index: 1 });
  });

  test('row beyond rowCount returns none', () => {
    // rowCount = 2, clicking the 4th row slot
    const a = hitTest(100, HEADER_H + 3 * ROW_H + 10, 2);
    expect(a.type).toBe('none');
  });

  test('row beyond VISIBLE_ROWS returns none even with many entries', () => {
    const py = HEADER_H + VISIBLE_ROWS * ROW_H + 10;
    // clamp: even if py is within canvas, index >= VISIBLE_ROWS is none
    const a = hitTest(100, Math.min(py, PANEL_PX_H - 1), 1000);
    expect(a.type).toBe('none');
  });

  describe('deleteZone option', () => {
    test('right edge of a row returns deleteRow when deleteZone enabled', () => {
      const a = hitTest(PANEL_PX_W - 10, HEADER_H + 10, 5, { deleteZone: true });
      expect(a).toEqual({ type: 'deleteRow', index: 0 });
    });

    test('right edge of a row returns row when deleteZone disabled (default)', () => {
      const a = hitTest(PANEL_PX_W - 10, HEADER_H + 10, 5);
      expect(a.type).toBe('row');
    });

    test('left part of row returns row even when deleteZone enabled', () => {
      const a = hitTest(100, HEADER_H + 10, 5, { deleteZone: true });
      expect(a).toEqual({ type: 'row', index: 0 });
    });

    test('deleteRow preserves the correct row index', () => {
      const rowIdx = 2;
      const py = HEADER_H + rowIdx * ROW_H + 10;
      const a = hitTest(PANEL_PX_W - 10, py, 5, { deleteZone: true });
      expect(a).toEqual({ type: 'deleteRow', index: rowIdx });
    });
  });
});

describe('scrollZone option', () => {
  const midY = HEADER_H / 2;

  test('scrollUp zone returns scrollUp when scrollZone enabled', () => {
    const midX = (SCROLL_UP_X0 + SCROLL_UP_X1) / 2;
    expect(hitTest(midX, midY, 5, { scrollZone: true }).type).toBe('scrollUp');
  });

  test('scrollDown zone returns scrollDown when scrollZone enabled', () => {
    const midX = (SCROLL_DN_X0 + SCROLL_DN_X1) / 2;
    expect(hitTest(midX, midY, 5, { scrollZone: true }).type).toBe('scrollDown');
  });

  test('scroll zones return none when scrollZone is false (default)', () => {
    const midX = (SCROLL_UP_X0 + SCROLL_UP_X1) / 2;
    expect(hitTest(midX, midY, 5).type).toBe('none');
  });

  test('left edge of scrollUp zone is included', () => {
    expect(hitTest(SCROLL_UP_X0, midY, 5, { scrollZone: true }).type).toBe('scrollUp');
  });

  test('right edge of scrollDown zone is included', () => {
    expect(hitTest(SCROLL_DN_X1, midY, 5, { scrollZone: true }).type).toBe('scrollDown');
  });

  test('gap between scrollUp and scrollDown returns none', () => {
    const gapX = (SCROLL_UP_X1 + SCROLL_DN_X0) / 2;
    expect(hitTest(gapX, midY, 5, { scrollZone: true }).type).toBe('none');
  });

  test('scroll zone exports are consistent numbers', () => {
    expect(SCROLL_UP_X0).toBeGreaterThan(440);  // after history tab
    expect(SCROLL_UP_X1).toBeGreaterThan(SCROLL_UP_X0);
    expect(SCROLL_DN_X0).toBeGreaterThan(SCROLL_UP_X1);
    expect(SCROLL_DN_X1).toBeLessThan(PANEL_PX_W - 96); // before close button
  });
});

describe('uvToPixels', () => {
  test('top-left UV (0,1) maps to (0,0) px', () => {
    expect(uvToPixels(0, 1)).toEqual({ px: 0, py: 0 });
  });
  test('bottom-right UV (1,0) maps to (W,H) px', () => {
    expect(uvToPixels(1, 0)).toEqual({ px: PANEL_PX_W, py: PANEL_PX_H });
  });
  test('center UV maps to canvas center', () => {
    const p = uvToPixels(0.5, 0.5);
    expect(p.px).toBeCloseTo(PANEL_PX_W / 2);
    expect(p.py).toBeCloseTo(PANEL_PX_H / 2);
  });
});

describe('truncate', () => {
  test('short strings pass through', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });
  test('long strings get an ellipsis', () => {
    expect(truncate('abcdefghij', 5)).toBe('abcd…');
  });
  test('handles null/undefined safely', () => {
    expect(truncate(null)).toBe('');
    expect(truncate(undefined)).toBe('');
  });

  test('counts astral characters as one (CJK Extension kanji)', () => {
    // 𠮷 is one visible character but two UTF-16 code units. Five of them are
    // under a max of 6, so the string must pass through unchanged — the old
    // length-based check would have seen length 10 and truncated.
    const name = '𠮷𠮷𠮷𠮷𠮷';
    expect(truncate(name, 6)).toBe(name);
  });

  test('never splits a surrogate pair at the cut boundary (no mojibake)', () => {
    // Truncating to 3 keeps 2 chars + ellipsis; each kept char must be intact.
    const out = truncate('😀😀😀😀😀', 3);
    expect(out).toBe('😀😀…');
    expect(out).not.toContain('�');     // no replacement char
    expect(Array.from(out)).toHaveLength(3);  // 2 emoji + ellipsis
  });

  test('mixed ASCII + full-width truncates on a code-point boundary', () => {
    // 'a' + '日本語テキスト' → keep 'a日本' (4 code points) + ellipsis at max 5.
    expect(truncate('a日本語テキスト', 5)).toBe('a日本語…');
  });
});
