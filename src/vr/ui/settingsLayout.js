/**
 * Pure layout for the in-VR settings panel.
 *
 * Why this exists: the panel grew to 24 controls in one flat stack — 19 rows,
 * **3.56 m tall**, which at its 2.44 m placement subtends **72.2° vertically**
 * (`angularSize.js`). Comfortable vertical field of view without moving your
 * head is roughly 30–40°, so more than half the panel was always outside it and
 * the bottom rows sat near the floor. Every session since 54 added another
 * control to that stack, and the cost was never measured because the layout
 * arithmetic lived inline in `VRApp.createSettingsPanel()` where nothing could
 * import it.
 *
 * Collapsible sections fix it: only the open section's controls occupy rows, so
 * the panel stays inside the comfortable field instead of growing without bound
 * as features are added.
 *
 * Kept free of Three.js so the geometry is unit-testable headlessly — the same
 * split as `bookmarkLayout.js` and `readerLayout.js`.
 */

/** Vertical pitch between rows (m) — unchanged from the flat layout. */
export const ROW_H = 0.18;
/** Top/bottom padding added to the backing plane (m). */
export const PAD = 0.14;
/** Horizontal offset of each column in a paired-toggle row (m). */
export const COL_X = 0.27;
/** Panel width (m). */
export const PANEL_W = 1.1;

/** Gap between adjacent section tabs (m). */
export const TAB_GAP = 0.012;

/**
 * Width (m) of one section tab when `count` of them share the panel row.
 * @param {number} count
 * @returns {number}
 */
export function tabWidth(count) {
  const n = Math.max(1, Math.floor(Number(count) || 1));
  return (PANEL_W - TAB_GAP * (n - 1)) / n;
}

/**
 * Lay out sections and their controls.
 *
 * Sections are selected from a SINGLE row of tabs, not a stack of headers.
 * Stacked headers cost one row each — five of them plus the largest section
 * measured 12 rows / 2.30 m / **50.4°** vertically at the panel's 2.44 m
 * placement, still well past the ~40° a user takes in without moving their
 * head. Four of those rows were pure chrome carrying one bit of information
 * apiece. Collapsing them into one tab row costs nothing in navigation and
 * brings the worst case to 8 rows / 1.58 m / **35.9°**, inside the comfortable
 * field for the first time.
 *
 * Controls declare `wide: true` when they need a full row (steppers, cycles,
 * actions); everything else pairs two-per-row into the left/right columns.
 *
 * @param {Array<{id: string, controls: Array<{wide?: boolean}>}>} sections
 * @param {Iterable<string>} [openIds] the selected section (at most one)
 * @returns {{
 *   rows: number,
 *   height: number,
 *   placements: Array<{type: 'tab'|'control', sectionId: string, index: number, x: number, y: number, w?: number}>
 * }}
 */
export function layoutSettingsPanel(sections, openIds = []) {
  const list = Array.isArray(sections) ? sections : [];
  const open = new Set(openIds || []);
  const selected = list.find((s) => open.has(s.id)) || null;
  const controls = selected && Array.isArray(selected.controls) ? selected.controls : [];

  // Row count: one tab row (when there is anything to tab between) plus the
  // rows the selected section needs.
  const rowsFor = (list2) => {
    let n = 0;
    let i = 0;
    while (i < list2.length) {
      if (list2[i] && list2[i].wide) {
        n += 1;
        i += 1;
      } else {
        const next = list2[i + 1];
        i += (next && !next.wide) ? 2 : 1;
        n += 1;
      }
    }
    return n;
  };
  const tabRow = list.length ? 1 : 0;
  const rows = tabRow + rowsFor(controls);

  const placements = [];
  let y = ((rows - 1) * ROW_H) / 2;

  if (tabRow) {
    const w = tabWidth(list.length);
    const total = list.length * w + TAB_GAP * (list.length - 1);
    list.forEach((s, i) => {
      placements.push({
        type: 'tab',
        sectionId: s.id,
        index: i,
        x: -total / 2 + i * (w + TAB_GAP) + w / 2,
        y,
        w
      });
    });
    y -= ROW_H;
  }

  let i = 0;
  while (i < controls.length) {
    const sid = selected.id;
    if (controls[i] && controls[i].wide) {
      placements.push({ type: 'control', sectionId: sid, index: i, x: 0, y });
      i += 1;
    } else {
      placements.push({ type: 'control', sectionId: sid, index: i, x: -COL_X, y });
      const next = controls[i + 1];
      if (next && !next.wide) {
        placements.push({ type: 'control', sectionId: sid, index: i + 1, x: COL_X, y });
        i += 2;
      } else {
        i += 1;
      }
    }
    y -= ROW_H;
  }

  return { rows, height: rows * ROW_H + PAD, placements };
}

/**
 * Worst-case height (m): one tab row plus the largest section.
 *
 * This is the number that bounds the panel. Two earlier shapes did not:
 * the flat stack of all 24 controls was 3.56 m / 72.2°, and grouping with
 * every section expanded was 5.00 m / 91.4° — *worse*, because each header
 * added a row on top of all the controls. With a single tab row and one
 * section shown, a new control can only grow the panel by its own section.
 *
 * @param {Array} sections
 * @returns {number} metres
 */
export function worstCaseHeight(sections) {
  const list = Array.isArray(sections) ? sections : [];
  if (!list.length) {
    return PAD;
  }
  return Math.max(...list.map((s) => layoutSettingsPanel(list, [s.id]).height));
}
