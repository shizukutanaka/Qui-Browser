/**
 * Round-11 reader surface atoms:
 *   - WebPanel._markFindHits — find hits tagged 'current'/'other' on the
 *     laid-out lines so _drawReader can paint Chrome's orange/yellow boxes
 *   - VoiceCommands: reader-size-up/down → onReaderScale(±0.25)  (voice-only
 *     users can resize article text — WCAG 1.4.4 — without leaving
 *     immersion for the settings panel)
 *   - VoiceCommands: speech-rate-set — numeric rate ('読み上げ速度2倍'),
 *     the value-set complement of the faster/slower ±0.25 steps
 */

// ── THREE stub ────────────────────────────────────────────────────────────────
class MockGroup {
  constructor() {
    this.position = { set: jest.fn() };
    this._objects = [];
  }
  add(o) { this._objects.push(o); }
  remove(o) { this._objects = this._objects.filter(x => x !== o); }
  traverse(fn) { this._objects.forEach(fn); fn(this); }
}
class MockMesh {
  constructor() {
    this.position = { set: jest.fn() };
  }
}
jest.mock('three', () => ({
  Group: MockGroup,
  Mesh: MockMesh,
  PlaneGeometry: class { dispose() {} },
  MeshBasicMaterial: class { dispose() {} },
  CanvasTexture: class { constructor() { this.needsUpdate = false; } dispose() {} }
}));

// ── WebPanel stub for voice-level tests ───────────────────────────────────────
jest.mock('../src/vr/browser/WebPanel.js', () => ({
  WebPanel: class {
    constructor(opts) { this.opts = opts; }
    addToScene() {}
    setCurved() {}
    dispose() {}
  }
}));
const { WebPanel: RealWebPanel } = jest.requireActual('../src/vr/browser/WebPanel.js');

global.document = {
  createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({
      clearRect: jest.fn(), fillRect: jest.fn(), fillText: jest.fn(),
      beginPath: jest.fn(), arc: jest.fn(), fill: jest.fn(),
      fillStyle: '', font: '', textAlign: '', textBaseline: ''
    })
  })
};
global.URL = URL;
global.SpeechSynthesisUtterance = function (text) { this.text = text; };

const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');
const { layoutReaderLines } = require('../src/vr/browser/readerLayout.js');

function makeSpeakingVC(extra = {}) {
  const vc = new VoiceCommands();
  vc.callbacks.onSpeak = () => {};
  vc.connectBrowser(extra);
  const spoken = [];
  vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: jest.fn() };
  vc._spoken = spoken;
  return vc;
}

/** Real WebPanel prototype in the reader state with real layout lines. */
function makeReaderPanel(blocks) {
  const p = Object.create(RealWebPanel.prototype);
  p._contentState = 'reader';
  p._readerTitle = '';
  p._readerBlocks = blocks || [
    { type: 'p', text: '林檎と蜜柑と葡萄の段落。' },
    { type: 'p', text: '蜜柑が二行目にもある。' },
    { type: 'p', text: '関係ない段落。' }
  ];
  p._readerLines = layoutReaderLines(p._readerBlocks, { title: '', scale: 1 });
  p._readerScale = 1;
  p._readerScroll = 0;
  p._findMatches = [];
  p._findIndex = -1;
  p._drawContent = jest.fn();
  return p;
}

// ── WebPanel._markFindHits ────────────────────────────────────────────────────
describe('WebPanel find-hit tagging (_markFindHits)', () => {
  test('findInReader tags the first hit current and the rest other', () => {
    const p = makeReaderPanel();
    p.findInReader('蜜柑');
    const tagged = p._readerLines.map(l => l._findHit).filter(Boolean);
    expect(tagged[0]).toBe('current');
    expect(tagged.filter(t => t === 'other').length).toBe(tagged.length - 1);
    expect(tagged.length).toBe(p._findMatches.length);
  });

  test('findNextMatch moves current to the next hit and demotes the old', () => {
    const p = makeReaderPanel();
    p.findInReader('蜜柑');
    if (p._findMatches.length < 2) return; // guard: needs 2+ hits
    p.findNextMatch();
    expect(p._readerLines[p._findMatches[0]]._findHit).toBe('other');
    expect(p._readerLines[p._findMatches[1]]._findHit).toBe('current');
  });

  test('findPrevMatch wraps current to the last hit', () => {
    const p = makeReaderPanel();
    p.findInReader('蜜柑');
    p.findPrevMatch();
    const last = p._findMatches[p._findMatches.length - 1];
    expect(p._readerLines[last]._findHit).toBe('current');
  });

  test('a new search clears stale tags from the previous one', () => {
    const p = makeReaderPanel();
    p.findInReader('蜜柑');
    const firstHitLines = p._findMatches.slice();
    p.findInReader('関係ない');
    firstHitLines.forEach((i) => {
      if (!p._findMatches.includes(i)) {
        expect(p._readerLines[i]._findHit).toBeUndefined();
      }
    });
    expect(p._readerLines[p._findMatches[0]]._findHit).toBe('current');
  });

  test('marking repaints even when the scroll offset does not move', () => {
    const p = makeReaderPanel([
      { type: 'p', text: '一行目に蜜柑。' },
      { type: 'p', text: '二行目にも蜜柑。' }
    ]);
    p._drawContent.mockClear();
    p.findInReader('蜜柑');
    expect(p._drawContent).toHaveBeenCalled();
  });
});

// ── VoiceCommands reader-size ─────────────────────────────────────────────────
describe('VoiceCommands reader-size commands', () => {
  test('\'記事の文字を大きく\' steps the hook +0.25 and announces the new scale', () => {
    const onReaderScale = jest.fn(() => 1.25);
    const vc = makeSpeakingVC({ onReaderScale });
    vc.processCommand('記事の文字を大きく');
    expect(onReaderScale).toHaveBeenCalledWith(0.25);
    expect(vc._spoken.pop()).toBe('記事の文字サイズ 1.25倍');
  });

  test('\'記事の文字を小さく\' steps the hook -0.25', () => {
    const onReaderScale = jest.fn(() => 0.75);
    const vc = makeSpeakingVC({ onReaderScale });
    vc.processCommand('記事の文字を小さく');
    expect(onReaderScale).toHaveBeenCalledWith(-0.25);
    expect(vc._spoken.pop()).toBe('記事の文字サイズ 0.75倍');
  });

  test('at the ceiling the command announces it honestly', () => {
    const vc = makeSpeakingVC({ onReaderScale: () => null });
    vc.processCommand('記事の文字を大きく');
    expect(vc._spoken.pop()).toBe('記事の文字はこれ以上大きくできません');
    vc.processCommand('記事の文字を小さく');
    expect(vc._spoken.pop()).toBe('記事の文字はこれ以上小さくできません');
  });

  test('without a host hook the command still answers honestly', () => {
    const vc = makeSpeakingVC();
    vc.processCommand('記事の文字を大きく');
    expect(vc._spoken.pop()).toBe('記事の文字はこれ以上大きくできません');
  });

  test('English phrase routes to reader-size-up', () => {
    const onReaderScale = jest.fn(() => 1.5);
    const vc = makeSpeakingVC({ onReaderScale });
    vc.processCommand('larger article text');
    expect(onReaderScale).toHaveBeenCalledWith(0.25);
  });

  test('\'キャプションを大きく\' still routes to caption-size, not reader-size', () => {
    const onReaderScale = jest.fn(() => 1.25);
    const onCaptionScale = jest.fn(() => 1.25);
    const vc = makeSpeakingVC({ onReaderScale, onCaptionScale });
    vc.processCommand('キャプションを大きく');
    expect(onCaptionScale).toHaveBeenCalled();
    expect(onReaderScale).not.toHaveBeenCalled();
  });
});

// ── VoiceCommands speech-rate-set ─────────────────────────────────────────────
describe('VoiceCommands speech-rate-set', () => {
  test('\'読み上げ速度2倍\' lands the rate directly', () => {
    const vc = makeSpeakingVC();
    vc.processCommand('読み上げ速度2倍');
    expect(vc._speechRate).toBe(2.0);
    expect(vc._spoken.pop()).toBe('読み上げ速度 2.00倍');
  });

  test('below-floor values clamp to 0.5', () => {
    const vc = makeSpeakingVC();
    vc.processCommand('読み上げ速度0.1倍');
    expect(vc._speechRate).toBe(0.5);
  });

  test('above-ceiling values clamp to 3.0', () => {
    const vc = makeSpeakingVC();
    vc.processCommand('読み上げ速度4倍');
    expect(vc._speechRate).toBe(3.0);
  });

  test('English "speech rate to 1.5" routes the same way', () => {
    const vc = makeSpeakingVC();
    vc.processCommand('speech rate to 1.5');
    expect(vc._speechRate).toBe(1.5);
  });

  test('\'読み上げを速く\' still steps relatively (registration order)', () => {
    const vc = makeSpeakingVC();
    vc.setSpeechRate(1.0);
    vc.processCommand('読み上げを速く');
    expect(vc._speechRate).toBe(1.25);
  });
});
