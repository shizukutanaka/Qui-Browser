/**
 * Round-17 list-select atoms:
 *   - bookmark-select / history-select — open the Nth saved entry in the
 *     active tab (tab-select parity for the saved lists)
 *   - reader-goto-line — VoiceOver's go-to-line for the laid-out article
 *   - date — the NVDA Insert+F12 pair for 'time'
 */

// ── THREE + WebPanel stubs ────────────────────────────────────────────────────
jest.mock('three', () => ({
  Group: class {
    constructor() { this.position = { set: jest.fn() }; this._objects = []; }
    add(o) { this._objects.push(o); }
    remove(o) { this._objects = this._objects.filter(x => x !== o); }
    traverse(fn) { this._objects.forEach(fn); fn(this); }
  },
  Mesh: class {
    constructor() { this.position = { set: jest.fn() }; }
  },
  PlaneGeometry: class { dispose() {} },
  MeshBasicMaterial: class { dispose() {} },
  CanvasTexture: class { constructor() { this.needsUpdate = false; } dispose() {} }
}));
jest.mock('../src/vr/browser/WebPanel.js', () => ({
  WebPanel: class {
    constructor(scene, opts = {}) {
      this.currentUrl = '';
      this.isPrivate = !!opts.privateMode;
      this.pinned = false;
      this.group = { position: { set: jest.fn() } };
      this.visible = false;
    }
    addToScene(parent) { this.parent = parent; }
    navigate(url) { this.currentUrl = url; }
    setVisible(v) { this.visible = !!v; }
    setCurved() {}
    dispose() {}
  }
}));

global.document = {
  createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({
      clearRect: jest.fn(), fillRect: jest.fn(), fillText: jest.fn(),
      beginPath: jest.fn(), arc: jest.fn(), fill: jest.fn(),
      measureText: () => ({ width: 0 }),
      fillStyle: '', font: '', textAlign: '', textBaseline: ''
    })
  })
};
global.URL = URL;
global.SpeechSynthesisUtterance = function (text) { this.text = text; };

const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeSpeakingVC(extra = {}) {
  const vc = new VoiceCommands();
  vc.callbacks.onSpeak = () => {};
  vc.connectBrowser(extra);
  const spoken = [];
  vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: jest.fn() };
  vc._spoken = spoken;
  return vc;
}

// ── bookmark-select ───────────────────────────────────────────────────────────
describe('VoiceCommands bookmark-select', () => {
  test('\'ブックマーク2\' opens the second bookmark', () => {
    const onBookmarkOpen = jest.fn(() => 'Example');
    const vc = makeSpeakingVC({ onBookmarkOpen });
    vc.processCommand('ブックマーク2');
    expect(onBookmarkOpen).toHaveBeenCalledWith(2);
    expect(vc._spoken.pop()).toBe('Example');
  });

  test('\'ブックマークの3番目\' parses the numbered form', () => {
    const onBookmarkOpen = jest.fn(() => 'Entry');
    const vc = makeSpeakingVC({ onBookmarkOpen });
    vc.processCommand('ブックマークの3番目');
    expect(onBookmarkOpen).toHaveBeenCalledWith(3);
  });

  test('\'bookmark 1\' routes in English', () => {
    const onBookmarkOpen = jest.fn(() => 'First');
    const vc = makeSpeakingVC({ onBookmarkOpen });
    vc.processCommand('bookmark 1');
    expect(onBookmarkOpen).toHaveBeenCalledWith(1);
  });

  test('out-of-range announces honestly without clamping', () => {
    const vc = makeSpeakingVC({ onBookmarkOpen: () => null });
    vc.processCommand('ブックマーク9');
    expect(vc._spoken.pop()).toBe('ブックマーク9はありません');
  });

  test('\'ブックマークを開いて\' still routes to bookmarks-open', () => {
    const onBookmarkOpen = jest.fn();
    const vc = makeSpeakingVC({ onBookmarkOpen });
    vc.processCommand('ブックマークを開いて');
    expect(onBookmarkOpen).not.toHaveBeenCalled();
  });
});

// ── history-select ────────────────────────────────────────────────────────────
describe('VoiceCommands history-select', () => {
  test('\'履歴2番目\' opens the second history entry', () => {
    const onHistoryOpen = jest.fn(() => 'Page');
    const vc = makeSpeakingVC({ onHistoryOpen });
    vc.processCommand('履歴2番目');
    expect(onHistoryOpen).toHaveBeenCalledWith(2);
    expect(vc._spoken.pop()).toBe('Page');
  });

  test('\'履歴の3\' parses the numbered form', () => {
    const onHistoryOpen = jest.fn(() => 'Entry');
    const vc = makeSpeakingVC({ onHistoryOpen });
    vc.processCommand('履歴の3');
    expect(onHistoryOpen).toHaveBeenCalledWith(3);
  });

  test('\'history 4\' routes in English', () => {
    const onHistoryOpen = jest.fn(() => 'Old');
    const vc = makeSpeakingVC({ onHistoryOpen });
    vc.processCommand('history 4');
    expect(onHistoryOpen).toHaveBeenCalledWith(4);
  });

  test('out-of-range announces honestly', () => {
    const vc = makeSpeakingVC({ onHistoryOpen: () => null });
    vc.processCommand('履歴20番目');
    expect(vc._spoken.pop()).toBe('履歴20番目はありません');
  });

  test('\'履歴を開いて\' still routes to history-open', () => {
    const onHistoryOpen = jest.fn();
    const vc = makeSpeakingVC({ onHistoryOpen });
    vc.processCommand('履歴を開いて');
    expect(onHistoryOpen).not.toHaveBeenCalled();
  });
});

// ── reader-goto-line ──────────────────────────────────────────────────────────
describe('VoiceCommands reader-goto-line', () => {
  test('\'30行目へ\' jumps to line 30', () => {
    const onReaderLine = jest.fn(() => 30);
    const vc = makeSpeakingVC({ onReaderLine });
    vc.processCommand('30行目へ');
    expect(onReaderLine).toHaveBeenCalledWith(30);
    expect(vc._spoken.pop()).toBe('30行目に移動しました');
  });

  test('\'line 15\' routes in English', () => {
    const onReaderLine = jest.fn(() => 15);
    const vc = makeSpeakingVC({ onReaderLine });
    vc.processCommand('line 15');
    expect(onReaderLine).toHaveBeenCalledWith(15);
  });

  test('past the last line announces honestly', () => {
    const vc = makeSpeakingVC({ onReaderLine: () => 'out' });
    vc.processCommand('99行目へ');
    expect(vc._spoken.pop()).toBe('99行目はありません');
  });

  test('no reader open announces honestly', () => {
    const vc = makeSpeakingVC({ onReaderLine: () => null });
    vc.processCommand('5行目へ');
    expect(vc._spoken.pop()).toBe('記事を開いていません');
  });

  test('without a host hook the command answers honestly', () => {
    const vc = makeSpeakingVC();
    vc.processCommand('5行目へ');
    expect(vc._spoken.pop()).toBe('記事を開いていません');
  });
});

// ── date ──────────────────────────────────────────────────────────────────────
describe('VoiceCommands date', () => {
  test('\'今日の日付\' announces month and day', () => {
    const vc = makeSpeakingVC();
    vc.processCommand('今日の日付');
    const now = new Date();
    expect(vc._spoken.pop()).toBe(`今日は${now.getMonth() + 1}月${now.getDate()}日です`);
  });

  test('\'何月何日\' routes the same phrase', () => {
    const vc = makeSpeakingVC();
    vc.processCommand('何月何日');
    expect(vc._spoken.pop()).toMatch(/^今日は\d+月\d+日です$/);
  });
});
