/**
 * The VR keyboard's composition strip paints a placeholder when the buffer is
 * empty. It was the literal 'type a URL or search…' — reachable by every user
 * who opens the keyboard, but always English, so a Japanese-language session
 * still showed the placeholder in English (WCAG 3.1.2).
 *
 * These tests drive the real `_refreshDisplay` paint path with a recording
 * canvas and assert on the text actually drawn, in both languages.
 */

class MockGeometry {
  dispose() {}
}
class MockMaterial {
  constructor(o = {}) {
    Object.assign(this, o);
    this.initialColor = o.color;
    this.color = { set: jest.fn() };
    this.opacity = o.opacity;
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
  worldToLocal(v) {
    return v;
  }
}
class MockGroup {
  constructor() {
    this.children = [];
    this.position = { set: jest.fn() };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.visible = true;
    this.name = '';
  }
  add(o) {
    this.children.push(o);
  }
  remove(o) {
    this.children = this.children.filter((c) => c !== o);
  }
  traverse(fn) {
    fn(this);
    this.children.forEach((c) => (c.traverse ? c.traverse(fn) : fn(c)));
  }
}
class MockCanvasTexture {
  constructor() {
    this.needsUpdate = false;
    this.colorSpace = '';
  }
  dispose() {
    this.disposed = true;
  }
}
jest.mock('three', () => ({
  Group: MockGroup,
  Mesh: MockMesh,
  PlaneGeometry: MockGeometry,
  MeshBasicMaterial: MockMaterial,
  CanvasTexture: MockCanvasTexture,
  SRGBColorSpace: 'srgb'
}));

jest.mock('../src/a11y/accessibility.js', () => ({
  prefersHighContrast: () => false,
  osReducedMotion: () => false,
  getPrefs: () => ({}),
  setPref: () => {},
  largeTextScale: () => 1
}));

function makeRecordingCanvas() {
  const paints = [];
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    clearRect() {},
    fillRect() {},
    fillText(text) {
      paints.push({ text: String(text), fillStyle: ctx.fillStyle, font: ctx.font });
    },
    strokeRect() {}
  };
  return { ctx, paints };
}

let canvases = [];
global.document = {
  documentElement: { lang: 'en' },
  createElement: () => {
    const rec = makeRecordingCanvas();
    canvases.push(rec);
    return { width: 0, height: 0, getContext: () => rec.ctx };
  }
};

const { JapaneseIME, VRJapaneseKeyboard } = require('../src/vr/input/JapaneseIME.js');
const { setLanguage, t } = require('../src/i18n/i18n.js');

function makeKeyboard() {
  const kb = new VRJapaneseKeyboard({ add: jest.fn(), remove: jest.fn() }, new JapaneseIME(), {
    registerInteractable: jest.fn(),
    unregisterInteractable: jest.fn()
  });
  kb.createKeyboard();
  return kb;
}

/** Repaint the display strip and return every text painted anywhere. */
function displayPaints(kb) {
  canvases.forEach((rec) => {
    rec.paints.length = 0;
  });
  kb._refreshDisplay();
  return canvases.flatMap((rec) => rec.paints.map((p) => p.text));
}

afterEach(() => {
  setLanguage('en');
});

describe('composition placeholder is localized', () => {
  test('an empty buffer paints the localized placeholder (EN)', () => {
    setLanguage('en');
    const kb = makeKeyboard();
    expect(displayPaints(kb)).toContain(t('vr.ime.urlPlaceholder'));
  });

  test('an empty buffer paints the localized placeholder (JA)', () => {
    setLanguage('ja');
    const kb = makeKeyboard();
    expect(displayPaints(kb)).toContain('URLまたは検索語を入力…');
  });

  test('the JA placeholder is not the English literal', () => {
    setLanguage('ja');
    const kb = makeKeyboard();
    expect(displayPaints(kb)).not.toContain('type a URL or search…');
  });

  test('typed text still wins over the placeholder', () => {
    setLanguage('ja');
    const kb = makeKeyboard();
    kb.ime.activate();
    kb.ime.compositionBuffer = 'あい';
    expect(displayPaints(kb)).toContain('あい');
  });
});
