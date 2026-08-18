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

/**
 * Lay out sections and their controls into rows.
 *
 * Controls declare `wide: true` when they need a full row (steppers, cycles,
 * actions); everything else pairs two-per-row into the left/right columns, the
 * same as the previous flat layout did for toggles. Pairing never spans a
 * section boundary, so a section always starts on a fresh row.
 *
 * @param {Array<{id: string, controls: Array<{wide?: boolean}>}>} sections
 * @param {Iterable<string>} [openIds] ids of the expanded sections
 * @returns {{
 *   rows: number,
 *   height: number,
 *   placements: Array<{type: 'header'|'control', sectionId: string, index: number, x: number, y: number}>
 * }}
 */
export function layoutSettingsPanel(sections, openIds = []) {
  const list = Array.isArray(sections) ? sections : [];
  const open = new Set(openIds || []);

  // First pass: how many rows will there be? The stack is centred on y=0, so
  // the total has to be known before any y can be assigned.
  let rows = 0;
  for (const s of list) {
    rows += 1; // the section header
    if (!open.has(s.id)) {
      continue;
    }
    const controls = Array.isArray(s.controls) ? s.controls : [];
    let i = 0;
    while (i < controls.length) {
      if (controls[i] && controls[i].wide) {
        rows += 1;
        i += 1;
      } else {
        // Pair with the next control only if that one is also narrow.
        const next = controls[i + 1];
        i += (next && !next.wide) ? 2 : 1;
        rows += 1;
      }
    }
  }

  const placements = [];
  let y = ((rows - 1) * ROW_H) / 2;
  for (const s of list) {
    placements.push({ type: 'header', sectionId: s.id, index: -1, x: 0, y });
    y -= ROW_H;
    if (!open.has(s.id)) {
      continue;
    }
    const controls = Array.isArray(s.controls) ? s.controls : [];
    let i = 0;
    while (i < controls.length) {
      if (controls[i] && controls[i].wide) {
        placements.push({ type: 'control', sectionId: s.id, index: i, x: 0, y });
        i += 1;
      } else {
        placements.push({ type: 'control', sectionId: s.id, index: i, x: -COL_X, y });
        const next = controls[i + 1];
        if (next && !next.wide) {
          placements.push({ type: 'control', sectionId: s.id, index: i + 1, x: COL_X, y });
          i += 2;
        } else {
          i += 1;
        }
      }
      y -= ROW_H;
    }
  }

  return { rows, height: rows * ROW_H + PAD, placements };
}

/**
 * Worst-case height (m) under the accordion rule VRApp enforces: at most one
 * section open at a time.
 *
 * This is the number that actually bounds the panel. Allowing every section to
 * be open at once measured 5.00 m / 91.4° vertical — *worse* than the 3.56 m
 * flat stack the grouping replaced, because each header adds a row on top of
 * all the controls. With one section open the worst case is
 * `sections + largest section`, so a new control can only ever grow the panel
 * by its own section, never by the whole inventory.
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
