/**
 * Round-16 panel/seek atoms:
 *   - video-seek — YouTube J/L parity: ±10s voice seeks, numeric 'N秒戻る/進む'
 *   - settings-toggle — faceB/menu button's voice equivalent (open/close/toggle)
 *   - close-all-tabs — Chrome's "Close all tabs"; pinned tabs survive the sweep
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

// ── video-seek ────────────────────────────────────────────────────────────────
describe('VoiceCommands video-seek', () => {
  test('\'10秒戻る\' seeks back 10 seconds', () => {
    const onVideoSeek = jest.fn(() => 50);
    const vc = makeSpeakingVC({ onVideoSeek });
    vc.processCommand('10秒戻る');
    expect(onVideoSeek).toHaveBeenCalledWith(-10);
    expect(vc._spoken.pop()).toBe('10秒戻りました');
  });

  test('\'30秒進む\' seeks forward 30 seconds', () => {
    const onVideoSeek = jest.fn(() => 90);
    const vc = makeSpeakingVC({ onVideoSeek });
    vc.processCommand('30秒進む');
    expect(onVideoSeek).toHaveBeenCalledWith(30);
    expect(vc._spoken.pop()).toBe('30秒進みました');
  });

  test('\'動画を戻して\' uses the 10-second step', () => {
    const onVideoSeek = jest.fn(() => 40);
    const vc = makeSpeakingVC({ onVideoSeek });
    vc.processCommand('動画を戻して');
    expect(onVideoSeek).toHaveBeenCalledWith(-10);
  });

  test('\'seek forward\' routes in English', () => {
    const onVideoSeek = jest.fn(() => 70);
    const vc = makeSpeakingVC({ onVideoSeek });
    vc.processCommand('seek forward');
    expect(onVideoSeek).toHaveBeenCalledWith(10);
  });

  test('\'rewind\' seeks back 10 in English', () => {
    const onVideoSeek = jest.fn(() => 20);
    const vc = makeSpeakingVC({ onVideoSeek });
    vc.processCommand('rewind');
    expect(onVideoSeek).toHaveBeenCalledWith(-10);
  });

  test('no active video announces honestly', () => {
    const vc = makeSpeakingVC({ onVideoSeek: () => null });
    vc.processCommand('10秒戻る');
    expect(vc._spoken.pop()).toBe('再生中の動画がありません');
  });

  test('without a host hook the command answers honestly', () => {
    const vc = makeSpeakingVC();
    vc.processCommand('seek forward');
    expect(vc._spoken.pop()).toBe('再生中の動画がありません');
  });

  test('\'戻る\' alone still routes to go-back, not video-seek', () => {
    const onVideoSeek = jest.fn();
    const tm = makeManager();
    tm.newTab('https://a.example');
    tm.newTab('https://b.example');
    const vc = makeSpeakingVC({ tabManager: tm, onVideoSeek });
    vc.processCommand('戻る');
    expect(onVideoSeek).not.toHaveBeenCalled();
  });
});

// ── settings-toggle ───────────────────────────────────────────────────────────
describe('VoiceCommands settings-toggle', () => {
  test('\'設定を開いて\' opens the panel explicitly', () => {
    const onSettingsPanel = jest.fn(() => true);
    const vc = makeSpeakingVC({ onSettingsPanel });
    vc.processCommand('設定を開いて');
    expect(onSettingsPanel).toHaveBeenCalledWith(true);
    expect(vc._spoken.pop()).toBe('設定を開きます');
  });

  test('\'設定を閉じて\' closes the panel explicitly', () => {
    const onSettingsPanel = jest.fn(() => false);
    const vc = makeSpeakingVC({ onSettingsPanel });
    vc.processCommand('設定を閉じて');
    expect(onSettingsPanel).toHaveBeenCalledWith(false);
    expect(vc._spoken.pop()).toBe('設定を閉じます');
  });

  test('\'設定パネル\' toggles (no explicit direction)', () => {
    const onSettingsPanel = jest.fn(() => true);
    const vc = makeSpeakingVC({ onSettingsPanel });
    vc.processCommand('設定パネル');
    expect(onSettingsPanel).toHaveBeenCalledWith(undefined);
  });

  test('\'close settings\' routes in English', () => {
    const onSettingsPanel = jest.fn(() => false);
    const vc = makeSpeakingVC({ onSettingsPanel });
    vc.processCommand('close settings');
    expect(onSettingsPanel).toHaveBeenCalledWith(false);
    expect(vc._spoken.pop()).toBe('設定を閉じます');
  });

  test('without a host hook the command answers honestly', () => {
    const vc = makeSpeakingVC();
    vc.processCommand('設定を開いて');
    expect(vc._spoken.pop()).toBe('設定を切り替えられません');
  });
});

// ── close-all-tabs ────────────────────────────────────────────────────────────
describe('TabManager.closeAllTabs', () => {
  test('closes every tab and returns the count', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    tm.newTab('https://b.example');
    tm.newTab('https://c.example');
    expect(tm.closeAllTabs()).toBe(3);
    expect(tm.tabs.length).toBe(0);
  });

  test('pinned tabs survive the sweep', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    tm.newTab('https://b.example');
    tm.pinTab(0);
    expect(tm.closeAllTabs()).toBe(1);
    expect(tm.tabs.length).toBe(1);
    expect(tm.tabs[0].pinned).toBe(true);
  });
});

describe('VoiceCommands close-all-tabs', () => {
  test('\'すべてのタブを閉じて\' closes all and announces the count', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    tm.newTab('https://b.example');
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('すべてのタブを閉じて');
    expect(tm.tabs.length).toBe(0);
    expect(vc._spoken.pop()).toBe('2個のタブを閉じました');
  });

  test('reports the pinned survivors honestly', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    tm.newTab('https://b.example');
    tm.pinTab(0);
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('すべてのタブを閉じて');
    expect(vc._spoken.pop()).toBe('1個のタブを閉じました。ピン留め1個は残ります');
  });

  test('only-pinned says it cannot close them', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    tm.pinTab(0);
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('すべてのタブを閉じて');
    expect(vc._spoken.pop()).toBe('ピン留めされたタブは閉じられません');
  });

  test('\'close all tabs\' routes in English', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('close all tabs');
    expect(tm.tabs.length).toBe(0);
  });

  test('\'他のタブを閉じて\' still routes to close-other-tabs', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    tm.newTab('https://b.example');
    tm.newTab('https://c.example');
    tm.setActive(1);
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('他のタブを閉じて');
    expect(tm.tabs.length).toBe(1);
    expect(tm.getActiveTab().currentUrl).toBe('https://b.example');
  });
});
