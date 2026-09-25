/**
 * Reader accessibility pack:
 *   - narrationChunks — pure utterance chunker behind read-aloud (Edge "Read
 *     Aloud" / Safari "Listen to Page")
 *   - WebPanel.setReaderScale — live WCAG 1.4.4 resize-text for the reader
 *   - WebPanel.scrollContentPage — Page Up/Down, the reader arrow's jump
 *   - VoiceCommands: read-aloud / stop-reading / next-page / prev-page, the
 *     caption:false speak() opt-out, and stopSpeaking()
 *   - TabManager.setReaderScale — applies to open tabs and future tabs
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
    this.name = '';
    this.position = { set: jest.fn() };
  }
  worldToLocal(v) { return v; }
}
jest.mock('three', () => ({
  Group: MockGroup,
  Mesh: MockMesh,
  PlaneGeometry: class { dispose() {} },
  MeshBasicMaterial: class { dispose() {} },
  CanvasTexture: class { constructor() { this.needsUpdate = false; } dispose() {} }
}));

// ── WebPanel stub (records readerScale + setReaderScale calls) ─────────────────
const panelInstances = [];
jest.mock('../src/vr/browser/WebPanel.js', () => ({
  WebPanel: class {
    constructor(opts) {
      this.opts = opts;
      this.currentUrl = '';
      this.isPrivate = !!opts.privateMode;
      this.readerScale = opts.readerScale;
      this.setReaderScale = jest.fn(function(v) { this.readerScale = v; });
      this.group = { position: { set: jest.fn() } };
      this.visible = false;
      this.disposed = false;
      panelInstances.push(this);
    }
    addToScene(parent) { this.parent = parent; }
    navigate(url) { this.currentUrl = url; }
    setVisible(v) { this.visible = !!v; }
    setCurved() {}
    scrollContentPage(d) { this.pageDelta = d; }
    dispose() { this.disposed = true; }
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

const { TabManager } = require('../src/vr/browser/TabManager.js');
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');
const { narrationChunks, NARRATION_CHUNK_MAX } = require('../src/vr/browser/readerNarration.js');
const { layoutReaderLines, visibleLinesFor, pageJumpLines } = require('../src/vr/browser/readerLayout.js');

function makeManager(opts = {}) {
  return new TabManager({
    scene: { add: jest.fn(), remove: jest.fn() },
    registerInteractable: jest.fn(),
    unregisterInteractable: jest.fn(),
    ...opts
  });
}

function makeVoice(extra = {}) {
  const vc = new VoiceCommands();
  vc.callbacks.onSpeak = () => {};
  vc.connectBrowser(extra);
  return vc;
}

function makeReaderPanel(blocks = null, fakeLines = null) {
  const p = Object.create(RealWebPanel.prototype);
  p._contentState = 'reader';
  p._readerTitle = '記事タイトル';
  p._readerBlocks = blocks || [
    { type: 'p', text: '一つ目の段落です。' },
    { type: 'p', text: '二つ目の段落です。' }
  ];
  p._readerLines = Number.isInteger(fakeLines)
    ? new Array(fakeLines).fill({ style: 'p' })
    : layoutReaderLines(p._readerBlocks, { title: p._readerTitle, scale: 1 });
  p._readerScale = 1;
  p._readerScroll = 0;
  p._drawContent = jest.fn();
  return p;
}

function makeSpeakingVC(extra = {}) {
  const vc = makeVoice(extra);
  const spoken = [];
  vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: jest.fn() };
  vc._spoken = spoken;
  return vc;
}

// ── narrationChunks ───────────────────────────────────────────────────────────
describe('narrationChunks', () => {
  test('speaks the title first, then blocks in order', () => {
    const chunks = narrationChunks('Title', [
      { type: 'p', text: 'First paragraph.' },
      { type: 'p', text: 'Second paragraph.' }
    ]);
    expect(chunks[0]).toContain('Title');
    expect(chunks.indexOf(chunks.find(c => c.includes('First'))))
      .toBeLessThan(chunks.indexOf(chunks.find(c => c.includes('Second'))));
  });

  test('skips blank and malformed blocks', () => {
    const chunks = narrationChunks('', [
      null, { type: 'p', text: '' }, { type: 'p' },
      { type: 'p', text: 'Real text.' }
    ]);
    expect(chunks).toEqual(['Real text.']);
  });

  test('returns [] for empty input', () => {
    expect(narrationChunks('', [])).toEqual([]);
    expect(narrationChunks(null, null)).toEqual([]);
  });

  test('paragraph boundaries always break chunks', () => {
    const chunks = narrationChunks('T', [
      { type: 'p', text: 'Short one.' },
      { type: 'p', text: 'Short two.' }
    ], 400);
    expect(chunks).toEqual(['T', 'Short one.', 'Short two.']);
  });

  test('long paragraphs split at sentence boundaries under maxLen', () => {
    const s1 = 'あ'.repeat(120) + '。';
    const s2 = 'い'.repeat(120) + '。';
    const chunks = narrationChunks(null, [{ type: 'p', text: s1 + s2 }], 200);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toContain('あ');
    expect(chunks[1]).toContain('い');
    chunks.forEach(c => expect([...c].length).toBeLessThanOrEqual(200));
  });

  test('a sentence longer than maxLen hard-splits without severing a surrogate pair', () => {
    // 150 CJK + one emoji + tail — the split boundary lands inside the emoji
    // region for the naive slice; code-point splitting must keep it intact.
    const text = 'あ'.repeat(150) + '😀' + 'い'.repeat(49);
    const chunks = narrationChunks(null, [{ type: 'p', text }], 100);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    const joined = chunks.join('');
    expect(joined).toContain('😀');
    // No lone surrogates: a high surrogate never ends a chunk and a low
    // surrogate never starts one.
    chunks.forEach(c => {
      expect(c.match(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)).toBeNull();
      expect(c.match(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/)).toBeNull();
      expect([...c].length).toBeLessThanOrEqual(100);
    });
  });

  test('respects a custom maxLen', () => {
    const chunks = narrationChunks('T', [{ type: 'p', text: 'word '.repeat(60) }], 50);
    chunks.forEach(c => expect([...c].length).toBeLessThanOrEqual(50));
    expect(chunks.length).toBeGreaterThan(2);
  });
});

// ── WebPanel: scrollContentPage / setReaderScale / getReaderNarration ──────────
describe('WebPanel — reader a11y methods', () => {
  test('scrollContentPage moves one page-jump of lines', () => {
    const p = makeReaderPanel(null, 100);
    const visible = visibleLinesFor(100, 1);
    expect(p.scrollContentPage(1)).toBe(true);
    expect(p._readerScroll).toBe(pageJumpLines(visible));
    expect(p.scrollContentPage(-1)).toBe(true);
    expect(p._readerScroll).toBe(0);
  });

  test('scrollContentPage is a no-op outside the reader state', () => {
    const p = makeReaderPanel(null, 100);
    p._contentState = 'loading';
    expect(p.scrollContentPage(1)).toBe(false);
    expect(p._drawContent).not.toHaveBeenCalled();
  });

  test('setReaderScale re-lays-out and repaints the open article', () => {
    const longPara = { type: 'p', text: 'あ'.repeat(300) };
    const p = makeReaderPanel([longPara]);
    const before = p._readerLines.length;
    expect(p.setReaderScale(2)).toBe(true);
    expect(p._readerScale).toBe(2);
    expect(p._readerLines.length).toBeGreaterThan(before); // bigger glyphs wrap sooner
    expect(p._drawContent).toHaveBeenCalledTimes(1);
  });

  test('setReaderScale clamps a now-out-of-range scroll offset', () => {
    const p = makeReaderPanel(null, 60);
    p._readerScroll = 55;
    p.setReaderScale(2);
    const visible = visibleLinesFor(p._readerLines.length, 2);
    expect(p._readerScroll).toBeLessThanOrEqual(Math.max(0, p._readerLines.length - visible));
  });

  test('setReaderScale outside the reader sets the scale but does not repaint', () => {
    const p = makeReaderPanel(null, 60);
    p._contentState = 'loading';
    expect(p.setReaderScale(1.5)).toBe(true);
    expect(p._readerScale).toBe(1.5);
    expect(p._drawContent).not.toHaveBeenCalled();
  });

  test('setReaderScale returns false for the same value and normalizes invalid input', () => {
    const p = makeReaderPanel(null, 60);
    expect(p.setReaderScale(1)).toBe(false);
    p.setReaderScale(0);
    expect(p._readerScale).toBe(1);
    p.setReaderScale(NaN);
    expect(p._readerScale).toBe(1);
  });

  test('getReaderNarration returns chunks in reader state, [] otherwise', () => {
    const p = makeReaderPanel();
    const chunks = p.getReaderNarration();
    expect(chunks.length).toBeGreaterThanOrEqual(3); // title + 2 paragraphs
    expect(chunks[0]).toContain('記事タイトル');
    p._contentState = 'loading';
    expect(p.getReaderNarration()).toEqual([]);
  });
});

// ── TabManager.setReaderScale ─────────────────────────────────────────────────
describe('TabManager — setReaderScale', () => {
  beforeEach(() => { panelInstances.length = 0; });

  test('applies to every open tab and is inherited by new tabs', () => {
    const tm = makeManager();
    const a = tm.newTab('https://a.example');
    const b = tm.newTab('https://b.example');
    tm.setReaderScale(1.5);
    expect(a.setReaderScale).toHaveBeenCalledWith(1.5);
    expect(b.setReaderScale).toHaveBeenCalledWith(1.5);
    const c = tm.newTab('https://c.example');
    expect(c.readerScale).toBe(1.5);
  });

  test('normalizes invalid scale to 1', () => {
    const tm = makeManager();
    const a = tm.newTab('https://a.example');
    tm.setReaderScale(-3);
    expect(a.setReaderScale).toHaveBeenCalledWith(1);
  });
});

// ── VoiceCommands: read-aloud / stop-reading / page jumps ────────────────────
describe('VoiceCommands — narration and paging', () => {
  const origSSU = global.SpeechSynthesisUtterance;
  beforeAll(() => {
    global.SpeechSynthesisUtterance = function(text) { this.text = text; };
  });
  afterAll(() => { global.SpeechSynthesisUtterance = origSSU; });

  test('"読み上げて" announces the start, then queues every chunk uncaptioned', () => {
    const onReadAloud = jest.fn(() => ['段落一です。', '段落二です。']);
    const captions = [];
    const vc = makeVoice({ onReadAloud });
    vc.callbacks.onSpeak = (t) => captions.push(t);
    const spoken = [];
    vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: jest.fn() };
    vc.processCommand('読み上げて', 0.9);
    expect(vc.lastCommand.key).toBe('read-aloud');
    expect(onReadAloud).toHaveBeenCalledTimes(1);
    expect(spoken[0]).toBe('読み上げを開始します');
    expect(spoken.slice(1)).toEqual(['段落一です。', '段落二です。']);
    // Only the status mirrors to captions — the article chunks don't flood it.
    expect(captions).toEqual(['読み上げを開始します']);
  });

  test('read-aloud with nothing to read announces that instead', () => {
    const vc = makeSpeakingVC({ onReadAloud: () => null });
    vc.processCommand('読み上げて', 0.9);
    expect(vc.lastCommand.key).toBe('read-aloud');
    expect(vc._spoken).toEqual(['読み上げられる文章がありません']);
  });

  test('"read this page aloud" (English) routes to read-aloud', () => {
    const onReadAloud = jest.fn(() => ['chunk']);
    const vc = makeSpeakingVC({ onReadAloud });
    vc.processCommand('read this page aloud', 0.9);
    expect(vc.lastCommand.key).toBe('read-aloud');
    expect(onReadAloud).toHaveBeenCalled();
  });

  test('a second read-aloud cancels the previous narration first', () => {
    const cancel = jest.fn();
    const vc = makeVoice({ onReadAloud: () => ['x'] });
    vc.synthesis = { speak: jest.fn(), cancel };
    vc.processCommand('read aloud', 0.9);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  test('"読み上げ停止" cancels synthesis and confirms', () => {
    const cancel = jest.fn();
    const vc = makeVoice({});
    vc.synthesis = { speak: jest.fn(), cancel };
    vc.processCommand('読み上げ停止', 0.9);
    expect(vc.lastCommand.key).toBe('stop-reading');
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  test('"次のページ" scrolls the active reader one page down', () => {
    const tm = makeManager();
    const panel = tm.newTab('https://a.example');
    const spy = jest.spyOn(panel, 'scrollContentPage');
    const vc = makeVoice({ tabManager: tm });
    vc.processCommand('次のページ', 0.9);
    expect(vc.lastCommand.key).toBe('next-page');
    expect(spy).toHaveBeenCalledWith(1);
  });

  test('"前のページ" scrolls one page up', () => {
    const tm = makeManager();
    const panel = tm.newTab('https://a.example');
    const spy = jest.spyOn(panel, 'scrollContentPage');
    const vc = makeVoice({ tabManager: tm });
    vc.processCommand('前のページ', 0.9);
    expect(vc.lastCommand.key).toBe('prev-page');
    expect(spy).toHaveBeenCalledWith(-1);
  });

  test('"ページダウン" also routes to next-page (and "page up" to prev-page)', () => {
    const tm = makeManager();
    const panel = tm.newTab('https://a.example');
    const spy = jest.spyOn(panel, 'scrollContentPage');
    const vc = makeVoice({ tabManager: tm });
    vc.processCommand('ページダウン', 0.9);
    vc.processCommand('page up', 0.9);
    expect(spy).toHaveBeenNthCalledWith(1, 1);
    expect(spy).toHaveBeenNthCalledWith(2, -1);
  });
});
