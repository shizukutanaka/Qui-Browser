/**
 * Round-5 control atoms:
 *   - WebPanel.findInReader/findNextMatch/findPrevMatch — Ctrl+F / Ctrl+G for
 *     the reader viewport
 *   - TabManager.closeOtherTabs/closeTabsToRight — Chrome tab-strip bulk
 *     closes routed through closeTab's closed-stack rules
 *   - VoiceCommands: find-in-page / find-next / find-prev, video-toggle /
 *     video-stop host hooks, close-other-tabs / close-tabs-right
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

// ── WebPanel stub for TabManager tests ────────────────────────────────────────
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
      this.findInReader = jest.fn(() => 0);
      this.findNextMatch = jest.fn(() => null);
      this.findPrevMatch = jest.fn(() => null);
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
const { layoutReaderLines } = require('../src/vr/browser/readerLayout.js');

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

function makeSpeakingVC(extra = {}) {
  const vc = makeVoice(extra);
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

// ── WebPanel.findInReader ─────────────────────────────────────────────────────
describe('WebPanel.findInReader', () => {
  test('counts matching lines, jumps scroll to the first hit', () => {
    const p = makeReaderPanel();
    const count = p.findInReader('蜜柑');
    const expected = p._readerLines.filter(l => l.text && l.text.includes('蜜柑')).length;
    expect(count).toBe(expected);
    expect(count).toBeGreaterThan(0);
    expect(p._readerScroll).toBe(p._findMatches[0]);
  });

  test('is case-insensitive for latin text', () => {
    const p = makeReaderPanel([
      { type: 'p', text: 'Hello World and HELLO again.' }
    ]);
    expect(p.findInReader('hello')).toBeGreaterThanOrEqual(1);
  });

  test('returns 0 and leaves scroll alone outside the reader state', () => {
    const p = makeReaderPanel();
    p._contentState = 'loaded';
    p._readerScroll = 5;
    expect(p.findInReader('蜜柑')).toBe(0);
    expect(p._readerScroll).toBe(5);
    expect(p._findMatches).toEqual([]);
  });

  test('a second search resets the match list', () => {
    const p = makeReaderPanel();
    p.findInReader('蜜柑');
    expect(p._findMatches.length).toBeGreaterThan(0);
    expect(p.findInReader('存在しない語')).toBe(0);
    expect(p._findMatches).toEqual([]);
    expect(p._findIndex).toBe(-1);
  });
});

// ── findNextMatch / findPrevMatch ────────────────────────────────────────────
describe('findNextMatch / findPrevMatch', () => {
  test('cycles through matches and wraps forward', () => {
    // Synthetic lines taller than one viewport: real content that fits the
    // page clamps every scroll offset to 0, leaving jumps unobservable.
    const p = makeReaderPanel();
    p._readerLines = Array.from({ length: 100 }, (_, i) => ({
      style: 'p', text: (i === 30 || i === 70) ? '蜜柑の行' : `段落${i}`
    }));
    const total = p.findInReader('蜜柑');
    expect(total).toBe(2);
    expect(p._readerScroll).toBe(30);
    const first = p.findNextMatch();
    expect(first).toEqual({ index: 2, total: 2 });
    expect(p._readerScroll).toBe(70);
    const wrapped = p.findNextMatch();
    expect(wrapped.index).toBe(1); // wrapped to first
    expect(p._readerScroll).toBe(30);
  });

  test('findPrevMatch wraps backwards', () => {
    const p = makeReaderPanel();
    p._readerLines = Array.from({ length: 100 }, (_, i) => ({
      style: 'p', text: (i === 30 || i === 70) ? '蜜柑の行' : `段落${i}`
    }));
    const total = p.findInReader('蜜柑');
    const r = p.findPrevMatch();
    expect(r).toEqual({ index: total, total });
    expect(p._readerScroll).toBe(70);
  });

  test('returns null with no active search', () => {
    const p = makeReaderPanel();
    expect(p.findNextMatch()).toBeNull();
    expect(p.findPrevMatch()).toBeNull();
  });
});

// ── TabManager bulk closes ────────────────────────────────────────────────────
describe('TabManager bulk close atoms', () => {
  beforeEach(() => { panelInstances.length = 0; });

  test('closeOtherTabs keeps the active tab and disposes the rest', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    const keep = tm.newTab('https://b.example');
    tm.newTab('https://c.example');
    tm.setActive(1);
    expect(tm.closeOtherTabs()).toBe(2);
    expect(tm.tabs).toEqual([keep]);
    expect(tm.activeIndex).toBe(0);
    expect(keep.disposed).toBe(false);
  });

  test('closeOtherTabs records closable URLs on the reopen stack', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    tm.newTab('https://b.example');
    tm.setActive(1);
    tm.closeOtherTabs();
    expect(tm._closedStack).toEqual(['https://a.example']);
  });

  test('closeTabsToRight leaves tabs at and left of the active index', () => {
    const tm = makeManager();
    const a = tm.newTab('https://a.example');
    const b = tm.newTab('https://b.example');
    const c = tm.newTab('https://c.example');
    tm.newTab('https://d.example');
    tm.setActive(1);
    expect(tm.closeTabsToRight()).toBe(2);
    expect(tm.tabs).toEqual([a, b]);
    expect(c.disposed).toBe(true);
  });

  test('both are no-ops returning 0 with no active tab', () => {
    const tm = makeManager();
    expect(tm.closeOtherTabs()).toBe(0);
    expect(tm.closeTabsToRight()).toBe(0);
  });
});

// ── VoiceCommands: find ───────────────────────────────────────────────────────
describe('find-in-page voice commands', () => {
  beforeEach(() => { panelInstances.length = 0; });

  test('"find 蜜柑" extracts the query and announces the count', () => {
    const tm = makeManager();
    const tab = tm.newTab('https://a.example');
    tab.findInReader = jest.fn(() => 3);
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('find 蜜柑');
    expect(tab.findInReader).toHaveBeenCalledWith('蜜柑');
    expect(vc._spoken).toContain('3件見つかりました');
  });

  test('"蜜柑を探して" uses the Japanese capture', () => {
    const tm = makeManager();
    const tab = tm.newTab('https://a.example');
    tab.findInReader = jest.fn(() => 0);
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('蜜柑を探して');
    expect(tab.findInReader).toHaveBeenCalledWith('蜜柑');
    expect(vc._spoken).toContain('見つかりませんでした');
  });

  test('bare "ページ内検索" prompts for a query instead of searching', () => {
    const tm = makeManager();
    const tab = tm.newTab('https://a.example');
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('ページ内検索');
    expect(tab.findInReader).not.toHaveBeenCalled();
    expect(vc._spoken).toContain('検索する語を言ってください');
  });

  test('find-next/find-prev announce the 1-based position', () => {
    const tm = makeManager();
    const tab = tm.newTab('https://a.example');
    tab.findNextMatch = jest.fn(() => ({ index: 2, total: 5 }));
    tab.findPrevMatch = jest.fn(() => null);
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('find next');
    expect(tab.findNextMatch).toHaveBeenCalled();
    expect(vc._spoken).toContain('2/5件目');
    vc.processCommand('前を探して');
    expect(tab.findPrevMatch).toHaveBeenCalled();
    expect(vc._spoken[vc._spoken.length - 1]).toBe('見つかりませんでした');
  });
});

// ── VoiceCommands: immersive video ───────────────────────────────────────────
describe('immersive video voice commands', () => {
  test('video-toggle pauses and announces honestly', () => {
    const onVideoToggle = jest.fn(() => 'paused');
    const vc = makeSpeakingVC({ onVideoToggle });
    vc.processCommand('一時停止');
    expect(onVideoToggle).toHaveBeenCalled();
    expect(vc._spoken).toContain('一時停止します');
  });

  test('video-toggle resumes', () => {
    const vc = makeSpeakingVC({ onVideoToggle: () => 'playing' });
    vc.processCommand('resume video');
    expect(vc._spoken).toContain('再生を再開します');
  });

  test('video-toggle reports no active video instead of a false confirm', () => {
    const vc = makeSpeakingVC({ onVideoToggle: () => null });
    vc.processCommand('pause video');
    expect(vc._spoken).toContain('再生中の動画がありません');
  });

  test('video-stop stops and reports; absent video reports nothing playing', () => {
    const vc = makeSpeakingVC({ onVideoStop: () => true });
    vc.processCommand('動画を止めて');
    expect(vc._spoken).toContain('動画を停止します');
    const vc2 = makeSpeakingVC({ onVideoStop: () => false });
    vc2.processCommand('stop the video');
    expect(vc2._spoken).toContain('再生中の動画がありません');
  });
});

// ── VoiceCommands: bulk closes ────────────────────────────────────────────────
describe('bulk close voice commands', () => {
  test('"他のタブを閉じて" routes to closeOtherTabs', () => {
    const tm = makeManager();
    tm.closeOtherTabs = jest.fn(() => 2);
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('他のタブを閉じて');
    expect(tm.closeOtherTabs).toHaveBeenCalled();
    expect(vc._spoken).toContain('他のタブを閉じます');
  });

  test('"close tabs to the right" routes to closeTabsToRight', () => {
    const tm = makeManager();
    tm.closeTabsToRight = jest.fn(() => 1);
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('close tabs to the right');
    expect(tm.closeTabsToRight).toHaveBeenCalled();
    expect(vc._spoken).toContain('右側のタブを閉じます');
  });
});
