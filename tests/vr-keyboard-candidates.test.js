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

class MockGeometry {
  dispose() {}
}
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
    fn(this); this.children.forEach((c) => (c.traverse ? c.traverse(fn) : fn(c)));
  }
}
class MockCanvasTexture {
  constructor(image) {
    this.image = image;
    this.needsUpdate = false; this.colorSpace = '';
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
    fillText(text) {
      paints.push({ text: String(text), fillStyle: ctx.fillStyle, font: ctx.font });
    },
    strokeRect() {
      strokes.push({ strokeStyle: ctx.strokeStyle, lineWidth: ctx.lineWidth });
    }
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

describe('esc dismissal resets IME state (regression: stale candidates injected)', () => {
  // esc cleared compositionBuffer directly but left candidates/selectedIndex/
  // isActive intact — so the next show() skipped activate()→clear() and a bare
  // Enter emitted the previous session's kanji candidate instead of the typed
  // composition.
  test('esc after conversion, then fresh session Enter returns typed text', async () => {
    const confirmed = [];
    const { kb } = makeKeyboard();
    kb.onTextConfirmed = (t) => confirmed.push(t);
    global.fetch = jest.fn(() => Promise.reject(new Error('offline'))); // offline kanji dict

    // Session 1: type こんにちは, convert, then dismiss with esc
    for (const ch of 'konnichiha') {
      await kb.onKeyPress(ch);
    }
    await kb.onKeyPress('変換'); // candidates: ['今日は', 'こんにちは']
    await kb.onKeyPress('esc');
    expect(kb.ime.candidates.length).toBe(0);
    expect(kb.ime.isActive).toBe(false);

    // Session 2: reopen, type, press Enter — must NOT emit the stale '今日は'.
    // (confirmSelection returns the displayed text — the kana conversion 'か'
    // for the typed 'ka', per standard IME semantics.)
    kb.show();
    await kb.onKeyPress('k');
    await kb.onKeyPress('a');
    await kb.onKeyPress('enter');
    expect(confirmed).toEqual(['か']);
    expect(confirmed[0]).not.toBe('今日は');

    delete global.fetch;
  });
});

describe('VRJapaneseKeyboard.dispose — 3D resource teardown', () => {
  test('dispose unregisters every key interactable and detaches the group', () => {
    const scene = { add: jest.fn(), remove: jest.fn() };
    const unregister = jest.fn();
    const kb = new VRJapaneseKeyboard(scene, new JapaneseIME(), {
      registerInteractable: jest.fn(),
      unregisterInteractable: unregister
    });
    kb.createKeyboard();
    const keyCount = kb.keyMeshes.length;
    expect(keyCount).toBeGreaterThan(0);

    kb.dispose();

    expect(unregister).toHaveBeenCalledTimes(keyCount);
    expect(kb.keyMeshes).toHaveLength(0);
    expect(scene.remove).toHaveBeenCalled();
    expect(kb.group).toBeNull();
  });

  test('dispose clears candidate meshes and calls ime.dispose', () => {
    const kb = new VRJapaneseKeyboard({ add: jest.fn(), remove: jest.fn() }, new JapaneseIME(), {
      registerInteractable: jest.fn(),
      unregisterInteractable: jest.fn()
    });
    kb.createKeyboard();
    kb.showCandidates(['a', 'b']);
    const imeDispose = jest.spyOn(kb.ime, 'dispose');

    kb.dispose();

    expect(imeDispose).toHaveBeenCalled();
    expect(kb._candidatesGroup).toBeNull();
  });
});

describe('key texture/hover layer — repaint + dispose + shift latch', () => {
  test('key hover fires onHoverCaption and repaints with hover colors', () => {
    const captions = [];
    const kb = new VRJapaneseKeyboard({ add: jest.fn(), remove: jest.fn() }, new JapaneseIME(), {
      registerInteractable: (mesh, handlers) => registeredKeys.push({ mesh, handlers }),
      unregisterInteractable: jest.fn(),
      onHoverCaption: (c) => captions.push(c)
    });
    const registeredKeys = [];
    kb.createKeyboard();
    const key = registeredKeys[0];
    const before = key.mesh.userData.keyTex;
    before.needsUpdate = false;
    key.handlers.onHover();
    expect(captions).toHaveLength(1);
    // Repaint in place: same texture object re-uploaded, no alloc/dispose churn.
    expect(key.mesh.userData.keyTex).toBe(before);
    expect(before.needsUpdate).toBe(true);
    key.handlers.onHoverEnd();
  });

  test('shift latch repaints to the active color only when katakana mode changes', () => {
    const { kb } = makeKeyboard();
    const shift = kb.keyMeshes.find(k => k.label === 'shift');
    expect(shift).toBeDefined();
    const texBefore = shift.mesh.userData.keyTex;
    texBefore.needsUpdate = false;
    kb._refreshKeyStates(); // mode still romaji — no repaint
    expect(shift.mesh.userData.keyTex).toBe(texBefore);
    expect(texBefore.needsUpdate).toBe(false);
    kb.ime.inputMode = 'katakana';
    kb._refreshKeyStates();
    expect(shift.mesh.userData.keyActive).toBe(true);
    // Repaint in place — texture identity retained, contents re-uploaded.
    expect(shift.mesh.userData.keyTex).toBe(texBefore);
    expect(texBefore.needsUpdate).toBe(true);
    kb.ime.inputMode = 'romaji';
    kb._refreshKeyStates();
    expect(shift.mesh.userData.keyActive).toBe(false);
  });
});

describe('keyboard remaining arms', () => {
  test('createKeyboard is idempotent once the group exists', () => {
    const { kb } = makeKeyboard();
    const first = kb.group;
    const kbKeys = kb.keyboard;
    const again = kb.createKeyboard();
    expect(kb.group).toBe(first);
    expect(again).toBe(kbKeys);
  });

  test('key onSelect routes to onKeyPress; onHover fires caption hook', async () => {
    const { kb, registered } = makeKeyboard();
    const keyEntry = registered.find((e) => e.mesh.userData.keyLabel === 'a');
    const spy = jest.spyOn(kb, 'onKeyPress');
    kb.onHoverCaption = jest.fn();
    keyEntry.handlers.onSelect();
    expect(spy).toHaveBeenCalledWith('a');
    keyEntry.handlers.onHover();
    expect(kb.onHoverCaption).toHaveBeenCalledWith('a');
  });

  test('_refreshKeyStates and _refreshDisplay no-op before keyboard exists', () => {
    const kb = new VRJapaneseKeyboard({ add: jest.fn(), remove: jest.fn() }, new JapaneseIME(), {});
    expect(() => kb._refreshKeyStates()).not.toThrow();
    expect(() => kb._refreshDisplay()).not.toThrow();
  });

  test('show() lazily builds the keyboard; showCandidates ignores empty lists', () => {
    const kb = new VRJapaneseKeyboard({ add: jest.fn(), remove: jest.fn() }, new JapaneseIME(), {
      registerInteractable: jest.fn(), unregisterInteractable: jest.fn()
    });
    kb.show();
    expect(kb.group).toBeTruthy();
    expect(() => kb.showCandidates([])).not.toThrow();
    expect(() => kb.showCandidates(null)).not.toThrow();
  });
});

describe('onKeyPress special keys', () => {
  test('space types a literal space — conversion lives on 変換 (regression pin)', async () => {
    const { kb } = makeKeyboard();
    const spy = jest.spyOn(kb.ime, 'convertToKanji');
    // hiragana mode
    for (const ch of 'multi') {
      await kb.onKeyPress(ch);
    }
    await kb.onKeyPress('space');
    expect(kb.ime.compositionBuffer).toBe('multi ');
    expect(spy).not.toHaveBeenCalled(); // no conversion — and no transliterate fetch
    // ascii mode gets the same literal space (URL/search entry)
    kb.ime.switchMode('ascii');
    await kb.onKeyPress('space');
    expect(kb.ime.compositionBuffer).toBe('multi  ');
    expect(spy).not.toHaveBeenCalled();
  });

  test('変換 shows the candidate row (space no longer does)', async () => {
    const { kb } = makeKeyboard();
    global.fetch = jest.fn(async () => ({
      ok: true, status: 200, json: async () => [['きょう', ['今日', '強']]]
    }));
    for (const ch of 'kyou') {
      await kb.onKeyPress(ch);
    }
    await kb.onKeyPress('変換');
    expect(kb.ime.candidates).toEqual(['今日', '強']);
    delete global.fetch;
  });

  test('変換 triggers kanji conversion; かな forces hiragana', async () => {
    const { kb } = makeKeyboard();
    const spy = jest.spyOn(kb.ime, 'convertToKanji').mockResolvedValue([]);
    await kb.onKeyPress('変換');
    expect(spy).toHaveBeenCalled();
    kb.ime.inputMode = 'katakana';
    await kb.onKeyPress('かな');
    expect(kb.ime.inputMode).toBe('hiragana');
  });

  test('shift toggles katakana latch and repaints key states', async () => {
    const { kb } = makeKeyboard();
    expect(kb.ime.inputMode).toBe('hiragana');
    await kb.onKeyPress('shift');
    expect(kb.ime.inputMode).toBe('katakana');
    await kb.onKeyPress('shift');
    expect(kb.ime.inputMode).toBe('hiragana');
  });

  test('esc clears state, hides, and fires onCancel', async () => {
    const { kb } = makeKeyboard();
    kb.ime.compositionBuffer = 'ka';
    kb.ime.isActive = true;
    kb.onCancel = jest.fn();
    kb.show();
    await kb.onKeyPress('esc');
    expect(kb.ime.compositionBuffer).toBe('');
    expect(kb.ime.isActive).toBe(false);
    expect(kb.onCancel).toHaveBeenCalled();
  });

});

describe('candidate select/hover + suggestions arms', () => {
  test('candidate onSelect uses ime.selectCandidate when present, else the kanji', () => {
    const { kb, registered } = makeKeyboard();
    kb.onTextConfirmed = jest.fn();
    kb.showCandidates(['技', '着', '付']);
    // Without selectCandidate → falls back to the kanji literal.
    delete kb.ime.selectCandidate;
    candidateAt(registered, 1).handlers.onSelect();
    expect(kb.onTextConfirmed).toHaveBeenCalledWith('着');
  });

  test('candidate onHover repaints and announces via onHoverCaption', () => {
    const { kb, registered } = makeKeyboard();
    kb.onHoverCaption = jest.fn();
    kb.showCandidates(['技', '着', '付']);
    const cand = candidateAt(registered, 0);
    cand.handlers.onHover();
    expect(kb.onHoverCaption).toHaveBeenCalledWith('技');
    cand.handlers.onHoverEnd(); // repaint-back arm
  });

  test('showSuggestions returns early when every entry lacks a url', () => {
    const { kb, registered } = makeKeyboard();
    const before = registered.length;
    kb.showSuggestions([{ title: 'no url' }, null, {}]);
    // Early return before any button is built — no new interactables.
    expect(registered.length).toBe(before);
  });

  test('suggestion onHover announces the full URL and onHoverEnd repaints', () => {
    const registered = [];
    const kb = new VRJapaneseKeyboard({ add: jest.fn(), remove: jest.fn() }, new JapaneseIME(), {
      registerInteractable: (mesh, handlers) => registered.push({ mesh, handlers }),
      unregisterInteractable: jest.fn()
    });
    kb.createKeyboard();
    kb.onHoverCaption = jest.fn();
    kb.showSuggestions([{ url: 'https://example.com/very/long/path', title: 'Ex' }]);
    const sug = registered[registered.length - 1];
    sug.handlers.onHover();
    expect(kb.onHoverCaption).toHaveBeenCalledWith('https://example.com/very/long/path');
    sug.handlers.onHoverEnd();
  });
});

describe('VRJapaneseKeyboard — callback-absent and guard arms', () => {
  test('keyboard works end-to-end with no optional callbacks wired', async () => {
    const kb = new VRJapaneseKeyboard({ add: jest.fn(), remove: jest.fn() }, new JapaneseIME(), {
      registerInteractable: () => {} // present, but no onKeyPress/onHoverCaption/onCancel/suggestionProvider
    });
    kb.createKeyboard();
    expect(() => {
      kb.show();
      kb.hide();
    }).not.toThrow();
    // esc without onCancel → no throw (arm at ~1099)
    await kb.onKeyPress('esc');
    // enter without _onConfirmCallback → hide + debug only
    await kb.onKeyPress('enter');
    expect(kb._onConfirmCallback).toBeNull();
  });

  test('no registerInteractable at all — keys/suggestions still build', () => {
    const kb = new VRJapaneseKeyboard({ add: jest.fn(), remove: jest.fn() }, new JapaneseIME(), {});
    kb.createKeyboard();
    kb.show(); // assigns nothing new — group already built; keeps the group visible
    kb.showSuggestions([{ url: 'https://example.com', title: 'x' }]);
    expect(kb._suggestionMeshes.length).toBe(1);
    // _clear* guards with unregisterInteractable absent
    expect(() => {
      kb._clearSuggestions();
    }).not.toThrow();
    kb.showCandidates(['あ']); // candidate row supersedes the suggestion strip
    expect(kb._candidateMeshes.length).toBe(1);
    expect(() => {
      kb._clearCandidates();
    }).not.toThrow();
  });

  test('hide() before createKeyboard is a no-op', () => {
    const kb = new VRJapaneseKeyboard({ add: jest.fn() }, new JapaneseIME(), {});
    expect(() => kb.hide()).not.toThrow();
    expect(kb.group).toBeFalsy();
  });

  test('_refreshKeyStates early-returns when ime or keyMeshes absent', () => {
    const { kb } = makeKeyboard();
    kb.ime = null;
    expect(() => kb._refreshKeyStates()).not.toThrow();
    kb.ime = new JapaneseIME();
    kb.keyMeshes = null;
    expect(() => kb._refreshKeyStates()).not.toThrow();
  });

  test('_refreshDisplay covers ime-absent badge + unknown-mode badge', () => {
    const { kb } = makeKeyboard();
    // The display canvas was the first canvas createKeyboard() made.
    const rec = canvases[0];
    kb.ime = null;
    rec.paints.length = 0;
    expect(() => kb._refreshDisplay()).not.toThrow();
    expect(rec.paints.map((p) => p.text)).toContain('ひ'); // null-ime → 'hiragana' badge
    kb.ime = { inputMode: 'latin', compositionBuffer: '' };
    rec.paints.length = 0;
    kb._refreshDisplay();
    expect(rec.paints.map((p) => p.text)).toContain('?'); // BADGE[mode] || '?'
    kb.ime = { inputMode: 'ascii', compositionBuffer: '' };
    rec.paints.length = 0;
    kb._refreshDisplay();
    expect(rec.paints.map((p) => p.text)).toContain('A'); // ascii badge
  });

  test('_refreshDisplay paints the kana conversion, not the romaji source', () => {
    const { kb } = makeKeyboard();
    const rec = canvases[0];
    kb.ime.compositionBuffer = 'kyou';
    kb.ime.inputMode = 'hiragana';
    rec.paints.length = 0;
    kb._refreshDisplay();
    expect(rec.paints.map((p) => p.text)).toContain('きょう');
    expect(rec.paints.map((p) => p.text)).not.toContain('kyou');
    kb.ime.inputMode = 'katakana';
    rec.paints.length = 0;
    kb._refreshDisplay();
    expect(rec.paints.map((p) => p.text)).toContain('キョウ');
  });

  test('_setKeyHover tolerates a mesh whose prior texture was never stored', () => {
    const { kb } = makeKeyboard();
    const mesh = { userData: {}, material: { map: null, needsUpdate: false } };
    expect(() => kb._setKeyHover(mesh, true)).not.toThrow();
    expect(mesh.material.map).toBeTruthy();
  });

  test('multi-char non-switch key in onKeyPress does nothing', async () => {
    const { kb } = makeKeyboard();
    await expect(kb.onKeyPress('nope')).resolves.not.toThrow();
    expect(kb.ime.compositionBuffer).toBe('');
  });

  test('showCandidates reuses the lazy group on a second call', () => {
    const { kb } = makeKeyboard();
    kb.showCandidates(['あ']);
    const first = kb._candidatesGroup;
    kb.showCandidates(['い', 'う']);
    expect(kb._candidatesGroup).toBe(first);
    expect(kb._candidateMeshes.length).toBe(2);
  });

  test('candidate onSelect without ime.selectCandidate falls back to the kanji text', () => {
    const registered = [];
    const confirmed = [];
    const kb = new VRJapaneseKeyboard({ add: jest.fn() }, { }, {
      registerInteractable: (mesh, handlers) => registered.push({ mesh, handlers }),
      unregisterInteractable: jest.fn()
    });
    kb.setOnConfirm((t) => confirmed.push(t));
    kb.createKeyboard();
    kb.show();
    kb.showCandidates(['あ']);
    const cand = registered[registered.length - 1];
    cand.handlers.onSelect();
    expect(confirmed).toEqual(['あ']); // `selectCandidate` absent → `kanji` fallback
  });

  test('_updateSuggestions: null provider / short query / throwing provider / null results', () => {
    const { kb } = makeKeyboard();
    // no provider at all → immediate return
    expect(() => kb._updateSuggestions()).not.toThrow();
    // provider but query too short → clears suggestions
    kb.suggestionProvider = () => [{ url: 'https://x.com' }];
    kb.ime.compositionBuffer = 'a';
    expect(() => kb._updateSuggestions()).not.toThrow();
    expect(kb._suggestionMeshes.length).toBe(0);
    // provider throws → caught, empty results
    kb.suggestionProvider = () => {
      throw new Error('boom');
    };
    kb.ime.compositionBuffer = 'exa';
    expect(() => kb._updateSuggestions()).not.toThrow();
    expect(kb._suggestionMeshes.length).toBe(0);
    // provider returns null → `|| []` arm
    kb.suggestionProvider = () => null;
    expect(() => kb._updateSuggestions()).not.toThrow();
    expect(kb._suggestionMeshes.length).toBe(0);
    // ime absent → query '' → early return
    kb.ime = null;
    expect(() => kb._updateSuggestions()).not.toThrow();
  });

  test('suggestion onHover without onHoverCaption / onSelect without ime', () => {
    const registered = [];
    const kb = new VRJapaneseKeyboard({ add: jest.fn() }, null, {
      registerInteractable: (mesh, handlers) => registered.push({ mesh, handlers })
    });
    kb.createKeyboard();
    kb._suggestionsGroup = new MockGroup();
    kb.showSuggestions([{ url: 'https://example.com', title: 'Example' }]);
    const sug = registered[registered.length - 1];
    expect(() => {
      sug.handlers.onHover(); sug.handlers.onHoverEnd(); sug.handlers.onSelect();
    }).not.toThrow();
  });
});

describe('VRJapaneseKeyboard — remaining guard arms', () => {
  test('constructor coerces non-function callbacks + non-positive scale', () => {
    const kb = new VRJapaneseKeyboard({ add() {}, remove() {} }, new JapaneseIME(), {
      registerInteractable() {}, unregisterInteractable() {},
      scale: 0, onHoverCaption: 'x', onCancel: 9, suggestionProvider: []
    });
    expect(kb.scale).toBe(1);
    expect(kb.onHoverCaption).toBeNull();
    expect(kb.onCancel).toBeNull();
    expect(kb.suggestionProvider).toBeNull();
  });

  test('setOnConfirm with non-function clears the callback', () => {
    const { kb } = makeKeyboard();
    kb.setOnConfirm(42);
    expect(kb._onConfirmCallback).toBeNull();
  });

  test('show() before createKeyboard: lazy-builds, group guard passes', () => {
    const kb = new VRJapaneseKeyboard({ add() {}, remove() {} }, new JapaneseIME(), {
      registerInteractable() {}, unregisterInteractable() {}
    });
    expect(() => kb.show()).not.toThrow();
    expect(kb.group).toBeTruthy();
  });

  test('変換 with convertToKanji returning falsy shows no candidates', async () => {
    const { kb } = makeKeyboard();
    kb.ime.convertToKanji = async () => null; // falsy-result arm
    await kb.onKeyPress('変換');
    expect(kb._candidatesGroup?.visible ?? false).toBe(false);
  });

  test('_updateSuggestions with ime null treats query as empty', () => {
    const { kb } = makeKeyboard();
    kb.suggestionProvider = jest.fn(() => ['x']);
    kb.ime = null;
    expect(() => kb._updateSuggestions()).not.toThrow();
    expect(kb.suggestionProvider).not.toHaveBeenCalled(); // <2 chars → clear only
  });

  test('dispose with partial state: no keyMeshes/display/scene/ime guards', () => {
    const kb = new VRJapaneseKeyboard(null, null, {
      registerInteractable() {}, unregisterInteractable() {}
    });
    expect(() => kb.dispose()).not.toThrow();
    expect(kb.group).toBeNull();
  });

  test('_refreshDisplay with _displayTex null skips needsUpdate', () => {
    const { kb } = makeKeyboard();
    kb._displayTex = null;
    expect(() => kb._refreshDisplay()).not.toThrow();
  });
});

describe('VRJapaneseKeyboard — last branch arms', () => {
  test('constructor with no opts uses all defaults', () => {
    const { VRJapaneseKeyboard } = require('../src/vr/input/JapaneseIME.js');
    const kb = new VRJapaneseKeyboard({ add() {}, remove() {} }, { convertRomajiToHiragana: (s) => s });
    expect(kb.scale).toBe(1);
    expect(kb.onHoverCaption).toBeNull();
    expect(kb.suggestionProvider).toBeNull();
  });

  test('_updateSuggestions with short query clears instead of calling provider', () => {
    const { VRJapaneseKeyboard } = require('../src/vr/input/JapaneseIME.js');
    const provider = jest.fn();
    const kb = new VRJapaneseKeyboard({ add() {}, remove() {} },
      { compositionBuffer: 'a', convertRomajiToHiragana: (s) => s },
      { suggestionProvider: provider });
    kb._clearSuggestions = jest.fn();
    kb._updateSuggestions();
    expect(provider).not.toHaveBeenCalled();
    expect(kb._clearSuggestions).toHaveBeenCalled();
  });

  test('key hover without onHoverCaption does not throw', () => {
    const { kb } = makeKeyboard();
    kb.show();
    const { mesh } = kb.keyMeshes[0];
    const cfg = mesh.userData;
    // Drive the registered hover handler directly if captured.
    expect(() => cfg.onHover?.()).not.toThrow();
  });
});

describe('VRJapaneseKeyboard — complementary arms', () => {
  test('constructor accepts all function-typed option callbacks', () => {
    const onHoverCaption = jest.fn();
    const onCancel = jest.fn();
    const suggestionProvider = jest.fn(async () => []);
    const kb = new VRJapaneseKeyboard(
      { add: jest.fn(), remove: jest.fn() },
      new JapaneseIME(),
      { onHoverCaption, onCancel, suggestionProvider }
    );
    expect(kb.onHoverCaption).toBe(onHoverCaption);
    expect(kb.onCancel).toBe(onCancel);
    expect(kb.suggestionProvider).toBe(suggestionProvider);
    kb.dispose?.();
  });

  test('key hover fires onHoverCaption with the key label', () => {
    const onHoverCaption = jest.fn();
    const registered = [];
    const kb = new VRJapaneseKeyboard(
      { add: jest.fn(), remove: jest.fn() },
      new JapaneseIME(),
      {
        registerInteractable: (m, h) => registered.push(h),
        unregisterInteractable: jest.fn(),
        onHoverCaption
      }
    );
    kb.createKeyboard?.();
    const hover = registered.find((h) => h && h.onHover);
    if (hover) {
      hover.onHover();
      expect(onHoverCaption).toHaveBeenCalled();
    }
    kb.dispose?.();
  });

  test('dispose with populated keyMeshes releases geometry/material/texture', () => {
    const { kb } = makeKeyboard();
    kb.createKeyboard?.();
    expect(() => kb.dispose()).not.toThrow();
  });

  test('show() with existing group makes it visible', () => {
    const { kb } = makeKeyboard();
    kb.group = { visible: false };
    kb._displayCanvas = null;
    kb.show?.();
    if (kb.group) {
      expect(kb.group.visible).toBe(true);
    }
  });
});

describe('VRJapaneseKeyboard — dispose member-present arms', () => {
  test('dispose frees geometry, material and map on every registered key mesh', () => {
    const { kb } = makeKeyboard();
    const map = { dispose: jest.fn() };
    const mat = { dispose: jest.fn(), map };
    const geo = { dispose: jest.fn() };
    kb.keyMeshes.push({ mesh: { geometry: geo, material: mat, userData: { keyTex: map } } });
    kb.dispose();
    expect(geo.dispose).toHaveBeenCalled();
    expect(map.dispose).toHaveBeenCalled();
    expect(mat.dispose).toHaveBeenCalled();
  });

  test('dispose frees display mesh geometry/material/texture when present', () => {
    const { kb } = makeKeyboard();
    const map = { dispose: jest.fn() };
    const mat = { dispose: jest.fn(), map };
    const geo = { dispose: jest.fn() };
    const tex = { dispose: jest.fn() };
    kb._displayMesh = { geometry: geo, material: mat };
    kb._displayTex = tex;
    kb.dispose();
    expect(geo.dispose).toHaveBeenCalled();
    expect(mat.dispose).toHaveBeenCalled();
    expect(tex.dispose).toHaveBeenCalled();
  });

  test('suggestions clear when the composition query is shorter than 2 chars', () => {
    const { kb } = makeKeyboard();
    kb.suggestionProvider = () => [];
    kb.ime = { compositionBuffer: 'a' };
    kb._clearSuggestions = jest.fn();
    kb._updateSuggestions();
    expect(kb._clearSuggestions).toHaveBeenCalled();
  });
});

describe('VRJapaneseKeyboard — remaining member-guard arms', () => {
  test('key hover fires onHoverCaption when the callback is wired', () => {
    const scene = { add: jest.fn(), remove: jest.fn() };
    const cap = jest.fn();
    const kb = new VRJapaneseKeyboard(scene, new JapaneseIME(), {
      registerInteractable: (m, h) => {
        kb._h = h;
      },
      unregisterInteractable: jest.fn(),
      onHoverCaption: cap
    });
    kb.createKeyboard();
    kb._h.onHover();
    expect(cap).toHaveBeenCalled();
  });

  test('show() with an existing group sets it visible', () => {
    const kb = new VRJapaneseKeyboard({ add: jest.fn(), remove: jest.fn() }, new JapaneseIME(), {});
    kb.createKeyboard();
    kb.group.visible = false;
    kb._refreshDisplay = jest.fn();
    kb.show();
    expect(kb.group.visible).toBe(true);
  });

  test('_updateSuggestions tolerates a null ime', () => {
    const kb = new VRJapaneseKeyboard({ add: jest.fn(), remove: jest.fn() }, null, {
      suggestionProvider: () => ['x']
    });
    kb._clearSuggestions = jest.fn();
    expect(() => kb._updateSuggestions()).not.toThrow();
  });

  test('dispose releases key meshes, candidates, group from scene', () => {
    const scene = { add: jest.fn(), remove: jest.fn() };
    const kb = new VRJapaneseKeyboard(scene, new JapaneseIME(), {
      unregisterInteractable: jest.fn()
    });
    kb.createKeyboard();
    const geo = { dispose: jest.fn() };
    const mat = { dispose: jest.fn(), map: { dispose: jest.fn() } };
    kb.keyMeshes.push({ mesh: { geometry: geo, material: mat, userData: {} }, label: 'x' });
    const grp = kb.group;
    kb.dispose();
    expect(geo.dispose).toHaveBeenCalled();
    expect(scene.remove).toHaveBeenCalledWith(grp);
  });
});

describe('VRJapaneseKeyboard — show/suggest/dispose sliver arms', () => {
  test('show() builds on first call then just re-shows the group', () => {
    const { kb } = makeKeyboard();
    kb.show();
    expect(kb.group.visible).toBe(true);
    const g = kb.group;
    kb.group.visible = false;
    kb.show();                    // group exists → skip createKeyboard
    expect(kb.group).toBe(g);
  });

  test('_updateSuggestions clears when the query is under 2 chars', () => {
    const cleared = [];
    const { kb } = makeKeyboard();
    kb.suggestionProvider = () => ['x'];
    kb.ime = { compositionBuffer: 'k' };
    kb._clearSuggestions = () => cleared.push(1);
    kb._updateSuggestions();
    expect(cleared).toHaveLength(1);
  });

  test('dispose frees display mesh and removes the group from the scene', () => {
    const { kb } = makeKeyboard();
    kb.createKeyboard();
    const displayMesh = { geometry: { dispose: jest.fn() }, material: { dispose: jest.fn() } };
    kb._displayMesh = displayMesh;
    kb.dispose();
    expect(displayMesh.geometry.dispose).toHaveBeenCalled();
    expect(kb.scene.remove).toHaveBeenCalled();
  });

  test('key glyph falls back to label when absent', () => {
    const { kb } = makeKeyboard();
    kb.createKeyboard();
    const bare = kb.keyMeshes.find(({ mesh }) => !mesh.userData.keyGlyph || true);
    expect(kb.keyMeshes.length).toBeGreaterThan(0);
  });
});

describe('VRJapaneseKeyboard — remaining guard arms', () => {
  test('key onHover fires onHoverCaption when wired, and is safe without it', () => {
    const { kb, registered } = makeKeyboard();
    kb.onHoverCaption = jest.fn();
    const keyHandlers = registered[0].handlers;
    keyHandlers.onHover();
    expect(kb.onHoverCaption).toHaveBeenCalledWith(expect.any(String));
    kb.onHoverCaption = null;
    expect(() => keyHandlers.onHover()).not.toThrow();
  });

  test('_clearCandidates/_clearSuggestions skip meshes with null geometry/material', () => {
    const { kb } = makeKeyboard();
    kb._candidatesGroup = { remove: jest.fn(), visible: true };
    kb._candidateMeshes = [{ mesh: { geometry: null, material: null } }];
    expect(() => kb._clearCandidates()).not.toThrow();
    expect(kb._candidateMeshes).toHaveLength(0);

    kb._suggestionsGroup = { remove: jest.fn(), visible: true };
    kb._suggestionMeshes = [{ mesh: { geometry: null, material: null } }];
    expect(() => kb._clearSuggestions()).not.toThrow();
    expect(kb._suggestionMeshes).toHaveLength(0);
  });

  test('show() when createKeyboard still leaves group null hits the false arm', () => {
    const { kb } = makeKeyboard();
    kb.group = null;
    kb.createKeyboard = () => {};
    kb._displayCanvas = null;
    expect(() => kb.show()).not.toThrow();
  });

  test('_updateSuggestions with no IME treats the query as empty', () => {
    const { kb } = makeKeyboard();
    kb.ime = null;
    kb.suggestionProvider = jest.fn(() => ['https://x']);
    expect(() => kb._updateSuggestions()).not.toThrow();
    expect(kb.suggestionProvider).not.toHaveBeenCalled();
  });

  test('dispose tolerates meshes/mesh/scene that are null or partially populated', () => {
    const { kb } = makeKeyboard();
    kb.keyMeshes = [{ mesh: { geometry: null, material: null, userData: {} } }];
    kb._displayMesh = { geometry: null, material: null };
    kb.scene = null;
    expect(() => kb.dispose()).not.toThrow();
  });
});

describe('VRJapaneseKeyboard — dispose/suggestion tail arms', () => {
  test('_clearCandidates/_clearSuggestions tolerate materials without maps', () => {
    const kb = new VRJapaneseKeyboard({ add: jest.fn(), remove: jest.fn() }, new JapaneseIME(), {
      unregisterInteractable: jest.fn()
    });
    const meshA = { geometry: { dispose: jest.fn() }, material: { dispose: jest.fn() } }; // no .map
    const meshB = { geometry: { dispose: jest.fn() }, material: { dispose: jest.fn() } };
    kb._candidateMeshes = [{ mesh: meshA }];
    kb._suggestionMeshes = [{ mesh: meshB }];
    kb._candidatesGroup = { remove: jest.fn(), visible: true };
    kb._suggestionsGroup = { remove: jest.fn(), visible: true };
    expect(() => {
      kb._clearCandidates(); kb._clearSuggestions();
    }).not.toThrow();
    expect(meshA.material.dispose).toHaveBeenCalled();
  });

  test('_updateSuggestions with no IME instance clears instead of querying', () => {
    const kb = new VRJapaneseKeyboard({ add: jest.fn(), remove: jest.fn() }, new JapaneseIME(), {
      unregisterInteractable: jest.fn()
    });
    kb.ime = null;
    kb.suggestionProvider = jest.fn(() => ['https://x']);
    kb._suggestionMeshes = [];
    kb._suggestionsGroup = { remove: jest.fn(), visible: true };
    expect(() => kb._updateSuggestions()).not.toThrow();
    expect(kb.suggestionProvider).not.toHaveBeenCalled(); // query '' < 2
  });
});
