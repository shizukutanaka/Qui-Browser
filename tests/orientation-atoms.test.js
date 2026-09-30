/**
 * Round-7 orientation atoms — screen-reader parity for "what just happened
 * / where am I / what's open":
 *   - WebPanel.describeLocation — title + reader position announce
 *   - VoiceCommands: say-again (NVDA Insert+T), where-am-i, tabs-list
 *   - speak() records _lastSpoken so say-again replays without TTS state
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
      this.currentTitle = '';
      this.isPrivate = !!opts.privateMode;
      this.group = { position: { set: jest.fn() } };
      this.visible = false;
      this.disposed = false;
      this.describeLocation = jest.fn(() => '');
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

function makeReaderPanel(lines, scroll = 0) {
  const p = Object.create(RealWebPanel.prototype);
  p._contentState = 'reader';
  p.currentTitle = '記事タイトル';
  p.currentUrl = 'https://a.example/article';
  p._readerTitle = '記事タイトル';
  p._readerLines = lines;
  p._readerScale = 1;
  p._readerScroll = scroll;
  p._drawContent = jest.fn();
  return p;
}

// ── WebPanel.describeLocation ─────────────────────────────────────────────────
describe('describeLocation', () => {
  test('announces "nothing open" for an empty panel', () => {
    const p = Object.create(RealWebPanel.prototype);
    p.currentTitle = '';
    p.currentUrl = '';
    expect(p.describeLocation()).toBe('何も開いていません');
  });

  test('announces the title for a non-reader page', () => {
    const p = Object.create(RealWebPanel.prototype);
    p.currentTitle = 'Example Site';
    p._contentState = 'loaded';
    p._readerLines = [];
    expect(p.describeLocation()).toBe('Example Site');
  });

  test('announces title plus current line range in a tall article', () => {
    const lines = new Array(100).fill({ style: 'p', text: 'x' });
    const p = makeReaderPanel(lines, 30);
    const s = p.describeLocation();
    expect(s).toContain('記事タイトル');
    expect(s).toMatch(/現在 \d+–\d+\/100 行目/);
  });

  test('announces "全文表示中" when the whole article fits the viewport', () => {
    const p = makeReaderPanel(new Array(5).fill({ style: 'p', text: 'x' }));
    expect(p.describeLocation()).toContain('全文表示中');
  });
});

// ── VoiceCommands: say-again ──────────────────────────────────────────────────
describe('say-again voice command', () => {
  test('"もう一度" replays the last spoken message', () => {
    const tm = makeManager();
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('トップサイト'); // speaks 'よく使うサイトを開きます'
    vc.processCommand('もう一度');
    expect(vc._spoken[vc._spoken.length - 1]).toBe('よく使うサイトを開きます');
  });

  test('reports honestly when nothing has been spoken yet', () => {
    const vc = makeSpeakingVC({});
    vc.processCommand('say again');
    expect(vc._spoken).toContain('直前の発話がありません');
  });

  test('the repeat itself becomes repeatable', () => {
    const tm = makeManager();
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('トップサイト');
    vc.processCommand('もう一度');
    vc.processCommand('もう一度');
    expect(vc._spoken.filter(t => t === 'よく使うサイトを開きます').length).toBe(3);
  });
});

// ── VoiceCommands: where-am-i ─────────────────────────────────────────────────
describe('where-am-i voice command', () => {
  beforeEach(() => { panelInstances.length = 0; });

  test('"どこ" speaks the tab describeLocation', () => {
    const tm = makeManager();
    const tab = tm.newTab('https://a.example');
    tab.describeLocation = jest.fn(() => '記事タイトル。現在 31–50/100 行目');
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('どこ');
    expect(tab.describeLocation).toHaveBeenCalled();
    expect(vc._spoken).toContain('記事タイトル。現在 31–50/100 行目');
  });

  test('"where am i" falls back to the title when describeLocation is absent', () => {
    const tm = makeManager();
    const tab = tm.newTab('https://a.example');
    tab.describeLocation = undefined;
    tab.currentTitle = 'Example Site';
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('where am i');
    expect(vc._spoken).toContain('Example Site');
  });

  test('announces "no tabs" when none are open', () => {
    const tm = makeManager();
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('どこ');
    expect(vc._spoken).toContain('タブがありません');
  });
});

// ── VoiceCommands: tabs-list ─────────────────────────────────────────────────
describe('tabs-list voice command', () => {
  beforeEach(() => { panelInstances.length = 0; });

  test('reads the count and titles with the active one marked', () => {
    const tm = makeManager();
    const a = tm.newTab('https://a.example');
    const b = tm.newTab('https://b.example');
    a.currentTitle = 'Aページ';
    b.currentTitle = 'Bページ';
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('タブ一覧');
    const s = vc._spoken[vc._spoken.length - 1];
    expect(s).toContain('2個のタブ');
    expect(s).toContain('Aページ');
    expect(s).toContain('Bページ（表示中）');
  });

  test('"list tabs" works in English too', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('list tabs');
    expect(vc._spoken[vc._spoken.length - 1]).toContain('1個のタブ');
  });

  test('announces "no tabs" when none are open', () => {
    const tm = makeManager();
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('タブ一覧');
    expect(vc._spoken).toContain('タブがありません');
  });
});
