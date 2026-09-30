/**
 * Tests for the previously-unwired browser atoms:
 *   - volume-up/down commands (registered stubs that moved nothing) now drive
 *     the host's onVolume handler (master-volume stepper equivalent)
 *   - scrollContentTo/scrollToTop/scrollToBottom — Home/End atoms for the
 *     reader viewport, the only scrollable surface in VR
 *   - duplicateTab — Chrome's "Duplicate tab"; the copy inherits the source's
 *     privacy flag BEFORE navigating so a private URL can't reach history
 *   - bookmark-page voice command — hands-free Ctrl+D
 *
 * THREE and the WebPanel *class* are stubbed for TabManager tests; the real
 * WebPanel prototype is pulled via requireActual for the scroll-jump logic.
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

// ── WebPanel stub ─────────────────────────────────────────────────────────────
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
      // Records privacy at the moment navigate() ran — the ordering test for
      // duplicateTab's "flag before navigation" guarantee.
      this.navigateSawPrivate = undefined;
      panelInstances.push(this);
    }
    addToScene(parent) { this.parent = parent; }
    navigate(url) { this.navigateSawPrivate = this.isPrivate; this.currentUrl = url; }
    setVisible(v) { this.visible = !!v; }
    setCurved() {}
    scrollToTop() { this.jumpedTop = true; }
    scrollToBottom() { this.jumpedBottom = true; }
    dispose() { this.disposed = true; }
  }
}));
// The real prototype (scrollContentTo/scrollToTop/scrollToBottom) for the
// reader-jump unit tests — the class mock above doesn't apply to requireActual.
const { WebPanel: RealWebPanel } = jest.requireActual('../src/vr/browser/WebPanel.js');

// ── document/canvas stub ────────────────────────────────────────────────────────
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
const { visibleLinesFor } = require('../src/vr/browser/readerLayout.js');

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

function makeReaderPanel(lines = 100) {
  const p = Object.create(RealWebPanel.prototype);
  p._contentState = 'reader';
  p._readerLines = new Array(lines).fill({ style: 'p' });
  p._readerScale = 1;
  p._readerScroll = 0;
  p._drawContent = jest.fn();
  return p;
}

describe('WebPanel — scrollContentTo / scrollToTop / scrollToBottom', () => {
  test('scrollContentTo jumps to an absolute line offset', () => {
    const p = makeReaderPanel(100);
    p._readerScroll = 10;
    expect(p.scrollContentTo(40)).toBe(true);
    expect(p._readerScroll).toBe(40);
    expect(p._drawContent).toHaveBeenCalledTimes(1);
  });

  test('scrollToTop returns to the first line', () => {
    const p = makeReaderPanel(100);
    p._readerScroll = 50;
    expect(p.scrollToTop()).toBe(true);
    expect(p._readerScroll).toBe(0);
  });

  test('scrollToBottom lands on the last page (clamped)', () => {
    const p = makeReaderPanel(100);
    const visible = visibleLinesFor(100, 1);
    expect(p.scrollToBottom()).toBe(true);
    expect(p._readerScroll).toBe(100 - visible);
  });

  test('returns false without repainting when the target is unreachable', () => {
    const p = makeReaderPanel(100);
    p._readerScroll = 0;
    expect(p.scrollToTop()).toBe(false);   // already at top
    expect(p._drawContent).not.toHaveBeenCalled();
  });

  test('returns false outside the reader state', () => {
    const p = makeReaderPanel(100);
    p._contentState = 'loading';
    expect(p.scrollContentTo(50)).toBe(false);
    expect(p._drawContent).not.toHaveBeenCalled();
  });
});

describe('TabManager — duplicateTab', () => {
  beforeEach(() => { panelInstances.length = 0; });

  test('duplicates the active tab at its URL', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    const dup = tm.duplicateTab();
    expect(dup.currentUrl).toBe('https://a.example');
    expect(tm.count).toBe(2);
    expect(tm.getActiveTab()).toBe(dup);
  });

  test('returns null when the active tab has no URL', () => {
    const tm = makeManager();
    tm.newTab();
    expect(tm.duplicateTab()).toBeNull();
    expect(tm.count).toBe(1);
  });

  test('returns null with no tabs', () => {
    const tm = makeManager();
    expect(tm.duplicateTab()).toBeNull();
  });

  test('the copy inherits privacy BEFORE navigate — a private URL stays private', () => {
    const tm = makeManager();
    tm.setPrivateMode(true);
    tm.newTab('https://secret.example');
    tm.setPrivateMode(false); // mode flipped off after creation — stale private panel
    const dup = tm.duplicateTab();
    expect(dup.isPrivate).toBe(true);
    expect(dup.navigateSawPrivate).toBe(true);
  });
});

describe('VoiceCommands — volume, scroll jumps, duplicate, bookmark', () => {
  test('"音量アップ" fires onVolume(+0.1)', () => {
    const onVolume = jest.fn();
    const vc = makeVoice({ onVolume });
    vc.processCommand('音量アップ', 0.9);
    expect(vc.lastCommand.key).toBe('volume-up');
    expect(onVolume).toHaveBeenCalledWith(0.1);
  });

  test('"音量ダウン" fires onVolume(-0.1)', () => {
    const onVolume = jest.fn();
    const vc = makeVoice({ onVolume });
    vc.processCommand('音量ダウン', 0.9);
    expect(vc.lastCommand.key).toBe('volume-down');
    expect(onVolume).toHaveBeenCalledWith(-0.1);
  });

  test('volume commands still confirm (and do not throw) without a handler', () => {
    const vc = makeVoice({});
    expect(() => vc.processCommand('音量アップ', 0.9)).not.toThrow();
    expect(vc.lastCommand.key).toBe('volume-up');
  });

  test('"先頭へ" scrolls the active panel to the top', () => {
    const tm = makeManager();
    const panel = tm.newTab('https://a.example');
    const spy = jest.spyOn(panel, 'scrollToTop');
    const vc = makeVoice({ tabManager: tm });
    vc.processCommand('先頭へ', 0.9);
    expect(vc.lastCommand.key).toBe('scroll-top');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('"末尾へ" scrolls the active panel to the bottom', () => {
    const tm = makeManager();
    const panel = tm.newTab('https://a.example');
    const spy = jest.spyOn(panel, 'scrollToBottom');
    const vc = makeVoice({ tabManager: tm });
    vc.processCommand('末尾へ', 0.9);
    expect(vc.lastCommand.key).toBe('scroll-bottom');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('"scroll to top" (English) works too', () => {
    const tm = makeManager();
    const panel = tm.newTab('https://a.example');
    const spy = jest.spyOn(panel, 'scrollToTop');
    const vc = makeVoice({ tabManager: tm });
    vc.processCommand('scroll to top', 0.9);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('"タブを複製" duplicates the active tab', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    const vc = makeVoice({ tabManager: tm });
    vc.processCommand('タブを複製', 0.9);
    expect(vc.lastCommand.key).toBe('duplicate-tab');
    expect(tm.count).toBe(2);
    expect(tm.getActiveTab().currentUrl).toBe('https://a.example');
  });

  test('"このページをブックマーク" fires onBookmarkPage', () => {
    const onBookmarkPage = jest.fn();
    const vc = makeVoice({ onBookmarkPage });
    vc.processCommand('このページをブックマーク', 0.9);
    expect(vc.lastCommand.key).toBe('bookmark-page');
    expect(onBookmarkPage).toHaveBeenCalledTimes(1);
  });

  test('"bookmark this page" (English) fires onBookmarkPage', () => {
    const onBookmarkPage = jest.fn();
    const vc = makeVoice({ onBookmarkPage });
    vc.processCommand('bookmark this page', 0.9);
    expect(onBookmarkPage).toHaveBeenCalledTimes(1);
  });

  test('bare "ブックマーク" still toggles the panel, not bookmark-page', () => {
    const onBookmarkPage = jest.fn();
    const toggle = jest.fn();
    const vc = makeVoice({ onBookmarkPage, bookmarkPanel: { toggle } });
    vc.processCommand('ブックマーク', 0.9);
    expect(vc.lastCommand.key).toBe('bookmarks');
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(onBookmarkPage).not.toHaveBeenCalled();
  });

  test('does not throw when onBookmarkPage is not wired', () => {
    const vc = makeVoice({});
    expect(() => vc.processCommand('このページをブックマーク', 0.9)).not.toThrow();
  });
});
