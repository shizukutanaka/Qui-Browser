/**
 * Settings-panel layout invariants.
 *
 * The flat stack reached 19 rows / 3.56 m, subtending 72.2° vertically at the
 * panel's 2.44 m placement — roughly double the ~30–40° a user takes in without
 * moving their head, so the lower half was permanently out of view. The
 * arithmetic lived inline in VRApp where nothing could import it, which is why
 * the cost was never measured as controls accumulated (Sessions 46, 54, 55, 56).
 *
 * These tests pin both the geometry and the thing it exists to prevent: the
 * panel growing back past the comfortable field of view.
 */

const {
  layoutSettingsPanel, worstCaseHeight, tabWidth, ROW_H, PAD, COL_X, PANEL_W, TAB_GAP
} = require('../src/vr/ui/settingsLayout.js');
const { angularSizeDeg } = require('../src/vr/ui/angularSize.js');

/** The panel sits at (-1.4, 1.5, -2.0); the user is near the origin. */
const PANEL_DISTANCE = Math.hypot(1.4, 2.0);
/** Comfortable vertical field without head movement. */
const COMFORTABLE_VERTICAL_DEG = 40;

const narrow = (n) => Array.from({ length: n }, () => ({ wide: false }));
const wide = (n) => Array.from({ length: n }, () => ({ wide: true }));

describe('layoutSettingsPanel', () => {
  test('every section gets a tab, and they all share ONE row', () => {
    const out = layoutSettingsPanel(
      [{ id: 'a', controls: narrow(6) }, { id: 'b', controls: narrow(2) }], []
    );
    const tabs = out.placements.filter((p) => p.type === 'tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].y).toBe(tabs[1].y);          // one row, not a stack
    expect(out.rows).toBe(1);
    // Unselected sections contribute no control rows.
    expect(out.placements.filter((p) => p.type === 'control')).toHaveLength(0);
  });

  test('tabs are laid out side by side, centred, without overlapping', () => {
    const sections = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const out = layoutSettingsPanel(sections, []);
    const tabs = out.placements.filter((p) => p.type === 'tab');
    const w = tabWidth(3);
    for (let i = 1; i < tabs.length; i++) {
      expect(tabs[i].x - tabs[i - 1].x).toBeCloseTo(w + TAB_GAP, 10);
    }
    expect(tabs[0].x + tabs[tabs.length - 1].x).toBeCloseTo(0, 10); // centred
    expect(tabs[0].x - w / 2).toBeGreaterThanOrEqual(-PANEL_W / 2 - 1e-9); // inside
  });

  test('tabWidth divides the panel among the tabs', () => {
    for (const n of [1, 3, 5, 8]) {
      expect(n * tabWidth(n) + TAB_GAP * (n - 1)).toBeCloseTo(PANEL_W, 10);
    }
    expect(tabWidth(0)).toBe(tabWidth(1)); // degenerate input clamps
  });

  test('narrow controls pair two per row, in left and right columns', () => {
    const out = layoutSettingsPanel([{ id: 'a', controls: narrow(4) }], ['a']);
    expect(out.rows).toBe(1 + 2); // header + 2 rows
    const controls = out.placements.filter((p) => p.type === 'control');
    expect(controls.map((c) => c.x)).toEqual([-COL_X, COL_X, -COL_X, COL_X]);
    expect(controls[0].y).toBe(controls[1].y); // same row
    expect(controls[2].y).toBeLessThan(controls[0].y);
  });

  test('an odd narrow control takes the left column alone', () => {
    const out = layoutSettingsPanel([{ id: 'a', controls: narrow(3) }], ['a']);
    expect(out.rows).toBe(1 + 2);
    const last = out.placements.filter((p) => p.type === 'control').pop();
    expect(last.x).toBe(-COL_X);
  });

  test('wide controls take a full row and never pair', () => {
    const out = layoutSettingsPanel([{ id: 'a', controls: wide(3) }], ['a']);
    expect(out.rows).toBe(1 + 3);
    for (const c of out.placements.filter((p) => p.type === 'control')) {
      expect(c.x).toBe(0);
    }
  });

  test('a narrow control is not paired across a wide neighbour', () => {
    // narrow, wide, narrow -> three separate rows, never a narrow+wide row.
    const out = layoutSettingsPanel(
      [{ id: 'a', controls: [{ wide: false }, { wide: true }, { wide: false }] }], ['a']
    );
    expect(out.rows).toBe(1 + 3);
    const ys = out.placements.filter((p) => p.type === 'control').map((p) => p.y);
    expect(new Set(ys).size).toBe(3);
  });

  test('only the selected section contributes controls', () => {
    const out = layoutSettingsPanel(
      [{ id: 'a', controls: narrow(1) }, { id: 'b', controls: narrow(1) }], ['a']
    );
    const controls = out.placements.filter((p) => p.type === 'control');
    expect(controls).toHaveLength(1);
    expect(controls[0].sectionId).toBe('a');
    expect(controls[0].x).toBe(-COL_X);
  });

  test('rows are evenly pitched and centred on y = 0', () => {
    const out = layoutSettingsPanel([{ id: 'a', controls: wide(3) }], ['a']);
    const ys = [...new Set(out.placements.map((p) => p.y))];
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i - 1] - ys[i]).toBeCloseTo(ROW_H, 10);
    }
    expect(ys[0] + ys[ys.length - 1]).toBeCloseTo(0, 10);
  });

  test('height accounts for every row plus padding', () => {
    const out = layoutSettingsPanel([{ id: 'a', controls: wide(4) }], ['a']);
    expect(out.height).toBeCloseTo(out.rows * ROW_H + PAD, 10);
  });

  test('every control of the selected section gets exactly one placement', () => {
    const sections = [{ id: 'a', controls: narrow(3) }, { id: 'b', controls: wide(2) }];
    for (const sel of sections) {
      const out = layoutSettingsPanel(sections, [sel.id]);
      const idx = out.placements
        .filter((p) => p.type === 'control')
        .map((p) => p.index)
        .sort((x, y) => x - y);
      expect(idx).toEqual(sel.controls.map((_, i) => i));
    }
  });

  test('degenerate input does not throw', () => {
    for (const bad of [undefined, null, [], 'nope']) {
      expect(() => layoutSettingsPanel(bad, [])).not.toThrow();
    }
    expect(layoutSettingsPanel([{ id: 'a' }], ['a']).rows).toBe(1);
    expect(layoutSettingsPanel([{ id: 'a', controls: narrow(2) }], null).rows).toBe(1);
  });
});

describe('the panel stays inside the comfortable field of view', () => {
  // The real inventory: 24 controls across five sections.
  const REAL = [
    { id: 'a11y', controls: [...narrow(5), ...wide(5)] },
    { id: 'locomotion', controls: [...narrow(5), ...wide(3)] },
    { id: 'display', controls: [...narrow(3), ...wide(1)] },
    // browsing: enableWebPanel toggle + searchEngine cycle + clearHistory,
    // readerProxy, findInPage, bookmarks actions (Session 75 続き13 added find).
    { id: 'browsing', controls: [...narrow(1), ...wide(5)] },
    { id: 'audio', controls: wide(2) }
  ];
  const vertical = (h) => angularSizeDeg(h, PANEL_DISTANCE);

  test('the old flat stack did NOT fit — this is what the grouping addresses', () => {
    // 19 rows was the measured flat layout: ceil(13/2) toggles + 9 steppers
    // + 2 cycles + 3 actions.
    const flatHeight = 19 * ROW_H + PAD;
    expect(flatHeight).toBeCloseTo(3.56, 2);
    expect(vertical(flatHeight)).toBeGreaterThan(70);
  });

  test('the accordion worst case is substantially shorter than the flat stack', () => {
    const worst = worstCaseHeight(REAL);
    expect(worst).toBeLessThan(19 * ROW_H + PAD);
    expect(worst / (19 * ROW_H + PAD)).toBeLessThan(0.7); // >30% shorter
  });

  test('height is bounded by ONE tab row plus the largest section', () => {
    // The structural property: adding a control can only grow the panel by its
    // own section, never by the whole inventory.
    const worst = worstCaseHeight(REAL);
    const largest = Math.max(...REAL.map((s) => layoutSettingsPanel(REAL, [s.id]).rows));
    expect(worst).toBeCloseTo(largest * ROW_H + PAD, 10);

    const grown = REAL.map((s) => (s.id === 'display'
      ? { ...s, controls: [...s.controls, { wide: true }] } : s));
    expect(worstCaseHeight(grown)).toBeLessThanOrEqual(worstCaseHeight(REAL) + ROW_H + 1e-9);
  });

  test('nothing selected is a single tab row', () => {
    const out = layoutSettingsPanel(REAL, []);
    expect(out.rows).toBe(1);
    expect(vertical(out.height)).toBeLessThan(COMFORTABLE_VERTICAL_DEG);
  });

  test('the open panel fits the comfortable field — J-2 stays closed', () => {
    // Was 50.4° with five stacked headers, four of which were pure chrome. One
    // tab row took it to 35.9°; the Voice toggle (Session 75) adds a row to the
    // accessibility section, the largest, bringing the worst case to 39.6°.
    const worst = worstCaseHeight(REAL);
    expect(vertical(worst)).toBeLessThanOrEqual(COMFORTABLE_VERTICAL_DEG);
    expect(vertical(worst)).toBeCloseTo(39.6, 0);
  });

  test('HEADROOM: the next accessibility control does NOT fit', () => {
    // 0.4° of margin is left. This is not a failure — it is the honest state,
    // pinned so the next person adding an a11y control finds out here rather
    // than in a headset. Absorbing another one needs a structural change (a
    // scrollable panel, or shorter rows), not another entry in the list.
    const grown = REAL.map((s) => (s.id === 'a11y'
      ? { ...s, controls: [...s.controls, { wide: false }] } : s));
    expect(vertical(worstCaseHeight(grown))).toBeGreaterThan(COMFORTABLE_VERTICAL_DEG);
  });

  test('every section fits when selected, not just the smallest', () => {
    for (const s of REAL) {
      const out = layoutSettingsPanel(REAL, [s.id]);
      expect(vertical(out.height)).toBeLessThanOrEqual(COMFORTABLE_VERTICAL_DEG);
    }
  });

  test('the stacked-header shape it replaced did NOT fit', () => {
    // 5 header rows + the largest section's 7 rows = 12 rows.
    const stacked = 12 * ROW_H + PAD;
    expect(vertical(stacked)).toBeCloseTo(50.4, 0);
    expect(vertical(stacked)).toBeGreaterThan(COMFORTABLE_VERTICAL_DEG);
  });

  test('the panel is wider than a full-row control, so nothing overhangs', () => {
    expect(PANEL_W).toBeGreaterThan(2 * COL_X + 0.43); // compact button half-width
    expect(PANEL_W).toBeGreaterThanOrEqual(1.0);       // section-header width
  });
});
