/**
 * Tests for the VR keyboard's frecency URL-suggestion row (Session 48).
 *
 * BookmarkStore.search() (built in Session 18 explicitly for autocomplete)
 * had no visual surface — only the voice go-to command used it. The keyboard
 * now queries a suggestionProvider on every keystroke (≥ 2 chars) and shows
 * selectable URL buttons in the kanji-candidate strip zone; selecting one
 * confirms that URL directly, skipping the remaining gaze typing.
 *
 * THREE and the 2D canvas are mocked so the row lifecycle can be verified
 * headlessly (same conventions as caption-system.test.js).
 */

class MockGeometry { dispose() { this.disposed = true; } }
class MockMaterial {
  constructor(o = {}) { Object.assign(this, o); }
  dispose() { this.disposed = true; }
}
class MockMesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.name = '';
    this.visible = true;
    this.renderOrder = 0;
    this.position = { set: jest.fn() };
    this.rotation = { x: 0 };
    this.userData = {};
  }
}
class MockGroup {
  constructor() {
    this.name = '';
    this.visible = true;
    this.position = { set: jest.fn() };
    this.rotation = { x: 0 };
    this.children = [];
  }
  add(o) { this.children.push(o); }
  remove(o) { this.children = this.children.filter(c => c !== o); }
  traverse(fn) { fn(this); this.children.forEach(c => (c.traverse ? c.traverse(fn) : fn(c))); }
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

// Canvas 2D context stub.
const ctx2d = {
  clearRect: jest.fn(), fillRect: jest.fn(), fillText: jest.fn(), strokeRect: jest.fn(),
  fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '', textBaseline: ''
};
global.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d })
};
global.URL = URL;

const { textWidthEm } = require('../src/vr/ui/textWrap.js');
const { JapaneseIME, VRJapaneseKeyboard, suggestionLabel, SUGGESTION_MEASURE_EM } =
  require('../src/vr/input/JapaneseIME.js');

function makeKeyboard(opts = {}) {
  const scene = { add: jest.fn(), remove: jest.fn() };
  const registered = []; // [{ mesh, handlers }]
  const kb = new VRJapaneseKeyboard(scene, new JapaneseIME(), {
    registerInteractable: (mesh, handlers) => registered.push({ mesh, handlers }),
    unregisterInteractable: jest.fn(),
    ...opts
  });
  kb.createKeyboard();
  return { kb, registered };
}

/** The interactable registrations belonging to suggestion buttons only. */
function suggestionRegs(kb, registered) {
  return registered.filter(r => kb._suggestionMeshes.some(s => s.mesh === r.mesh));
}

describe('suggestionLabel (pure)', () => {
  test('prefers the page title', () => {
    expect(suggestionLabel({ url: 'https://example.com/x', title: 'Example Site' }))
      .toBe('Example Site');
  });

  test('falls back to the hostname when there is no title', () => {
    expect(suggestionLabel({ url: 'https://github.com/foo/bar' })).toBe('github.com');
  });

  test('falls back to the raw string for an unparseable URL', () => {
    expect(suggestionLabel({ url: 'not a url' })).toBe('not a url');
  });

  test('truncates long titles by code point (no split surrogate pair)', () => {
    const long = 'x'.repeat(30);
    const label = suggestionLabel({ url: 'https://a.com', title: long });
    expect(textWidthEm(label)).toBeLessThanOrEqual(SUGGESTION_MEASURE_EM);
    expect(label.endsWith('…')).toBe(true);
  });

  // Regression: the budget was 22 CHARACTERS, which silently assumed Latin.
  // The button canvas is 384px and the label is drawn at bold 34px, so 22
  // Latin characters (~374px) just fit while 22 full-width ones are 748px —
  // 95% wider than the button. Suggestion labels are page titles, which for a
  // Japanese user are overwhelmingly Japanese.
  describe('label width never exceeds the button (either script)', () => {
    const BUTTON_PX = 384;
    const LABEL_FONT = 34;
    const widthPx = (s) => textWidthEm(s) * LABEL_FONT;

    test('a long Japanese title fits the button', () => {
      const jp = 'これは非常に長い日本語のページタイトルです';
      expect(widthPx(suggestionLabel({ url: 'https://a.jp', title: jp }))).toBeLessThan(BUTTON_PX);
    });

    test('a long Latin title fits the button', () => {
      const en = 'An Extremely Long English Page Title That Goes On';
      expect(widthPx(suggestionLabel({ url: 'https://a.com', title: en }))).toBeLessThan(BUTTON_PX);
    });

    test('a mixed title fits the button', () => {
      expect(widthPx(suggestionLabel({ url: 'https://a.jp', title: 'WebXRの仕様とMDNドキュメント' })))
        .toBeLessThan(BUTTON_PX);
    });

    test('a long Japanese hostname fallback also fits', () => {
      expect(widthPx(suggestionLabel({ url: 'https://a.jp', title: '' })))
        .toBeLessThan(BUTTON_PX);
    });

    test('a truncated Japanese label keeps the ellipsis and no mojibake', () => {
      const label = suggestionLabel({ url: 'https://a.jp', title: '𠮷野家'.repeat(10) });
      expect(label.endsWith('…')).toBe(true);
      expect(label).not.toContain('�');
    });
  });

  test('empty/missing entry yields an empty string', () => {
    expect(suggestionLabel(null)).toBe('');
    expect(suggestionLabel({})).toBe('');
  });
});

describe('VRJapaneseKeyboard suggestion row', () => {
  test('queries the provider and shows buttons once the composition reaches 2 chars', async () => {
    const provider = jest.fn(() => [
      { url: 'https://github.com', title: 'GitHub' },
      { url: 'https://gitlab.com', title: 'GitLab' }
    ]);
    const { kb } = makeKeyboard({ suggestionProvider: provider });

    await kb.onKeyPress('g');
    expect(provider).not.toHaveBeenCalled(); // 1 char — below threshold

    await kb.onKeyPress('i');
    expect(provider).toHaveBeenCalledWith(kb.ime.compositionBuffer);
    expect(kb._suggestionMeshes).toHaveLength(2);
    expect(kb._suggestionsGroup.visible).toBe(true);
  });

  test('selecting a suggestion confirms its URL directly and clears the composition', async () => {
    const provider = jest.fn(() => [{ url: 'https://github.com', title: 'GitHub' }]);
    const { kb, registered } = makeKeyboard({ suggestionProvider: provider });
    const onConfirm = jest.fn();
    kb.setOnConfirm(onConfirm);

    await kb.onKeyPress('g');
    await kb.onKeyPress('i');
    const regs = suggestionRegs(kb, registered);
    expect(regs).toHaveLength(1);

    regs[0].handlers.onSelect();

    expect(onConfirm).toHaveBeenCalledWith('https://github.com');
    expect(kb.ime.compositionBuffer).toBe('');
    expect(kb.group.visible).toBe(false); // confirm path hides the keyboard
  });

  test('hovering a suggestion announces the FULL url, not the truncated label', async () => {
    const onHoverCaption = jest.fn();
    const url = 'https://github.com/some/very/long/path/that/would/be/truncated';
    const provider = jest.fn(() => [{ url, title: 'GitHub' }]);
    const { kb, registered } = makeKeyboard({ suggestionProvider: provider, onHoverCaption });

    await kb.onKeyPress('g');
    await kb.onKeyPress('i');
    suggestionRegs(kb, registered)[0].handlers.onHover();

    expect(onHoverCaption).toHaveBeenCalledWith(url);
  });

  test('a provider that throws does not break typing (degrades to no suggestions)', async () => {
    const provider = jest.fn(() => { throw new Error('storage exploded'); });
    const { kb } = makeKeyboard({ suggestionProvider: provider });

    await kb.onKeyPress('g');
    await expect(kb.onKeyPress('i')).resolves.toBeUndefined();
    expect(kb._suggestionMeshes).toHaveLength(0);
    // Composition itself kept working.
    expect(kb.ime.compositionBuffer.length).toBeGreaterThan(0);
  });

  test('suggestions are capped at 4 buttons', async () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ url: `https://site${i}.com` }));
    const provider = jest.fn(() => many);
    const { kb } = makeKeyboard({ suggestionProvider: provider });

    await kb.onKeyPress('g');
    await kb.onKeyPress('i');
    expect(kb._suggestionMeshes).toHaveLength(4);
  });

  test('deleting back below 2 chars clears the row', async () => {
    const provider = jest.fn(() => [{ url: 'https://github.com' }]);
    const { kb } = makeKeyboard({ suggestionProvider: provider });

    await kb.onKeyPress('g');
    await kb.onKeyPress('i');
    expect(kb._suggestionMeshes).toHaveLength(1);

    await kb.onKeyPress('back'); // buffer back to 1 char
    expect(kb._suggestionMeshes).toHaveLength(0);
  });

  test('showCandidates (kanji conversion) clears the suggestion row — shared strip zone', async () => {
    const provider = jest.fn(() => [{ url: 'https://github.com' }]);
    const { kb } = makeKeyboard({ suggestionProvider: provider });

    await kb.onKeyPress('g');
    await kb.onKeyPress('i');
    expect(kb._suggestionMeshes).toHaveLength(1);

    kb.showCandidates(['技', '着']);
    expect(kb._suggestionMeshes).toHaveLength(0);
    expect(kb._candidateMeshes.length).toBeGreaterThan(0);
  });

  test('hide() clears the suggestion row and unregisters its interactables', async () => {
    const provider = jest.fn(() => [{ url: 'https://github.com' }]);
    const { kb } = makeKeyboard({ suggestionProvider: provider });

    await kb.onKeyPress('g');
    await kb.onKeyPress('i');
    const mesh = kb._suggestionMeshes[0].mesh;

    kb.hide();

    expect(kb._suggestionMeshes).toHaveLength(0);
    expect(kb.unregisterInteractable).toHaveBeenCalledWith(mesh);
    expect(mesh.material.map.disposed).toBe(true); // texture freed, not leaked
  });

  test('no provider configured → typing never builds a suggestions group', async () => {
    const { kb } = makeKeyboard();
    await kb.onKeyPress('g');
    await kb.onKeyPress('i');
    expect(kb._suggestionsGroup).toBeNull();
  });

  test('entries without a url are skipped', async () => {
    const provider = jest.fn(() => [{ title: 'no url' }, { url: 'https://a.com' }]);
    const { kb } = makeKeyboard({ suggestionProvider: provider });
    await kb.onKeyPress('g');
    await kb.onKeyPress('i');
    expect(kb._suggestionMeshes).toHaveLength(1);
  });
});
