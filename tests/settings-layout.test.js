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
  layoutSettingsPanel, worstCaseHeight, ROW_H, PAD, COL_X, PANEL_W
} = require('../src/vr/ui/settingsLayout.js');
const { angularSizeDeg } = require('../src/vr/ui/angularSize.js');

/** The panel sits at (-1.4, 1.5, -2.0); the user is near the origin. */
const PANEL_DISTANCE = Math.hypot(1.4, 2.0);
/** Comfortable vertical field without head movement. */
const COMFORTABLE_VERTICAL_DEG = 40;

const narrow = (n) => Array.from({ length: n }, () => ({ wide: false }));
const wide = (n) => Array.from({ length: n }, () => ({ wide: true }));

describe('layoutSettingsPanel', () => {
  test('a collapsed section costs exactly one row (its header)', () => {
    const out = layoutSettingsPanel([{ id: 'a', controls: narrow(6) }], []);
    expect(out.rows).toBe(1);
    expect(out.placements).toHaveLength(1);
    expect(out.placements[0]).toMatchObject({ type: 'header', sectionId: 'a' });
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

  test('pairing never spans a section boundary', () => {
    const out = layoutSettingsPanel(
      [{ id: 'a', controls: narrow(1) }, { id: 'b', controls: narrow(1) }], ['a', 'b']
    );
    const controls = out.placements.filter((p) => p.type === 'control');
    expect(controls).toHaveLength(2);
    expect(controls[0].y).not.toBe(controls[1].y);
    expect(controls.every((c) => c.x === -COL_X)).toBe(true);
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

  test('every control gets exactly one placement, and indices are its own', () => {
    const sections = [{ id: 'a', controls: narrow(3) }, { id: 'b', controls: wide(2) }];
    const out = layoutSettingsPanel(sections, ['a', 'b']);
    for (const s of sections) {
      const idx = out.placements
        .filter((p) => p.type === 'control' && p.sectionId === s.id)
        .map((p) => p.index)
        .sort((x, y) => x - y);
      expect(idx).toEqual(s.controls.map((_, i) => i));
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
    { id: 'a11y', controls: [...narrow(4), ...wide(5)] },
    { id: 'locomotion', controls: [...narrow(5), ...wide(3)] },
    { id: 'display', controls: [...narrow(3), ...wide(1)] },
    { id: 'browsing', controls: [...narrow(1), ...wide(3)] },
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

  test('height is bounded by the LARGEST section, not the whole inventory', () => {
    // This is the structural property the accordion buys: adding a control can
    // only grow the panel by its own section. Without it, expanding everything
    // measured 5.00 m — worse than the flat stack it replaced, because headers
    // add rows on top of every control.
    const everythingOpen = layoutSettingsPanel(REAL, REAL.map((s) => s.id)).height;
    expect(everythingOpen).toBeGreaterThan(19 * ROW_H + PAD); // the trap
    expect(worstCaseHeight(REAL)).toBeLessThan(everythingOpen * 0.5);

    // Adding a 25th control grows the panel by one row, not by the inventory.
    const grown = REAL.map((s) => (s.id === 'display'
      ? { ...s, controls: [...s.controls, { wide: true }] } : s));
    expect(worstCaseHeight(grown)).toBeLessThanOrEqual(worstCaseHeight(REAL) + ROW_H + 1e-9);
  });

  test('all sections collapsed is a short header list', () => {
    const out = layoutSettingsPanel(REAL, []);
    expect(out.rows).toBe(REAL.length);
    expect(vertical(out.height)).toBeLessThan(COMFORTABLE_VERTICAL_DEG);
  });

  test('HONEST LIMIT: the open panel still exceeds the comfortable field', () => {
    // 2.30 m / 50.4° vs the ~40° a user takes in without moving their head.
    // Recorded rather than papered over: closing the remaining gap needs a
    // scrollable panel or shorter rows, which is a separate change.
    // See docs/OUTSTANDING_ISSUES.md J-1.
    const worst = worstCaseHeight(REAL);
    expect(vertical(worst)).toBeGreaterThan(COMFORTABLE_VERTICAL_DEG);
    expect(vertical(worst)).toBeLessThan(55);
  });

  test('the panel is wider than a full-row control, so nothing overhangs', () => {
    expect(PANEL_W).toBeGreaterThan(2 * COL_X + 0.43); // compact button half-width
    expect(PANEL_W).toBeGreaterThanOrEqual(1.0);       // section-header width
  });
});
