/**
 * Unit tests for CaptionSystem (FR-13.1).
 * THREE and the 2D canvas are mocked so the queue/timing logic can be
 * verified headlessly.
 */

class MockGeometry { dispose() {} }
class MockMaterial { constructor(o = {}) { Object.assign(this, o); } dispose() {} }
class MockMesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.name = '';
    this.visible = true;
    this.renderOrder = 0;
    this.position = { set: jest.fn() };
  }
}
class MockCanvasTexture {
  constructor() { this.needsUpdate = false; this.colorSpace = ''; }
  dispose() {}
}

jest.mock('three', () => ({
  PlaneGeometry: MockGeometry,
  MeshBasicMaterial: MockMaterial,
  Mesh: MockMesh,
  CanvasTexture: MockCanvasTexture,
  SRGBColorSpace: 'srgb'
}));

// Canvas 2D context stub.
function makeCtx() {
  return {
    clearRect: jest.fn(), fillRect: jest.fn(), fillText: jest.fn(),
    beginPath: jest.fn(), roundRect: jest.fn(), fill: jest.fn(),
    fillStyle: '', font: '', textAlign: '', textBaseline: '', globalAlpha: 1
  };
}
global.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => makeCtx() })
};

const {
  CaptionSystem, clampCaptionOffset,
  CAPTION_OFFSET_DEFAULT, CAPTION_OFFSET_MIN, CAPTION_OFFSET_MAX
} = require('../src/vr/accessibility/CaptionSystem.js');
const { textWidthEm } = require('../src/vr/ui/textWrap.js');

function makeCamera() {
  return { add: jest.fn(), remove: jest.fn() };
}

describe('CaptionSystem (FR-13.1)', () => {
  let cam, cs;
  beforeEach(() => {
    cam = makeCamera();
    cs = new CaptionSystem(cam, { maxLines: 3, lineDuration: 1000 });
  });

  test('attaches a caption mesh to the camera, hidden initially', () => {
    expect(cam.add).toHaveBeenCalled();
    expect(cs.mesh.visible).toBe(false);
    expect(cs.enabled).toBe(false);
  });

  test('show() ignores empty / whitespace text', () => {
    cs.setEnabled(true);
    cs.show('');
    cs.show('   ');
    expect(cs.lineCount).toBe(0);
  });

  test('show() queues a caption line', () => {
    cs.setEnabled(true);
    cs.show('hello world');
    expect(cs.lineCount).toBe(1);
    expect(cs.mesh.visible).toBe(true);
  });

  test('show() normalizes NFD text to NFC so combining marks stay attached', () => {
    cs.setEnabled(true);
    const nfd = 'が'; // か + combining voiced mark = 2 code points (NFD)
    const nfc = 'が';       // precomposed が = 1 code point (NFC)
    expect(Array.from(nfd)).toHaveLength(2); // fixture really is NFD
    cs.show(nfd);
    const stored = cs._lines[cs._lines.length - 1].text;
    expect(stored).toBe(nfc);
    expect(Array.from(stored)).toHaveLength(1); // base+mark folded to one cp
  });

  test('queue is capped at maxLines (oldest dropped)', () => {
    cs.setEnabled(true);
    cs.show('one'); cs.show('two'); cs.show('three'); cs.show('four');
    expect(cs.lineCount).toBe(3);
    // 'one' should have been dropped.
    expect(cs._lines[0].text).toBe('two');
  });

  test('update() expires lines after lineDuration', () => {
    cs.setEnabled(true);
    cs.show('temporary');
    cs.update(600);  // 0.6s — still alive
    expect(cs.lineCount).toBe(1);
    cs.update(600);  // 1.2s total — expired
    expect(cs.lineCount).toBe(0);
    expect(cs.mesh.visible).toBe(false);
  });

  test('update() no-ops while disabled', () => {
    cs.setEnabled(true);
    cs.show('keep me');
    cs.setEnabled(false);   // clears
    cs.setEnabled(true);
    cs.show('keep me');
    cs.setEnabled(false);
    cs.update(99999);
    // disabled: no expiry processing, lines were cleared on disable anyway
    expect(cs.lineCount).toBe(0);
  });

  test('lines expire independently based on insertion time', () => {
    cs.setEnabled(true);
    cs.show('first');
    cs.update(500);         // first has 500ms left
    cs.show('second');      // second has full 1000ms
    cs.update(600);         // first expires (−100), second has 400ms
    expect(cs.lineCount).toBe(1);
    expect(cs._lines[0].text).toBe('second');
  });

  test('onShow fires with the normalized text on every show() call', () => {
    const onShow = jest.fn();
    const withHook = new CaptionSystem(cam, { onShow });
    withHook.show('Tab closed');
    expect(onShow).toHaveBeenCalledWith('Tab closed');
  });

  test('onShow receives NFC-normalized text, matching what is queued', () => {
    const onShow = jest.fn();
    const withHook = new CaptionSystem(cam, { onShow });
    const nfd = 'が'; // か + combining voiced sound mark
    withHook.show(nfd);
    expect(onShow).toHaveBeenCalledWith(nfd.normalize('NFC'));
  });

  test('does not throw when onShow is not provided', () => {
    expect(() => cs.show('no hook wired')).not.toThrow();
  });

  test('onShow is not called for an empty/whitespace show() (no-op path)', () => {
    const onShow = jest.fn();
    const withHook = new CaptionSystem(cam, { onShow });
    withHook.show('   ');
    expect(onShow).not.toHaveBeenCalled();
  });

  test('clear() removes all captions and hides the panel', () => {
    cs.setEnabled(true);
    cs.show('a'); cs.show('b');
    cs.clear();
    expect(cs.lineCount).toBe(0);
    expect(cs.mesh.visible).toBe(false);
  });

  test('setEnabled(false) clears the queue', () => {
    cs.setEnabled(true);
    cs.show('x');
    cs.setEnabled(false);
    expect(cs.lineCount).toBe(0);
  });

  test('long captions wrap across rows instead of being cut at one line', () => {
    cs.setEnabled(true);
    const sentence = 'the quick brown fox jumps over the lazy dog and keeps on running';
    expect(() => cs.show(sentence)).not.toThrow();
    const rows = cs._wrap(sentence, 34);
    expect(rows.length).toBeGreaterThan(1);
    rows.forEach(r => expect(r.length).toBeLessThanOrEqual(34));
    // No information lost: the words rejoin to the original.
    expect(rows.join(' ')).toBe(sentence);
  });

  test('_wrap hard-splits a word longer than a row', () => {
    const rows = cs._wrap('x'.repeat(80), 34);
    expect(rows.length).toBe(3); // 34 + 34 + 12
    rows.forEach(r => expect(r.length).toBeLessThanOrEqual(34));
    expect(rows.join('')).toBe('x'.repeat(80));
  });

  test('_wrap hard-splits spaceless Japanese without losing or corrupting characters', () => {
    // No spaces → one long "word" that hits the hard-split path on every row.
    const jp = 'これはとても長い日本語のキャプションでテキストの折り返しを確認します';
    const rows = cs._wrap(jp, 10);
    expect(rows.length).toBeGreaterThan(1);
    rows.forEach(r => expect(Array.from(r).length).toBeLessThanOrEqual(10));
    // Lossless: rejoining the rows reproduces the original exactly.
    expect(rows.join('')).toBe(jp);
  });

  test('_wrap never splits a surrogate pair at a row boundary (no mojibake)', () => {
    // 12 emoji, wrapped at 5 code points per row: boundaries fall where a
    // UTF-16 slice would have severed a surrogate pair.
    const rows = cs._wrap('😀'.repeat(12), 5);
    expect(rows.join('')).not.toContain('�'); // no replacement char
    rows.forEach(r => expect(Array.from(r).length).toBeLessThanOrEqual(5));
    expect(rows.join('')).toBe('😀'.repeat(12));
  });

  test('_truncate is code-point-aware (does not split astral chars)', () => {
    const out = cs._truncate('𠮷'.repeat(10), 4);
    expect(out).not.toContain('�');
    expect(Array.from(out)).toHaveLength(4); // 3 kanji + ellipsis
    expect(out.endsWith('…')).toBe(true);
  });

  test('_layoutRows caps a caption at two rows with an ellipsis', () => {
    cs.setEnabled(true);
    cs.show(Array(20).fill('word').join(' ')); // far more than 2 rows worth
    const laid = cs._layoutRows();
    expect(laid.length).toBe(2);
    expect(laid[1].text.endsWith('…')).toBe(true);
  });

  test('scale defaults to 1 with the baseline font cap and em measure', () => {
    expect(cs.scale).toBe(1);
    // 20 em: 20 full-width / ~40 Latin chars per row, matching Japanese
    // broadcast subtitling (~16, house styles 13–20) and Latin subtitle
    // guidance (~37–42). Not clamped at scale 1 (976px/44px = 22.2 em).
    expect(cs._measureEm()).toBe(20);
    expect(cs._fontSizeFor(1)).toBe(44); // single line → full 44px cap
  });

  test('a larger scale raises the font cap and narrows the measure (low vision)', () => {
    const big = new CaptionSystem(makeCamera(), { scale: 1.5 });
    expect(big._fontSizeFor(1)).toBe(66);              // 44 * 1.5
    // Clamped so 66px text still fits: 976px / 66px ≈ 14.8 em.
    expect(big._measureEm()).toBeCloseTo(976 / 66, 5);
    expect(big._measureEm()).toBeLessThan(cs._measureEm());
  });

  // Regression: the wrap budget used to be a fixed CHARACTER count (34), which
  // ignored that CJK is 1 em wide and Latin ~0.5 (Unicode UAX #11). At the 44px
  // single-row font that rendered 34 full-width glyphs as 1496px on a 1024px
  // canvas — 46% outside the panel. Captions are the deaf/HoH channel.
  describe('rows never exceed the panel width, in either script', () => {
    const CANVAS_W = 1024;

    function widestRowPx(system) {
      const laid = system._layoutRows();
      const font = system._fontSizeFor(laid.length);
      return Math.max(...laid.map(r => textWidthEm(r.text) * font));
    }

    test('a long Japanese caption stays inside the canvas', () => {
      cs.setEnabled(true);
      cs.show('これは非常に長い日本語の字幕です。'.repeat(4));
      expect(widestRowPx(cs)).toBeLessThanOrEqual(CANVAS_W);
    });

    test('a long Latin caption stays inside the canvas', () => {
      cs.setEnabled(true);
      cs.show('This is a fairly long English caption that must wrap. '.repeat(4));
      expect(widestRowPx(cs)).toBeLessThanOrEqual(CANVAS_W);
    });

    test('mixed Japanese/Latin stays inside the canvas', () => {
      cs.setEnabled(true);
      cs.show('WebXRの仕様はW3Cが策定しています。'.repeat(4));
      expect(widestRowPx(cs)).toBeLessThanOrEqual(CANVAS_W);
    });

    test('still fits at the 1.5 large-text scale, where the font is 66px', () => {
      const big = new CaptionSystem(makeCamera(), { scale: 1.5 });
      big.setEnabled(true);
      big.show('これは非常に長い日本語の字幕です。'.repeat(4));
      expect(widestRowPx(big)).toBeLessThanOrEqual(CANVAS_W);
    });

    test('Japanese rows land near the broadcast measure (<= 20 full-width)', () => {
      cs.setEnabled(true);
      cs.show('あ'.repeat(120));
      for (const r of cs._layoutRows()) {
        expect(Array.from(r.text).length).toBeLessThanOrEqual(21); // +1 for '…'
      }
    });
  });

  test('setScale clamps to a sane range and redraws', () => {
    expect(cs.setScale(10)).toBe(3);    // clamped up
    expect(cs.setScale(0.1)).toBe(0.5); // clamped down
    expect(cs.setScale(1.4)).toBeCloseTo(1.4, 5);
  });

  test('font never drops below the floor even when many rows stack', () => {
    const big = new CaptionSystem(makeCamera(), { scale: 1.5 });
    expect(big._fontSizeFor(6)).toBeGreaterThanOrEqual(22);
  });

  test('backing is semi-transparent by default, opaque under high contrast', () => {
    expect(cs.highContrast).toBe(false);
    expect(cs._backingStyle()).toBe('rgba(0, 0, 0, 0.55)');
    const hc = new CaptionSystem(makeCamera(), { highContrast: true });
    expect(hc._backingStyle()).toBe('rgba(0, 0, 0, 1)');
  });

  test('setHighContrast toggles the backing and redraws', () => {
    cs.setEnabled(true);
    cs.show('hi');
    expect(cs.setHighContrast(true)).toBe(true);
    expect(cs._backingStyle()).toBe('rgba(0, 0, 0, 1)');
    expect(cs.setHighContrast(0)).toBe(false); // coerced
    expect(cs._backingStyle()).toBe('rgba(0, 0, 0, 0.55)');
  });

  test('dispose() detaches the mesh from the camera', () => {
    cs.dispose();
    expect(cam.remove).toHaveBeenCalled();
    expect(cs.mesh).toBeNull();
  });

  describe('setLineDuration — WCAG 2.2.1 Timing Adjustable', () => {
    test('applies the new duration to subsequent captions', () => {
      cs.setEnabled(true);
      cs.setLineDuration(2000);
      cs.show('hello');
      cs.update(1200); // 1.2s — still alive (< 2s)
      expect(cs.lineCount).toBe(1);
      cs.update(1000); // 2.2s total — expired
      expect(cs.lineCount).toBe(0);
    });

    test('does not shorten already-queued captions (no abrupt cut)', () => {
      cs.setEnabled(true);
      cs.show('in-flight');         // queued with lineDuration=1000ms
      cs.update(800);               // 0.8s remaining
      cs.setLineDuration(2000);     // changes only FUTURE captions
      cs.update(300);               // total 1.1s — old line expires per original 1s
      expect(cs.lineCount).toBe(0);
    });

    test('clamps to [2000, 60000] ms (WCAG 2.2.1: max ≥ 10× default 5 s)', () => {
      expect(cs.setLineDuration(100)).toBe(2000);    // clamped up
      expect(cs.setLineDuration(99999)).toBe(60000); // clamped to new ceiling
      expect(cs.setLineDuration(60000)).toBe(60000); // ceiling itself is valid
      expect(cs.setLineDuration(8000)).toBe(8000);   // in range, exact
    });

    test('coerces non-numeric to 5000 fallback', () => {
      expect(cs.setLineDuration('bad')).toBe(5000);
      expect(cs.setLineDuration(null)).toBe(5000);
    });
  });

  // ── caption vertical position (XAUR customization) ──────────────────────────
  describe('setVerticalOffset — caption height customization', () => {
    test('defaults to the standard lower-FOV offset and applies it to the mesh', () => {
      expect(cs.verticalOffset).toBe(CAPTION_OFFSET_DEFAULT);
      // _buildPanel positioned the mesh at the default height.
      expect(cs.mesh.position.set).toHaveBeenCalledWith(0, CAPTION_OFFSET_DEFAULT, -2.0);
    });

    test('honours a constructor verticalOffset override (clamped)', () => {
      const cs2 = new CaptionSystem(makeCamera(), { verticalOffset: -0.4 });
      expect(cs2.verticalOffset).toBeCloseTo(-0.4, 5);
      const cs3 = new CaptionSystem(makeCamera(), { verticalOffset: 0.5 }); // above range
      expect(cs3.verticalOffset).toBe(CAPTION_OFFSET_MAX);
    });

    test('setVerticalOffset updates the stored value and the mesh y', () => {
      expect(cs.setVerticalOffset(-0.4)).toBeCloseTo(-0.4, 5);
      expect(cs.verticalOffset).toBeCloseTo(-0.4, 5);
      expect(cs.mesh.position.y).toBeCloseTo(-0.4, 5);
    });

    test('clamps to [CAPTION_OFFSET_MIN, CAPTION_OFFSET_MAX]', () => {
      expect(cs.setVerticalOffset(-5)).toBe(CAPTION_OFFSET_MIN);
      expect(cs.setVerticalOffset(5)).toBe(CAPTION_OFFSET_MAX);
    });

    test('non-finite input falls back to the default offset', () => {
      expect(cs.setVerticalOffset('nope')).toBe(CAPTION_OFFSET_DEFAULT);
      expect(cs.setVerticalOffset(NaN)).toBe(CAPTION_OFFSET_DEFAULT);
    });
  });

  describe('clampCaptionOffset (pure helper)', () => {
    test('passes through in-range values', () => {
      expect(clampCaptionOffset(-0.5)).toBeCloseTo(-0.5, 5);
    });
    test('clamps out-of-range values', () => {
      expect(clampCaptionOffset(-2)).toBe(CAPTION_OFFSET_MIN);
      expect(clampCaptionOffset(0)).toBe(CAPTION_OFFSET_MAX);
    });
    test('non-finite → default', () => {
      expect(clampCaptionOffset(undefined)).toBe(CAPTION_OFFSET_DEFAULT);
      expect(clampCaptionOffset('x')).toBe(CAPTION_OFFSET_DEFAULT);
    });
  });
});
