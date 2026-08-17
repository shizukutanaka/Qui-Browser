/**
 * Angular-size invariants for every interactive target.
 *
 * Targets in this app are specified in metres, and metres alone cannot say
 * whether a control is hittable — the angle it subtends at the eye can. Session
 * 62 checked that for *text* legibility (arcmin against the 16–32 arcmin band);
 * nothing had ever checked it for *targets*, even though the panel distance is
 * a user-facing setting spanning 0.6–6.0 m, a 10× swing in every target's
 * apparent size.
 *
 * Thresholds are external (see src/vr/ui/angularSize.js for citations):
 *   - 1.5° — minimum interactive object size from the gaze-dwell literature.
 *     Asserted as a HARD invariant at the default distance, because gaze-dwell
 *     is the primary input path for the users this project is built for.
 *   - 3° — Meta Horizon OS's comfortable hit-target figure. Reported, not
 *     asserted: meeting it everywhere would mean resizing panels, which is a
 *     layout redesign rather than a defect fix.
 */

const {
  angularSizeDeg, sizeForAngleM, canvasRegionToMetres, classifyTarget,
  HIT_TARGET_MIN_DEG, GAZE_TARGET_MIN_DEG, GAZE_SPACING_MIN_DEG
} = require('../src/vr/ui/angularSize.js');
const G = require('../src/vr/browser/panelGeometry.js');
const {
  PANEL_PX_W, PANEL_PX_H, HEADER_H, ROW_H, DELETE_ZONE_W,
  SCROLL_UP_X0, SCROLL_UP_X1
} = require('../src/vr/browser/bookmarkLayout.js');
const {
  CONTENT_PX_W, CONTENT_PX_H, ARROW_W, ARROW_H
} = require('../src/vr/browser/readerLayout.js');

// ── the maths ────────────────────────────────────────────────────────────────
describe('angularSizeDeg', () => {
  test('a 1 m object at 1 m subtends 2·atan(0.5) ≈ 53.13°', () => {
    expect(angularSizeDeg(1, 1)).toBeCloseTo(53.1301, 3);
  });

  test('halving the distance is not doubling the angle (why the exact form matters)', () => {
    // The small-angle approximation size/d would say exactly 2x. At this app's
    // near distances it is wrong by tens of degrees, which is why the panel
    // being 106° wide at 0.6 m was never noticed.
    const far = angularSizeDeg(1.6, 1.2);
    const near = angularSizeDeg(1.6, 0.6);
    expect(near).toBeLessThan(far * 2);
    expect(near).toBeCloseTo(106.26, 1);
  });

  test('scales inversely with distance in the small-angle regime', () => {
    expect(angularSizeDeg(0.01, 2)).toBeCloseTo(angularSizeDeg(0.02, 4), 4);
  });

  test('degenerate input yields 0 rather than NaN or Infinity', () => {
    for (const [s, d] of [[0, 2], [-1, 2], [1, 0], [1, -2], [NaN, 2], [1, NaN], ['x', 2]]) {
      expect(angularSizeDeg(s, d)).toBe(0);
    }
  });
});

describe('sizeForAngleM', () => {
  test('round-trips with angularSizeDeg', () => {
    for (const d of [0.6, 1.2, 2, 6]) {
      for (const deg of [1.5, 3, 20]) {
        expect(angularSizeDeg(sizeForAngleM(deg, d), d)).toBeCloseTo(deg, 6);
      }
    }
  });

  test('degenerate input yields 0', () => {
    for (const [a, d] of [[0, 2], [-3, 2], [180, 2], [3, 0], [NaN, 2]]) {
      expect(sizeForAngleM(a, d)).toBe(0);
    }
  });
});

describe('canvasRegionToMetres', () => {
  test('scales a pixel region by the mesh it is painted on', () => {
    // 60 px of a 1024 px canvas drawn across a 1.6 m mesh.
    expect(canvasRegionToMetres(60, 1024, 1.6)).toBeCloseTo(0.09375, 6);
  });

  test('a full-canvas region is the whole mesh', () => {
    expect(canvasRegionToMetres(1024, 1024, 1.6)).toBeCloseTo(1.6, 10);
  });

  test('degenerate input yields 0', () => {
    expect(canvasRegionToMetres(0, 1024, 1.6)).toBe(0);
    expect(canvasRegionToMetres(60, 0, 1.6)).toBe(0);
    expect(canvasRegionToMetres(60, 1024, 0)).toBe(0);
  });
});

describe('classifyTarget', () => {
  test('boundaries land on the documented thresholds', () => {
    expect(classifyTarget(HIT_TARGET_MIN_DEG)).toBe('comfortable');
    expect(classifyTarget(HIT_TARGET_MIN_DEG - 0.001)).toBe('usable');
    expect(classifyTarget(GAZE_TARGET_MIN_DEG)).toBe('usable');
    expect(classifyTarget(GAZE_TARGET_MIN_DEG - 0.001)).toBe('too-small');
    expect(classifyTarget(0)).toBe('too-small');
  });

  test('the gaze floor is below the comfortable-hit figure, and spacing below both', () => {
    expect(GAZE_SPACING_MIN_DEG).toBeLessThan(GAZE_TARGET_MIN_DEG);
    expect(GAZE_TARGET_MIN_DEG).toBeLessThan(HIT_TARGET_MIN_DEG);
  });
});

// ── the target inventory ─────────────────────────────────────────────────────
const BOOKMARK_PANEL_H = G.BOOKMARK_PANEL_W * (PANEL_PX_H / PANEL_PX_W);
const cw = (px) => canvasRegionToMetres(px, G.CHROME_CANVAS_W, G.PANEL_W);
const bmw = (px) => canvasRegionToMetres(px, PANEL_PX_W, G.BOOKMARK_PANEL_W);
const bmh = (px) => canvasRegionToMetres(px, PANEL_PX_H, BOOKMARK_PANEL_H);

/**
 * Every target reachable by a controller ray or gaze dwell on the panels whose
 * distance the user can change. Sizes come from the real geometry modules.
 * `w`/`h` are the *hit* extents, not the drawn ones.
 */
function panelTargets() {
  const tabW = G.tabWidthPx(8); // worst case: MAX_TABS open, narrowest tabs
  return [
    // Chrome bar. _onChromeSelect keys off the horizontal coordinate only, so
    // the vertical extent of every button is the full bar height.
    { label: 'chrome back/forward/reload', w: cw(68), h: G.CHROME_M_H },
    { label: 'chrome close', w: cw(60), h: G.CHROME_M_H },
    { label: 'chrome bookmark star', w: cw(56), h: G.CHROME_M_H },
    { label: 'move bar (grab handle)', w: G.MOVE_BAR_W, h: G.MOVE_BAR_HIT_H },
    // Reader paging arrows, painted into the content canvas.
    {
      label: 'reader scroll arrow',
      w: canvasRegionToMetres(ARROW_W, CONTENT_PX_W, G.PANEL_W),
      h: canvasRegionToMetres(ARROW_H, CONTENT_PX_H, G.CONTENT_M_H)
    },
    // Tab strip.
    { label: 'tab strip: tab body', w: canvasRegionToMetres(tabW - G.STRIP_CLOSE_PX, G.STRIP_CANVAS_W, G.STRIP_W), h: G.STRIP_H },
    { label: 'tab strip: close zone', w: canvasRegionToMetres(G.STRIP_CLOSE_PX, G.STRIP_CANVAS_W, G.STRIP_W), h: G.STRIP_H },
    { label: 'tab strip: new tab', w: canvasRegionToMetres(G.STRIP_NEW_TAB_PX, G.STRIP_CANVAS_W, G.STRIP_W), h: G.STRIP_H },
    // Bookmark / history panel.
    { label: 'bookmark row', w: bmw(PANEL_PX_W - DELETE_ZONE_W), h: bmh(ROW_H) },
    { label: 'bookmark delete', w: bmw(DELETE_ZONE_W), h: bmh(ROW_H) },
    { label: 'bookmark scroll arrow', w: bmw(SCROLL_UP_X1 - SCROLL_UP_X0), h: bmh(HEADER_H) },
    { label: 'bookmark tab', w: bmw(200), h: bmh(HEADER_H) }
  ];
}

const minAxisDeg = (t, d) => Math.min(angularSizeDeg(t.w, d), angularSizeDeg(t.h, d));

describe('every panel target clears the gaze-dwell floor at the default distance', () => {
  const targets = panelTargets();

  test('the inventory is non-empty (guards against a vacuous loop)', () => {
    expect(targets.length).toBeGreaterThanOrEqual(12);
    for (const t of targets) {
      expect(t.w).toBeGreaterThan(0);
      expect(t.h).toBeGreaterThan(0);
    }
  });

  test.each(targets.map((t) => [t.label, t]))('%s', (_label, t) => {
    expect(minAxisDeg(t, G.PANEL_DISTANCE_DEFAULT)).toBeGreaterThanOrEqual(GAZE_TARGET_MIN_DEG);
  });

  test('…and at the OS large-text distance, which is closer still', () => {
    for (const t of targets) {
      expect(minAxisDeg(t, G.PANEL_DISTANCE_LARGE_TEXT))
        .toBeGreaterThanOrEqual(minAxisDeg(t, G.PANEL_DISTANCE_DEFAULT));
    }
  });
});

describe('the panel-distance setting still degrades every target (documented, unfixed)', () => {
  // Recorded rather than asserted-away: the panel does not scale with distance
  // (WindowManager never touches target.scale), so the stepper's own maximum
  // pushes every control below the gaze floor. Fixing that needs the tab strip
  // to become a child of the managed group first — see OUTSTANDING_ISSUES H-2.
  // This test pins the *shape* of the problem so it cannot be forgotten or
  // silently worsened.
  test('at the stepper maximum, no panel target reaches the gaze floor', () => {
    const worst = panelTargets().map((t) => minAxisDeg(t, G.PANEL_DISTANCE_MAX));
    expect(Math.max(...worst)).toBeLessThan(GAZE_TARGET_MIN_DEG);
  });

  test('at the stepper minimum the panel is far wider than the comfortable FOV', () => {
    // ~60° is the usual comfortable central field; the panel spans 106°.
    expect(angularSizeDeg(G.PANEL_W, G.PANEL_DISTANCE_MIN)).toBeGreaterThan(100);
  });

  test('the default distance sits inside the stepper bounds', () => {
    expect(G.PANEL_DISTANCE_DEFAULT).toBeGreaterThanOrEqual(G.PANEL_DISTANCE_MIN);
    expect(G.PANEL_DISTANCE_DEFAULT).toBeLessThanOrEqual(G.PANEL_DISTANCE_MAX);
    expect(G.PANEL_DISTANCE_LARGE_TEXT).toBeGreaterThanOrEqual(G.PANEL_DISTANCE_MIN);
  });
});

describe('the keyboard is close enough that every key is comfortable', () => {
  // Keyboard group sits at (0, 1.0, -0.6); eye height 1.6 m → 0.849 m away.
  const KEYBOARD_DISTANCE = Math.hypot(0.6, 0.6);
  const { KEY_W, KEY_H } = require('../src/vr/input/keyboardLayout.js');

  test.each([
    ['key', KEY_W, KEY_H],
    ['kanji candidate', 0.09, 0.07],
    ['url suggestion', 0.22, 0.07]
  ])('%s clears the comfortable hit-target figure', (_l, w, h) => {
    const deg = Math.min(angularSizeDeg(w, KEYBOARD_DISTANCE), angularSizeDeg(h, KEYBOARD_DISTANCE));
    expect(classifyTarget(deg)).toBe('comfortable');
  });
});

// ── the specific defects this session fixed ──────────────────────────────────
describe('move bar hitslop', () => {
  test('the drawn bar is unchanged — only the hit area grew', () => {
    expect(G.MOVE_BAR_H).toBeCloseTo(0.035, 6);
  });

  test('the visible bar alone would fail the gaze floor', () => {
    // This is the defect: 1.00° at the default distance.
    expect(angularSizeDeg(G.MOVE_BAR_H, G.PANEL_DISTANCE_DEFAULT)).toBeLessThan(GAZE_TARGET_MIN_DEG);
    expect(angularSizeDeg(G.MOVE_BAR_H, G.PANEL_DISTANCE_DEFAULT)).toBeCloseTo(1.0, 1);
  });

  test('the hit area reaches the comfortable hit-target figure', () => {
    expect(angularSizeDeg(G.MOVE_BAR_HIT_H, G.PANEL_DISTANCE_DEFAULT))
      .toBeCloseTo(HIT_TARGET_MIN_DEG, 6);
    expect(G.MOVE_BAR_HIT_H).toBeGreaterThan(G.MOVE_BAR_H * 2.5);
  });

  test('hitslop is symmetric, so the bar still looks centred in its mesh', () => {
    const slop = (G.MOVE_BAR_HIT_H - G.MOVE_BAR_H) / 2;
    expect(slop).toBeGreaterThan(0);
    // Neither edge of the hit area reaches the panel above it (gap 0.015 m).
    expect(slop).toBeLessThan(G.MOVE_BAR_GAP + G.MOVE_BAR_H);
  });
});

describe('tab close zone — draw and hit test share one definition', () => {
  test('the close zone lies entirely inside its own tab', () => {
    for (const n of [1, 2, 5, 8]) {
      const tabW = G.tabWidthPx(n);
      const z = G.tabCloseZonePx(tabW);
      expect(z.x0).toBeGreaterThanOrEqual(0);
      expect(z.x1).toBeLessThanOrEqual(tabW + 1e-9);
      expect(z.w).toBeGreaterThan(0);
    }
  });

  test('the old drawn box overflowed into the neighbouring tab', () => {
    // Pins the bug: the ✕ box was `height - 20` = 76 px square anchored at
    // tabW - 38, so with 8 tabs (tabW ≈ 117 px) it ran 38 px past the tab edge
    // — and that overflow selected the next tab instead of closing.
    const tabW = G.tabWidthPx(8);
    const oldBoxRight = (tabW - 38) + (G.STRIP_CANVAS_H - 20);
    expect(oldBoxRight).toBeGreaterThan(tabW);
    expect(G.tabCloseZonePx(tabW).x1).toBeLessThanOrEqual(tabW + 1e-9);
  });

  test('tabWidthPx caps wide tabs and handles an empty strip', () => {
    expect(G.tabWidthPx(0)).toBe(0);
    expect(G.tabWidthPx(1)).toBe(G.STRIP_TAB_MAX_PX);
    expect(G.tabWidthPx(8)).toBeCloseTo((G.STRIP_CANVAS_W - G.STRIP_NEW_TAB_PX) / 8, 6);
  });

  test('a tab narrower than the close zone still leaves a selectable body', () => {
    // Degenerate but reachable if the strip is ever resized: the zone clamps to
    // the tab rather than producing a negative origin.
    const z = G.tabCloseZonePx(20);
    expect(z.x0).toBe(0);
    expect(z.w).toBe(20);
  });
});
