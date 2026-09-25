/**
 * Round-15 stepper/toggle atoms:
 *   - onStepper — generic numeric-stepper hook: every remaining settings
 *     stepper (grace window, snap angle, move speed, caption hold,
 *     caption height) reachable by voice at one-step increments
 *   - southpaw-toggle / smooth-move-toggle — the last unreachable bools
 *     routed through the existing onSettingToggle hook
 *   - speech-pitch — NVDA pitch parity (setSpeechPitch + utterance.pitch)
 *   - read-url — the single-line address atom
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

// ── Generic stepper commands ──────────────────────────────────────────────────
describe('VoiceCommands numeric steppers', () => {
  test('\'グレース時間を長く\' steps gazeGraceTime up one step', () => {
    const onStepper = jest.fn(() => 350);
    const vc = makeSpeakingVC({ onStepper });
    vc.processCommand('グレース時間を長く');
    expect(onStepper).toHaveBeenCalledWith('gazeGraceTime', 1);
    expect(vc._spoken.pop()).toBe('グレース時間 350ミリ秒');
  });

  test('\'グレース時間を短く\' steps down', () => {
    const onStepper = jest.fn(() => 250);
    const vc = makeSpeakingVC({ onStepper });
    vc.processCommand('グレース時間を短く');
    expect(onStepper).toHaveBeenCalledWith('gazeGraceTime', -1);
  });

  test('\'スナップ角を大きく\' steps snapTurnAngle up', () => {
    const onStepper = jest.fn(() => 45);
    const vc = makeSpeakingVC({ onStepper });
    vc.processCommand('スナップ角を大きく');
    expect(onStepper).toHaveBeenCalledWith('snapTurnAngle', 1);
    expect(vc._spoken.pop()).toBe('スナップ角 45度');
  });

  test('\'snap angle down\' routes in English', () => {
    const onStepper = jest.fn(() => 15);
    const vc = makeSpeakingVC({ onStepper });
    vc.processCommand('snap angle down');
    expect(onStepper).toHaveBeenCalledWith('snapTurnAngle', -1);
  });

  test('\'移動速度を速く\' steps smoothMoveSpeed up', () => {
    const onStepper = jest.fn(() => 2.3);
    const vc = makeSpeakingVC({ onStepper });
    vc.processCommand('移動速度を速く');
    expect(onStepper).toHaveBeenCalledWith('smoothMoveSpeed', 1);
  });

  test('\'キャプションを長く\' steps captionDuration up', () => {
    const onStepper = jest.fn(() => 7);
    const vc = makeSpeakingVC({ onStepper });
    vc.processCommand('キャプションを長く');
    expect(onStepper).toHaveBeenCalledWith('captionDuration', 1);
    expect(vc._spoken.pop()).toBe('キャプション保持時間 7秒');
  });

  test('\'キャプションを上に\' steps captionHeight up', () => {
    const onStepper = jest.fn(() => -0.45);
    const vc = makeSpeakingVC({ onStepper });
    vc.processCommand('キャプションを上に');
    expect(onStepper).toHaveBeenCalledWith('captionHeight', 1);
  });

  test('\'caption lower\' steps captionHeight down in English', () => {
    const onStepper = jest.fn(() => -0.65);
    const vc = makeSpeakingVC({ onStepper });
    vc.processCommand('caption lower');
    expect(onStepper).toHaveBeenCalledWith('captionHeight', -1);
  });

  test('at a bound the stepper announces honestly', () => {
    const vc = makeSpeakingVC({ onStepper: () => null });
    vc.processCommand('グレース時間を長く');
    expect(vc._spoken.pop()).toBe('グレース時間を変更できません');
  });

  test('without a host hook the command answers honestly', () => {
    const vc = makeSpeakingVC();
    vc.processCommand('スナップ角を大きく');
    expect(vc._spoken.pop()).toBe('スナップ角を変更できません');
  });

  test('\'キャプションを大きく\' still routes to caption-size, not caption-hold', () => {
    const onStepper = jest.fn();
    const onCaptionScale = jest.fn(() => 1.25);
    const vc = makeSpeakingVC({ onStepper, onCaptionScale });
    vc.processCommand('キャプションを大きく');
    expect(onCaptionScale).toHaveBeenCalled();
    expect(onStepper).not.toHaveBeenCalled();
  });
});

// ── southpaw / smooth-move toggles ───────────────────────────────────────────
describe('VoiceCommands southpaw / smooth-move toggles', () => {
  test('\'利き手を左に\' sets southpaw true', () => {
    const onSettingToggle = jest.fn((k, v) => v);
    const vc = makeSpeakingVC({ onSettingToggle });
    vc.processCommand('利き手を左に');
    expect(onSettingToggle).toHaveBeenCalledWith('southpaw', true);
    expect(vc._spoken.pop()).toBe('利き手を左にしました');
  });

  test('\'right-handed\' sets southpaw false', () => {
    const onSettingToggle = jest.fn((k, v) => v);
    const vc = makeSpeakingVC({ onSettingToggle });
    vc.processCommand('right-handed');
    expect(onSettingToggle).toHaveBeenCalledWith('southpaw', false);
    expect(vc._spoken.pop()).toBe('利き手を右にしました');
  });

  test('\'左利き\' bare alias sets southpaw true', () => {
    const onSettingToggle = jest.fn((k, v) => v);
    const vc = makeSpeakingVC({ onSettingToggle });
    vc.processCommand('左利き');
    expect(onSettingToggle).toHaveBeenCalledWith('southpaw', true);
  });

  test('\'スムーズ移動をオン\' sets enableSmoothMove true', () => {
    const onSettingToggle = jest.fn((k, v) => v);
    const vc = makeSpeakingVC({ onSettingToggle });
    vc.processCommand('スムーズ移動をオン');
    expect(onSettingToggle).toHaveBeenCalledWith('enableSmoothMove', true);
    expect(vc._spoken.pop()).toBe('スムーズ移動 オンです');
  });

  test('\'smooth movement off\' routes in English', () => {
    const onSettingToggle = jest.fn((k, v) => v);
    const vc = makeSpeakingVC({ onSettingToggle });
    vc.processCommand('smooth movement off');
    expect(onSettingToggle).toHaveBeenCalledWith('enableSmoothMove', false);
  });
});

// ── speech-pitch ──────────────────────────────────────────────────────────────
describe('VoiceCommands speech-pitch', () => {
  test('\'声を高く\' raises the pitch by 0.25', () => {
    const vc = makeSpeakingVC();
    vc.processCommand('声を高く');
    expect(vc._speechPitch).toBe(1.25);
    expect(vc._spoken.pop()).toBe('ピッチ 1.25倍');
  });

  test('\'pitch down\' lowers the pitch in English', () => {
    const vc = makeSpeakingVC();
    vc.processCommand('pitch down');
    expect(vc._speechPitch).toBe(0.75);
  });

  test('pitch clamps at the 0.5 floor', () => {
    const vc = makeSpeakingVC();
    vc.setSpeechPitch(0.5);
    vc.processCommand('声を低く');
    expect(vc._speechPitch).toBe(0.5);
  });

  test('the pitch is applied to every utterance', () => {
    const vc = makeSpeakingVC();
    const utterances = [];
    vc.synthesis.speak = (u) => utterances.push(u);
    vc.setSpeechPitch(1.5);
    vc.speak('テスト');
    expect(utterances.pop().pitch).toBe(1.5);
  });
});

// ── read-url ──────────────────────────────────────────────────────────────────
describe('VoiceCommands read-url', () => {
  test('\'URLを教えて\' reads the active tab URL', () => {
    const tm = makeManager();
    tm.newTab('https://example.com/page');
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('URLを教えて');
    expect(vc._spoken.pop()).toBe('https://example.com/page');
  });

  test('\'read the url\' routes in English', () => {
    const tm = makeManager();
    tm.newTab('https://example.com');
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('read the url');
    expect(vc._spoken.pop()).toBe('https://example.com');
  });

  test('announces honestly with no tabs', () => {
    const vc = makeSpeakingVC({ tabManager: makeManager() });
    vc.processCommand('URLを教えて');
    expect(vc._spoken.pop()).toBe('URLがありません');
  });
});
