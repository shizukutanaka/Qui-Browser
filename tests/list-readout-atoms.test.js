/**
 * Round-18 list-readout atoms:
 *   - bookmarks-list / history-list — tabs-list parity for the saved lists
 *     (counted announce, 5-item cap with '、他N件')
 *   - copy-title — copy-url's pair for the share surface
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
      this.currentTitle = '';
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

// ── bookmarks-list ────────────────────────────────────────────────────────────
describe('VoiceCommands bookmarks-list', () => {
  test('\'ブックマーク一覧\' reads count and names', () => {
    const vc = makeSpeakingVC({
      onBookmarkList: () => ['Alpha', 'Beta', 'Gamma']
    });
    vc.processCommand('ブックマーク一覧');
    expect(vc._spoken.pop()).toBe('3個のブックマーク。Alpha、Beta、Gamma');
  });

  test('more than five entries caps with 他N件', () => {
    const vc = makeSpeakingVC({
      onBookmarkList: () => ['A', 'B', 'C', 'D', 'E', 'F', 'G']
    });
    vc.processCommand('ブックマーク一覧');
    expect(vc._spoken.pop()).toBe('7個のブックマーク。A、B、C、D、E、他2件');
  });

  test('empty list announces honestly', () => {
    const vc = makeSpeakingVC({ onBookmarkList: () => [] });
    vc.processCommand('ブックマーク一覧');
    expect(vc._spoken.pop()).toBe('ブックマークがありません');
  });

  test('\'list bookmarks\' routes in English', () => {
    const vc = makeSpeakingVC({ onBookmarkList: () => ['Only'] });
    vc.processCommand('list bookmarks');
    expect(vc._spoken.pop()).toBe('1個のブックマーク。Only');
  });

  test('\'ブックマーク\' alone still routes to the panel toggle', () => {
    const onBookmarkList = jest.fn(() => ['X']);
    const vc = makeSpeakingVC({ onBookmarkList });
    vc.processCommand('ブックマーク');
    expect(onBookmarkList).not.toHaveBeenCalled();
  });
});

// ── history-list ──────────────────────────────────────────────────────────────
describe('VoiceCommands history-list', () => {
  test('\'履歴一覧\' reads count and names', () => {
    const vc = makeSpeakingVC({
      onHistoryList: () => ['Recent', 'Older']
    });
    vc.processCommand('履歴一覧');
    expect(vc._spoken.pop()).toBe('2個の履歴。Recent、Older');
  });

  test('\'list history\' routes in English', () => {
    const vc = makeSpeakingVC({ onHistoryList: () => ['One'] });
    vc.processCommand('list history');
    expect(vc._spoken.pop()).toBe('1個の履歴。One');
  });

  test('\'履歴\' alone still routes to the panel toggle', () => {
    const onHistoryList = jest.fn(() => ['X']);
    const vc = makeSpeakingVC({ onHistoryList });
    vc.processCommand('履歴');
    expect(onHistoryList).not.toHaveBeenCalled();
  });
});

// ── copy-title ────────────────────────────────────────────────────────────────
describe('VoiceCommands copy-title', () => {
  test('\'タイトルをコピー\' copies via the hook and confirms', () => {
    const onCopyTitle = jest.fn(() => 'Example Page');
    const vc = makeSpeakingVC({ onCopyTitle });
    vc.processCommand('タイトルをコピー');
    expect(onCopyTitle).toHaveBeenCalled();
    expect(vc._spoken.pop()).toBe('タイトルをコピーしました');
  });

  test('\'copy the title\' routes in English', () => {
    const vc = makeSpeakingVC({ onCopyTitle: () => 'Page' });
    vc.processCommand('copy the title');
    expect(vc._spoken.pop()).toBe('タイトルをコピーしました');
  });

  test('no title announces honestly', () => {
    const vc = makeSpeakingVC({ onCopyTitle: () => null });
    vc.processCommand('タイトルをコピー');
    expect(vc._spoken.pop()).toBe('コピーするタイトルがありません');
  });

  test('\'URLをコピー\' still routes to copy-url, not copy-title', () => {
    const onCopyTitle = jest.fn();
    const vc = makeSpeakingVC({ onCopyTitle });
    vc.processCommand('URLをコピー');
    expect(onCopyTitle).not.toHaveBeenCalled();
  });
});
