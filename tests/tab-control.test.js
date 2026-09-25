/**
 * Unit tests for the hands-free tab-control atoms (Ctrl+Shift+T-style reopen
 * stack, Ctrl+Tab-style wrap-around cycling) and their voice-command wiring.
 *
 * Grounding: every desktop browser (Chrome/Firefox/Safari/Edge) ships
 * reopen-closed-tab and wrap-around tab cycling; Wolvic orders its tab list
 * by most-recently-used. In a voice-first UI these atoms are commands, not
 * shortcuts — a gaze/hands-free user has no keyboard to press Ctrl+Shift+T.
 *
 * THREE and WebPanel are mocked so the pure tab-lifecycle logic runs without
 * a WebGL context or real iframes.
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
      this.currentTitle = '';
      this.isPrivate = !!opts.privateMode;
      this.group = { position: { set: jest.fn() } };
      this.visible = false;
      this.disposed = false;
      panelInstances.push(this);
    }
    addToScene(parent) { this.parent = parent; }
    navigate(url) { this.currentUrl = url; }
    setVisible(v) { this.visible = !!v; }
    setCurved() {}
    stop() { this.stopped = true; }
    dispose() { this.disposed = true; }
  }
}));

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

function makeManager(opts = {}) {
  return new TabManager({
    scene: { add: jest.fn(), remove: jest.fn() },
    registerInteractable: jest.fn(),
    unregisterInteractable: jest.fn(),
    ...opts
  });
}

function makeVoice(tabManager, extra = {}) {
  const vc = new VoiceCommands();
  vc.callbacks.onSpeak = () => {};
  vc.connectBrowser({ tabManager, ...extra });
  return vc;
}

describe('TabManager — reopen closed tab (Ctrl+Shift+T)', () => {
  beforeEach(() => { panelInstances.length = 0; });

  test('closing a tab pushes its URL onto the closed stack', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    tm.closeTab(0);
    expect(tm._closedStack).toEqual(['https://a.example']);
  });

  test('reopenClosedTab() recreates the tab at its URL (LIFO)', () => {
    const tm = makeManager();
    tm.newTab('https://first.example');
    tm.newTab('https://second.example');
    tm.closeTab(1); // close 'second'
    tm.closeTab(0); // close 'first' — most recent = first
    const url = tm.reopenClosedTab();
    expect(url).toBe('https://first.example');
    expect(tm.getActiveTab().currentUrl).toBe('https://first.example');
    expect(tm._closedStack).toEqual(['https://second.example']);
  });

  test('reopenClosedTab() returns null on an empty stack and opens nothing', () => {
    const tm = makeManager();
    expect(tm.reopenClosedTab()).toBeNull();
    expect(tm.count).toBe(0);
  });

  test('private tabs are never pushed onto the stack', () => {
    const tm = makeManager();
    tm.setPrivateMode(true);
    tm.newTab('https://secret.example');
    tm.closeTab(0);
    expect(tm._closedStack).toEqual([]);
    expect(tm.reopenClosedTab()).toBeNull();
  });

  test('empty (never-navigated) tabs leave nothing to reopen', () => {
    const tm = makeManager();
    tm.newTab(); // currentUrl stays ''
    tm.closeTab(0);
    expect(tm._closedStack).toEqual([]);
    expect(tm.reopenClosedTab()).toBeNull();
  });

  test('the stack is capped at 10 — oldest entries drop off', () => {
    const tm = makeManager();
    for (let i = 0; i < 12; i++) {
      tm.newTab(`https://site-${i}.example`);
      tm.closeTab(tm.activeIndex);
    }
    expect(tm._closedStack).toHaveLength(10);
    expect(tm._closedStack[0]).toBe('https://site-2.example');
  });

  test('a refused reopen (MAX_TABS) keeps the entry on the stack', () => {
    const tm = makeManager();
    tm.newTab('https://closed.example');
    tm.closeTab(0);
    for (let i = 0; i < 8; i++) {
      tm.newTab(`https://fill-${i}.example`);
    }
    expect(tm.reopenClosedTab()).toBeNull();
    expect(tm._closedStack).toEqual(['https://closed.example']);
  });

  test('dispose() clears the stack', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    tm.closeTab(0);
    tm.dispose();
    expect(tm._closedStack).toEqual([]);
  });
});

describe('TabManager — wrap-around cycling (Ctrl+Tab)', () => {
  beforeEach(() => { panelInstances.length = 0; });

  test('nextTab() wraps past the last tab to the first', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    tm.newTab('https://b.example');
    tm.newTab('https://c.example');
    expect(tm.activeIndex).toBe(2);
    expect(tm.nextTab()).toBe(0);
    expect(tm.getActiveTab().currentUrl).toBe('https://a.example');
  });

  test('prevTab() wraps past the first tab to the last', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    tm.newTab('https://b.example');
    tm.setActive(0);
    expect(tm.prevTab()).toBe(1);
  });

  test('cycling is a no-op with fewer than two tabs', () => {
    const tm = makeManager();
    expect(tm.nextTab()).toBe(-1);
    tm.newTab('https://a.example');
    expect(tm.nextTab()).toBe(0);
    expect(tm.prevTab()).toBe(0);
  });
});

describe('VoiceCommands — tab control surface', () => {
  test('"新しいタブ" opens a tab', () => {
    const tm = makeManager();
    const vc = makeVoice(tm);
    vc.processCommand('新しいタブ', 0.9);
    expect(vc.lastCommand.key).toBe('new-tab');
    expect(tm.count).toBe(1);
  });

  test('"new tab" (English) also opens a tab', () => {
    const tm = makeManager();
    const vc = makeVoice(tm);
    vc.processCommand('new tab', 0.9);
    expect(tm.count).toBe(1);
  });

  test('"新しいタブを開く" hits new-tab, not the go-to catch-all', () => {
    const tm = makeManager();
    const onGoTo = jest.fn();
    const vc = makeVoice(tm, { onGoTo });
    vc.processCommand('新しいタブを開く', 0.9);
    expect(vc.lastCommand.key).toBe('new-tab');
    expect(onGoTo).not.toHaveBeenCalled();
  });

  test('"タブを閉じる" closes the active tab', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    const vc = makeVoice(tm);
    vc.processCommand('タブを閉じる', 0.9);
    expect(vc.lastCommand.key).toBe('close-tab');
    expect(tm.count).toBe(0);
  });

  test('"close tab" (English) closes the active tab', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    const vc = makeVoice(tm);
    vc.processCommand('close tab', 0.9);
    expect(tm.count).toBe(0);
  });

  test('"次のタブ" / "前のタブ" cycle the active tab', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    tm.newTab('https://b.example');
    const vc = makeVoice(tm);
    vc.processCommand('次のタブ', 0.9);
    expect(vc.lastCommand.key).toBe('next-tab');
    expect(tm.activeIndex).toBe(0);
    vc.processCommand('前のタブ', 0.9);
    expect(vc.lastCommand.key).toBe('prev-tab');
    expect(tm.activeIndex).toBe(1);
  });

  test('"next tab" / "previous tab" (English) cycle too', () => {
    const tm = makeManager();
    tm.newTab('https://a.example');
    tm.newTab('https://b.example');
    const vc = makeVoice(tm);
    vc.processCommand('next tab', 0.9);
    expect(tm.activeIndex).toBe(0);
    vc.processCommand('previous tab', 0.9);
    expect(tm.activeIndex).toBe(1);
  });

  test('"閉じたタブを開き直す" reopens the closed tab and reports its URL', () => {
    const tm = makeManager();
    tm.newTab('https://lost.example');
    tm.closeTab(0);
    const vc = makeVoice(tm);
    vc.processCommand('閉じたタブを開き直す', 0.9);
    expect(vc.lastCommand.key).toBe('reopen-tab');
    expect(vc.lastCommand.result.url).toBe('https://lost.example');
    expect(tm.getActiveTab().currentUrl).toBe('https://lost.example');
  });

  test('"reopen tab" (English) also works', () => {
    const tm = makeManager();
    tm.newTab('https://lost.example');
    tm.closeTab(0);
    const vc = makeVoice(tm);
    vc.processCommand('reopen tab', 0.9);
    expect(tm.getActiveTab().currentUrl).toBe('https://lost.example');
  });

  test('"読み込みを止めて" stops the active panel — not voice listening', () => {
    const tm = makeManager();
    const panel = tm.newTab('https://a.example');
    const stopSpy = jest.spyOn(panel, 'stop');
    const vc = makeVoice(tm);
    vc.processCommand('読み込みを止めて', 0.9);
    expect(vc.lastCommand.key).toBe('stop-loading');
    expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  test('"stop loading" (English) stops the active panel', () => {
    const tm = makeManager();
    const panel = tm.newTab('https://a.example');
    const stopSpy = jest.spyOn(panel, 'stop');
    const vc = makeVoice(tm);
    vc.processCommand('stop loading', 0.9);
    expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  test('plain "停止" still reaches the listening-stop command, not stop-loading', () => {
    // The two surfaces share vocabulary: '停止' alone must still stop
    // *listening* (the original 'stop' command), while '読み込み…' variants
    // stop page loading. Exact-string matching keeps them apart.
    const tm = makeManager();
    tm.newTab('https://a.example');
    const vc = makeVoice(tm);
    vc.isListening = false;
    vc.recognition = { stop: jest.fn() };
    vc.processCommand('停止', 0.9);
    expect(vc.lastCommand.key).toBe('stop');
  });

  test('"プライベートモード" fires onTogglePrivateMode', () => {
    const onTogglePrivateMode = jest.fn();
    const vc = makeVoice(makeManager(), { onTogglePrivateMode });
    vc.processCommand('プライベートモード', 0.9);
    expect(vc.lastCommand.key).toBe('private-mode');
    expect(onTogglePrivateMode).toHaveBeenCalledTimes(1);
  });

  test('"private mode" (English) fires onTogglePrivateMode', () => {
    const onTogglePrivateMode = jest.fn();
    const vc = makeVoice(makeManager(), { onTogglePrivateMode });
    vc.processCommand('private mode', 0.9);
    expect(onTogglePrivateMode).toHaveBeenCalledTimes(1);
  });

  test('tab commands do not throw when tabManager is absent', () => {
    const vc = new VoiceCommands();
    vc.callbacks.onSpeak = () => {};
    vc.connectBrowser({});
    for (const phrase of ['新しいタブ', 'タブを閉じる', '次のタブ', '前のタブ',
      '閉じたタブを開き直す', '読み込みを止めて', 'プライベートモード']) {
      expect(() => vc.processCommand(phrase, 0.9)).not.toThrow();
    }
  });
});
