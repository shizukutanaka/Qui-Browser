/**
 * Kanji-candidate row: the colour-independent cues must survive interaction.
 *
 * `candidateStyle` gives the top candidate a 1-based order number AND a heavier
 * 9px border precisely so primacy is not signalled by hue alone (WCAG 1.4.1).
 * The row used to paint its buttons from three separate ad-hoc blocks — initial,
 * onHover, onHoverEnd — and both hover blocks omitted the number and hardcoded
 * `lineWidth = 5`. So the first time a user pointed at any candidate, both cues
 * were destroyed, permanently (onHoverEnd did not restore them either), leaving
 * only green-vs-blue borders.
 *
 * These tests assert on what is actually PAINTED, not on the palette functions,
 * because the defect was entirely in the drawing path — the palette was correct
 * the whole time.
 */

class MockGeometry { dispose() {} }
class MockMaterial {
  constructor(o = {}) {
    Object.assign(this, o);
    // Keep the constructor argument: `color` is overwritten below with a
    // THREE.Color-like stub, so the value the code actually passed would
    // otherwise be unobservable.
    this.initialColor = o.color;
    this.color = { set: jest.fn() };
  }
  dispose() {}
}
class MockMesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.position = { set: jest.fn() };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.userData = {};
    this.name = '';
  }
  worldToLocal(v) { return v; }
}
class MockGroup {
  constructor() {
    this.children = [];
    this.position = { set: jest.fn() };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.visible = true;
    this.name = '';
  }
  add(o) { this.children.push(o); }
  remove(o) { this.children = this.children.filter((c) => c !== o); }
  traverse(fn) { fn(this); this.children.forEach((c) => (c.traverse ? c.traverse(fn) : fn(c))); }
}
class MockCanvasTexture {
  constructor() { this.needsUpdate = false; this.colorSpace = ''; }
  dispose() { this.disposed = true; }
}
jest.mock('three', () => ({
  Group: MockGroup,
  Mesh: MockMesh,
  PlaneGeometry: MockGeometry,
  MeshBasicMaterial: MockMaterial,
  CanvasTexture: MockCanvasTexture,
  SRGBColorSpace: 'srgb'
}));

// OS contrast preference is a module-level read, so it is mocked per test.
let mockHighContrast = false;
jest.mock('../src/a11y/accessibility.js', () => ({
  prefersHighContrast: () => mockHighContrast,
  osReducedMotion: () => false,
  getPrefs: () => ({}),
  setPref: () => {},
  largeTextScale: () => 1
}));

/**
 * A recording 2D context: every fillText / strokeRect keeps the style that was
 * in effect at call time, so a test can ask "was the order number painted, and
 * how heavy was the border" for each redraw.
 */
function makeRecordingCanvas() {
  const paints = [];
  const strokes = [];
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '', textBaseline: '',
    clearRect() {},
    fillRect() {},
    fillText(text) { paints.push({ text: String(text), fillStyle: ctx.fillStyle, font: ctx.font }); },
    strokeRect() { strokes.push({ strokeStyle: ctx.strokeStyle, lineWidth: ctx.lineWidth }); }
  };
  return { ctx, paints, strokes };
}

let canvases = [];
global.document = {
  createElement: () => {
    const rec = makeRecordingCanvas();
    canvases.push(rec);
    return { width: 0, height: 0, getContext: () => rec.ctx };
  }
};

const { JapaneseIME, VRJapaneseKeyboard, candidateStyle } =
  require('../src/vr/input/JapaneseIME.js');
const { imeColors } = require('../src/vr/input/keyboardLayout.js');

function makeKeyboard() {
  const registered = [];
  const kb = new VRJapaneseKeyboard({ add: jest.fn(), remove: jest.fn() }, new JapaneseIME(), {
    registerInteractable: (mesh, handlers) => registered.push({ mesh, handlers }),
    unregisterInteractable: jest.fn()
  });
  kb.createKeyboard();
  return { kb, registered };
}

/** The recording canvas created for candidate index `i`, and its handlers. */
function candidateAt(registered, i) {
  // Candidate meshes are the last N registered (keys are registered first).
  const candidates = registered.slice(-3);
  return candidates[i];
}

beforeEach(() => {
  mockHighContrast = false;
  canvases = [];
});

describe('candidate buttons keep their order number through hover', () => {
  const setup = () => {
    const { kb, registered } = makeKeyboard();
    canvases.length = 0; // discard the key/display canvases
    kb.showCandidates(['技', '着', '付']);
    return { kb, registered, candCanvases: canvases.slice() };
  };

  test('the initial paint includes the 1-based order number on every candidate', () => {
    const { candCanvases } = setup();
    expect(candCanvases).toHaveLength(3);
    candCanvases.forEach((rec, i) => {
      expect(rec.paints.map((p) => p.text)).toContain(String(i + 1));
    });
  });

  test('hovering a candidate REPAINTS the order number (it used to vanish)', () => {
    const { registered, candCanvases } = setup();
    const rec = candCanvases[0];
    rec.paints.length = 0;

    candidateAt(registered, 0).handlers.onHover();

    const texts = rec.paints.map((p) => p.text);
    expect(texts).toContain('1');   // the cue survives
    expect(texts).toContain('技');  // …alongside the candidate itself
  });

  test('un-hovering restores the number too (onHoverEnd also used to drop it)', () => {
    const { registered, candCanvases } = setup();
    const rec = candCanvases[1];
    candidateAt(registered, 1).handlers.onHover();
    rec.paints.length = 0;

    candidateAt(registered, 1).handlers.onHoverEnd();

    expect(rec.paints.map((p) => p.text)).toContain('2');
  });

  test('the primary keeps its heavier border weight across hover and back', () => {
    const { registered, candCanvases } = setup();
    const rec = candCanvases[0];
    const primaryWeight = candidateStyle(0).lineWidth;
    const otherWeight = candidateStyle(1).lineWidth;
    expect(primaryWeight).toBeGreaterThan(otherWeight); // the cue exists at all

    // Initial paint already used it.
    expect(rec.strokes[rec.strokes.length - 1].lineWidth).toBe(primaryWeight);

    rec.strokes.length = 0;
    candidateAt(registered, 0).handlers.onHover();
    expect(rec.strokes[0].lineWidth).toBe(primaryWeight);

    rec.strokes.length = 0;
    candidateAt(registered, 0).handlers.onHoverEnd();
    // The regression: this used to come back as 5, silently demoting the top
    // candidate to look identical in weight to the rest.
    expect(rec.strokes[0].lineWidth).toBe(primaryWeight);
  });

  test('non-primary candidates keep the lighter weight, so the cue stays a contrast', () => {
    const { registered, candCanvases } = setup();
    const rec = candCanvases[2];
    rec.strokes.length = 0;
    candidateAt(registered, 2).handlers.onHoverEnd();
    expect(rec.strokes[0].lineWidth).toBe(candidateStyle(2).lineWidth);
    expect(rec.strokes[0].lineWidth).toBeLessThan(candidateStyle(0).lineWidth);
  });
});

describe('the keyboard honours the OS contrast preference', () => {
  test('candidateStyle switches palette with the high-contrast flag', () => {
    const normal = candidateStyle(0, false);
    const high = candidateStyle(0, true);
    expect(high.bg).not.toBe(normal.bg);
    expect(high.bg).toBe(imeColors(true).candPrimaryBg);
    expect(normal.bg).toBe(imeColors(false).candPrimaryBg);
    // The weight cue is a shape, not a colour — identical in both modes.
    expect(high.lineWidth).toBe(normal.lineWidth);
    expect(high.number).toBe(normal.number);
  });

  test('keys paint high-contrast colours when the OS asks', () => {
    mockHighContrast = true;
    const { kb } = makeKeyboard();
    const hc = imeColors(true);
    // Every key texture is painted through imeColors, so at least one recorded
    // label must use the high-contrast label colour.
    const allPaints = canvases.flatMap((c) => c.paints);
    expect(allPaints.length).toBeGreaterThan(0);
    expect(allPaints.some((p) => p.fillStyle === hc.keyLabel)).toBe(true);
    expect(allPaints.some((p) => p.fillStyle === imeColors(false).keyLabelActive)).toBe(false);
    expect(kb.keyboard).toBeTruthy();
  });

  test('the backing panel goes opaque black in high contrast', () => {
    mockHighContrast = true;
    const { kb } = makeKeyboard();
    const panel = kb.group.children.find((c) => c.material && !c.material.map);
    expect(panel).toBeTruthy();
    expect(panel.material.opacity).toBe(imeColors(true).panelOpacity);
    expect(panel.material.initialColor).toBe(imeColors(true).panelBg);
  });

  test('the backing panel keeps its translucent look in normal mode', () => {
    mockHighContrast = false;
    const { kb } = makeKeyboard();
    const panel = kb.group.children.find((c) => c.material && !c.material.map);
    expect(panel.material.opacity).toBe(imeColors(false).panelOpacity);
    expect(panel.material.initialColor).toBe(imeColors(false).panelBg);
  });

  test('candidate buttons paint high-contrast colours when the OS asks', () => {
    mockHighContrast = true;
    const { kb, registered } = makeKeyboard();
    canvases.length = 0;
    kb.showCandidates(['技', '着', '付']);
    const rec = canvases[0];
    const hc = imeColors(true);
    expect(rec.paints.map((p) => p.fillStyle)).toContain(hc.candNumber);
    expect(rec.strokes.map((k) => k.strokeStyle)).toContain(hc.candPrimaryBorder);
    // …and the normal-mode border must be absent, proving the switch happened.
    expect(rec.strokes.map((k) => k.strokeStyle))
      .not.toContain(imeColors(false).candPrimaryBorder);
    expect(registered.length).toBeGreaterThan(0);
  });
});
