/**
 * Round-6 atoms:
 *   - WebPanel.nextHeading/prevHeading — screen-reader heading navigation
 *     (NVDA/JAWS H / Shift+H, VoiceOver rotor) for the reader viewport
 *   - VoiceCommands: next-heading / prev-heading, copy-url (share atom via
 *     the onCopyUrl host hook), history (open the panel at the history tab)
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

// ── WebPanel stub for TabManager/voice tests ──────────────────────────────────
const panelInstances = [];
jest.mock('../src/vr/browser/WebPanel.js', () => ({
  WebPanel: class {
    constructor(opts) {
      this.opts = opts;
      this.currentUrl = '';
      this.isPrivate = !!opts.privateMode;
      this.group = { position: { set: jest.fn() } };
      this.visible = false;
      this.disposed = false;
      this.nextHeading = jest.fn(() => null);
      this.prevHeading = jest.fn(() => null);
      panelInstances.push(this);
    }
    addToScene(parent) { this.parent = parent; }
    navigate(url) { this.currentUrl = url; }
    setVisible(v) { this.visible = !!v; }
    setCurved() {}
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
global.SpeechSynthesisUtterance = function (text) { this.text = text; };

const { TabManager } = require('../src/vr/browser/TabManager.js');
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeManager(opts = {}) {
  return new TabManager({
    scene: { add: jest.fn(), remove: jest.fn() },
    registerInteractable: jest.fn(),
    unregisterInteractable: jest.fn(),
    ...opts
  });
}

function makeSpeakingVC(extra = {}) {
  const vc = new VoiceCommands();
  vc.callbacks.onSpeak = () => {};
  vc.connectBrowser(extra);
  const spoken = [];
  vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: jest.fn() };
  vc._spoken = spoken;
  return vc;
}

/** Real WebPanel.prototype bound to a reader viewport with styled lines. */
function makeReaderPanel(styles) {
  const p = Object.create(RealWebPanel.prototype);
  p._contentState = 'reader';
  p._readerTitle = '';
  p._readerLines = styles.map((style, i) => ({ style, text: `行${i}` }));
  p._readerScale = 1;
  p._readerScroll = 0;
  p._drawContent = jest.fn();
  return p;
}

// 100 lines: title at 0, headings at 30/70, rest paragraphs.
function headStyles() {
  const styles = new Array(100).fill('p');
  styles[0] = 'title';
  styles[30] = 'h';
  styles[70] = 'h';
  return styles;
}

// ── WebPanel.nextHeading / prevHeading ────────────────────────────────────────
describe('nextHeading / prevHeading', () => {
  test('jumps to the next heading past the current scroll', () => {
    const p = makeReaderPanel(headStyles());
    const r = p.nextHeading();
    expect(r).toEqual({ index: 2, total: 3 }); // title=1, first h=2
    expect(p._readerScroll).toBe(30);
  });

  test('wraps to the first heading past the last one', () => {
    const p = makeReaderPanel(headStyles());
    p._readerScroll = 90;
    const r = p.nextHeading();
    expect(r).toEqual({ index: 1, total: 3 });
    expect(p._readerScroll).toBe(0); // wrapped to the title
  });

  test('prevHeading jumps to the nearest heading above, then wraps', () => {
    const p = makeReaderPanel(headStyles());
    p._readerScroll = 50;
    const r = p.prevHeading();
    expect(r).toEqual({ index: 2, total: 3 });
    expect(p._readerScroll).toBe(30);
    const w = p.prevHeading();
    expect(w).toEqual({ index: 1, total: 3 });
    expect(p._readerScroll).toBe(0); // the title counts as heading zero
    const wrapped = p.prevHeading();
    expect(wrapped.index).toBe(3);
    expect(p._readerScroll).toBe(70);
  });

  test('returns null outside the reader state', () => {
    const p = makeReaderPanel(headStyles());
    p._contentState = 'loaded';
    expect(p.nextHeading()).toBeNull();
  });

  test('returns null when the article has no headings (title-only counts)', () => {
    const p = makeReaderPanel(new Array(50).fill('p'));
    expect(p.nextHeading()).toBeNull();
    expect(p.prevHeading()).toBeNull();
  });
});

// ── VoiceCommands: heading navigation ────────────────────────────────────────
describe('heading voice commands', () => {
  beforeEach(() => { panelInstances.length = 0; });

  test('"次の見出し" routes and announces the position', () => {
    const tm = makeManager();
    const tab = tm.newTab('https://a.example');
    tab.nextHeading = jest.fn(() => ({ index: 2, total: 5 }));
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('次の見出し');
    expect(tab.nextHeading).toHaveBeenCalledWith(1);
    expect(vc._spoken).toContain('2番目の見出し（全5）');
  });

  test('"prev heading" routes to prevHeading', () => {
    const tm = makeManager();
    const tab = tm.newTab('https://a.example');
    tab.prevHeading = jest.fn(() => ({ index: 1, total: 5 }));
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('previous heading');
    expect(tab.prevHeading).toHaveBeenCalled();
    expect(vc._spoken).toContain('1番目の見出し（全5）');
  });

  test('reports honestly when the article has no headings', () => {
    const tm = makeManager();
    const tab = tm.newTab('https://a.example');
    tab.nextHeading = jest.fn(() => null);
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('next heading');
    expect(vc._spoken).toContain('見出しがありません');
  });
});

// ── VoiceCommands: copy-url ───────────────────────────────────────────────────
describe('copy-url voice command', () => {
  test('"URLをコピー" calls the host hook and confirms', () => {
    const onCopyUrl = jest.fn(() => 'https://a.example');
    const vc = makeSpeakingVC({ onCopyUrl });
    vc.processCommand('URLをコピー');
    expect(onCopyUrl).toHaveBeenCalled();
    expect(vc._spoken).toContain('URLをコピーしました');
  });

  test('reports "nothing to copy" when the host returns null', () => {
    const vc = makeSpeakingVC({ onCopyUrl: () => null });
    vc.processCommand('copy the url');
    expect(vc._spoken).toContain('コピーするURLがありません');
  });
});

// ── VoiceCommands: history ────────────────────────────────────────────────────
describe('history voice command', () => {
  function makePanel() {
    return {
      visible: false,
      mode: 'bookmarks',
      setMode: jest.fn(function (m) { this.mode = m; }),
      show: jest.fn(function () { this.visible = true; }),
      hide: jest.fn(function () { this.visible = false; }),
      toggle: jest.fn(function () { this.visible ? this.hide() : this.show(); })
    };
  }

  test('"履歴を開いて" opens the panel at the history tab', () => {
    const bookmarkPanel = makePanel();
    const vc = makeSpeakingVC({ bookmarkPanel });
    vc.processCommand('履歴を開いて');
    expect(bookmarkPanel.setMode).toHaveBeenCalledWith('history');
    expect(bookmarkPanel.show).toHaveBeenCalled();
    expect(vc._spoken).toContain('履歴を開きます');
  });

  test('does not hide an already-open panel (open ≠ toggle)', () => {
    const bookmarkPanel = makePanel();
    bookmarkPanel.visible = true;
    const vc = makeSpeakingVC({ bookmarkPanel });
    vc.processCommand('open history');
    expect(bookmarkPanel.setMode).toHaveBeenCalledWith('history');
    expect(bookmarkPanel.show).not.toHaveBeenCalled();
  });

  test('bare "履歴" still toggles the whole panel (existing command)', () => {
    const bookmarkPanel = makePanel();
    const vc = makeSpeakingVC({ bookmarkPanel });
    vc.processCommand('履歴');
    expect(bookmarkPanel.toggle).toHaveBeenCalled();
    expect(bookmarkPanel.setMode).not.toHaveBeenCalled();
  });
});
