/**
 * Unit tests for the pure bookmark-panel layout / hit-testing helpers.
 */
const {
  PANEL_PX_W, PANEL_PX_H, HEADER_H, ROW_H, VISIBLE_ROWS,
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
});
