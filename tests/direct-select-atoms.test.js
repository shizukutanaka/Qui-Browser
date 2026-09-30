/**
 * Round-14 direct-select atoms:
 *   - tab-select / last-tab — Chrome Ctrl+1..8 and Ctrl+9 parity: land on a
 *     strip position by voice; out-of-range announces honestly (never clamps
 *     the user somewhere they didn't ask for)
 *   - title — NVDA Insert+T parity: read the active page title
 *   - mute-toggle — the hardware/OS mute-key atom: stores the pre-mute
 *     level and restores it on unmute
 *   - select-voice — NVDA voice-selection parity: cycle the engine's voices
 *     and announce the name, applied to every later utterance
 */

// ── THREE + WebPanel stubs (same harness as shell-atoms.test.js) ────────────
const panelInstances = [];
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
      this.currentTitle = opts.title || '';
      this.isPrivate = !!opts.privateMode;
      this.pinned = false;
      this.group = { position: { set: jest.fn() } };
      this.visible = false;
      panelInstances.push(this);
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
  vc.synthesis = { speak: (u) => spoken.push(u), cancel: jest.fn() };
  vc._spokenUtterances = spoken;
  vc._spoken = spoken.map(u => u.text || u);
  vc.speakText = () => spoken.map(u => u.text || u);
  return vc;
}

// ── tab-select ────────────────────────────────────────────────────────────────
describe('VoiceCommands tab-select / last-tab', () => {
  test('\'タブ2\' activates the second tab (Ctrl+1..8 parity)', () => {
    const tm = makeManager();
    tm.newTab('a'); tm.newTab('b'); tm.newTab('c');
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('タブ2');
    expect(tm.activeIndex).toBe(1);
    expect(vc._spokenUtterances[0].voice).toBeUndefined();
    expect(vc.speakText().pop()).toBe('b');
  });

  test('\'tab 3\' routes in English', () => {
    const tm = makeManager();
    tm.newTab('a'); tm.newTab('b'); tm.newTab('c');
    tm.setActive(0); // leave the last tab — selection must do the move
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('tab 3');
    expect(tm.activeIndex).toBe(2);
  });

  test('out-of-range announces honestly and changes nothing', () => {
    const tm = makeManager();
    tm.newTab('a');
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('タブ5');
    expect(tm.activeIndex).toBe(0);
    expect(vc.speakText().pop()).toBe('タブ5はありません');
  });

  test('\'最後のタブ\' lands on the last tab (Ctrl+9 parity)', () => {
    const tm = makeManager();
    tm.newTab('a'); tm.newTab('b'); tm.newTab('c');
    tm.setActive(0);
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('最後のタブ');
    expect(tm.activeIndex).toBe(2);
  });

  test('\'last tab\' announces honestly with no tabs open', () => {
    const vc = makeSpeakingVC({ tabManager: makeManager() });
    vc.processCommand('last tab');
    expect(vc.speakText().pop()).toBe('タブがありません');
  });
});

// ── title ─────────────────────────────────────────────────────────────────────
describe('VoiceCommands title (Insert+T parity)', () => {
  test('reads the active tab title', () => {
    const tm = makeManager();
    tm.newTab('a');
    tm.tabs[0].currentTitle = 'サンプルページ';
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('タイトル');
    expect(vc.speakText().pop()).toBe('サンプルページ');
  });

  test('falls back to the URL when no title is set', () => {
    const tm = makeManager();
    tm.newTab('https://example.com');
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('page title');
    expect(vc.speakText().pop()).toBe('https://example.com');
  });

  test('announces honestly with no tabs', () => {
    const vc = makeSpeakingVC({ tabManager: makeManager() });
    vc.processCommand('タイトル');
    expect(vc.speakText().pop()).toBe('タブがありません');
  });
});

// ── mute-toggle ───────────────────────────────────────────────────────────────
describe('VoiceCommands mute-toggle', () => {
  test('\'ミュート\' mutes via the hook and announces', () => {
    const onMute = jest.fn(() => true);
    const vc = makeSpeakingVC({ onMute });
    vc.processCommand('ミュート');
    expect(onMute).toHaveBeenCalledWith(undefined);
    expect(vc.speakText().pop()).toBe('ミュート オンです');
  });

  test('\'ミュートを解除\' passes an explicit unmute want', () => {
    const onMute = jest.fn(() => false);
    const vc = makeSpeakingVC({ onMute });
    vc.processCommand('ミュートを解除');
    expect(onMute).toHaveBeenCalledWith(false);
    expect(vc.speakText().pop()).toBe('ミュートを解除しました');
  });

  test('\'unmute\' can never mute by accident', () => {
    const onMute = jest.fn(() => false);
    const vc = makeSpeakingVC({ onMute });
    vc.processCommand('unmute');
    expect(onMute).toHaveBeenCalledWith(false);
  });

  test('without a host hook the command answers honestly', () => {
    const vc = makeSpeakingVC();
    vc.processCommand('ミュート');
    expect(vc.speakText().pop()).toBe('ミュートを切り替えられません');
  });
});

// ── select-voice ──────────────────────────────────────────────────────────────
describe('VoiceCommands select-voice', () => {
  test('cycles to the first voice and announces its name', () => {
    const vc = makeSpeakingVC();
    vc.synthesis.getVoices = () => [{ name: 'Voice A' }, { name: 'Voice B' }];
    vc.processCommand('声を変えて');
    expect(vc._voice.name).toBe('Voice A');
    expect(vc.speakText().pop()).toBe('声をVoice Aにしました');
  });

  test('a second call advances to the next voice', () => {
    const vc = makeSpeakingVC();
    vc.synthesis.getVoices = () => [{ name: 'Voice A' }, { name: 'Voice B' }];
    vc.processCommand('声を変えて');
    vc.processCommand('声を変えて');
    expect(vc._voice.name).toBe('Voice B');
  });

  test('the picked voice is applied to later utterances', () => {
    const vc = makeSpeakingVC();
    const voices = [{ name: 'Voice A' }, { name: 'Voice B' }];
    vc.synthesis.getVoices = () => voices;
    vc.processCommand('声を変えて');
    expect(vc._spokenUtterances.pop().voice).toBe(voices[0]);
  });

  test('with no voices the command answers honestly', () => {
    const vc = makeSpeakingVC();
    vc.synthesis.getVoices = () => [];
    vc.processCommand('声を変えて');
    expect(vc._voice).toBeNull();
    expect(vc.speakText().pop()).toBe('読み上げ音声が利用できません');
  });
});
