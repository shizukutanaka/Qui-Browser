/**
 * Round-13 settings-toggle atoms:
 *   - VoiceCommands toggleCmd surface — every boolean settings flag
 *     (captions, haptics, gaze select, curved panel, window follow,
 *     snap turn) reachable by voice via the generic onSettingToggle hook
 *   - comfort-preset — the cycle button's voice surface (bare cycles,
 *     named presets land directly, JA aliases)
 *   - panel-distance — the windowDistance stepper's voice surface
 *     (low-vision: pull the reading surface closer hands-free)
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
jest.mock('three', () => ({
  Group: MockGroup,
  Mesh: class {},
  PlaneGeometry: class { dispose() {} },
  MeshBasicMaterial: class { dispose() {} },
  CanvasTexture: class { constructor() { this.needsUpdate = false; } dispose() {} }
}));
jest.mock('../src/vr/browser/WebPanel.js', () => ({
  WebPanel: class { addToScene() {} setCurved() {} dispose() {} }
}));

global.document = {
  createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({})
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

// ── Toggle commands ───────────────────────────────────────────────────────────
describe('VoiceCommands settings toggles', () => {
  test('\'キャプションをオン\' sets enableCaptions true via the hook', () => {
    const onSettingToggle = jest.fn((k, v) => v);
    const vc = makeSpeakingVC({ onSettingToggle });
    vc.processCommand('キャプションをオン');
    expect(onSettingToggle).toHaveBeenCalledWith('enableCaptions', true);
    expect(vc._spoken.pop()).toBe('キャプション オンです');
  });

  test('\'キャプションをオフ\' sets enableCaptions false', () => {
    const onSettingToggle = jest.fn((k, v) => v);
    const vc = makeSpeakingVC({ onSettingToggle });
    vc.processCommand('キャプションをオフ');
    expect(onSettingToggle).toHaveBeenCalledWith('enableCaptions', false);
    expect(vc._spoken.pop()).toBe('キャプション オフです');
  });

  test('\'字幕を消して\' aliases to enableCaptions false', () => {
    const onSettingToggle = jest.fn((k, v) => v);
    const vc = makeSpeakingVC({ onSettingToggle });
    vc.processCommand('字幕を消して');
    expect(onSettingToggle).toHaveBeenCalledWith('enableCaptions', false);
  });

  test('\'captions off\' routes in English', () => {
    const onSettingToggle = jest.fn((k, v) => v);
    const vc = makeSpeakingVC({ onSettingToggle });
    vc.processCommand('captions off');
    expect(onSettingToggle).toHaveBeenCalledWith('enableCaptions', false);
  });

  test('\'ハプティックをオン\' sets enableHaptics true', () => {
    const onSettingToggle = jest.fn((k, v) => v);
    const vc = makeSpeakingVC({ onSettingToggle });
    vc.processCommand('ハプティックをオン');
    expect(onSettingToggle).toHaveBeenCalledWith('enableHaptics', true);
  });

  test('\'振動をオフ\' aliases to enableHaptics false', () => {
    const onSettingToggle = jest.fn((k, v) => v);
    const vc = makeSpeakingVC({ onSettingToggle });
    vc.processCommand('振動をオフ');
    expect(onSettingToggle).toHaveBeenCalledWith('enableHaptics', false);
  });

  test('\'注視選択をオン\' sets enableGazeDwell true', () => {
    const onSettingToggle = jest.fn((k, v) => v);
    const vc = makeSpeakingVC({ onSettingToggle });
    vc.processCommand('注視選択をオン');
    expect(onSettingToggle).toHaveBeenCalledWith('enableGazeDwell', true);
  });

  test('\'enable gaze\' routes in English', () => {
    const onSettingToggle = jest.fn((k, v) => v);
    const vc = makeSpeakingVC({ onSettingToggle });
    vc.processCommand('enable gaze');
    expect(onSettingToggle).toHaveBeenCalledWith('enableGazeDwell', true);
  });

  test('\'カーブパネルをオン\' sets enableCurvedPanel true', () => {
    const onSettingToggle = jest.fn((k, v) => v);
    const vc = makeSpeakingVC({ onSettingToggle });
    vc.processCommand('カーブパネルをオン');
    expect(onSettingToggle).toHaveBeenCalledWith('enableCurvedPanel', true);
  });

  test('\'ウィンドウ追従をオフ\' sets enableWindowFollow false', () => {
    const onSettingToggle = jest.fn((k, v) => v);
    const vc = makeSpeakingVC({ onSettingToggle });
    vc.processCommand('ウィンドウ追従をオフ');
    expect(onSettingToggle).toHaveBeenCalledWith('enableWindowFollow', false);
  });

  test('\'スナップターンをオン\' sets enableSnapTurn true', () => {
    const onSettingToggle = jest.fn((k, v) => v);
    const vc = makeSpeakingVC({ onSettingToggle });
    vc.processCommand('スナップターンをオン');
    expect(onSettingToggle).toHaveBeenCalledWith('enableSnapTurn', true);
  });

  test('hook returning null announces honestly', () => {
    const vc = makeSpeakingVC({ onSettingToggle: () => null });
    vc.processCommand('キャプションをオン');
    expect(vc._spoken.pop()).toBe('キャプションを切り替えられません');
  });

  test('without a host hook the command still answers honestly', () => {
    const vc = makeSpeakingVC();
    vc.processCommand('ハプティックをオン');
    expect(vc._spoken.pop()).toBe('ハプティックを切り替えられません');
  });

  test('\'キャプションを大きく\' still routes to caption-size, not the toggle', () => {
    const onSettingToggle = jest.fn();
    const onCaptionScale = jest.fn(() => 1.25);
    const vc = makeSpeakingVC({ onSettingToggle, onCaptionScale });
    vc.processCommand('キャプションを大きく');
    expect(onCaptionScale).toHaveBeenCalled();
    expect(onSettingToggle).not.toHaveBeenCalled();
  });
});

// ── Comfort preset ────────────────────────────────────────────────────────────
describe('VoiceCommands comfort-preset', () => {
  test('bare \'コンフォート\' cycles the preset', () => {
    const onSettingToggle = jest.fn((k, v) => v || 'moderate');
    const vc = makeSpeakingVC({ onSettingToggle });
    vc.processCommand('コンフォート');
    expect(onSettingToggle).toHaveBeenCalledWith('motionSensitivity', undefined);
  });

  test('\'コンフォートを敏感に\' lands the sensitive preset', () => {
    const onSettingToggle = jest.fn((k, v) => v);
    const vc = makeSpeakingVC({ onSettingToggle });
    vc.processCommand('コンフォートを敏感に');
    expect(onSettingToggle).toHaveBeenCalledWith('motionSensitivity', 'sensitive');
    expect(vc._spoken.pop()).toBe('コンフォート sensitiveです');
  });

  test('\'コンフォートをオフにして\' maps to disabled', () => {
    const onSettingToggle = jest.fn((k, v) => v);
    const vc = makeSpeakingVC({ onSettingToggle });
    vc.processCommand('コンフォートをオフにして');
    expect(onSettingToggle).toHaveBeenCalledWith('motionSensitivity', 'disabled');
  });

  test('English \'comfort preset to tolerant\' lands the preset', () => {
    const onSettingToggle = jest.fn((k, v) => v);
    const vc = makeSpeakingVC({ onSettingToggle });
    vc.processCommand('comfort preset to tolerant');
    expect(onSettingToggle).toHaveBeenCalledWith('motionSensitivity', 'tolerant');
  });

  test('hook returning null announces honestly', () => {
    const vc = makeSpeakingVC({ onSettingToggle: () => null });
    vc.processCommand('コンフォートを敏感に');
    expect(vc._spoken.pop()).toBe('そのコンフォート設定は使えません');
  });
});

// ── Panel distance ────────────────────────────────────────────────────────────
describe('VoiceCommands panel-distance', () => {
  test('\'パネルを近づけて\' steps the hook -0.2 and announces', () => {
    const onPanelDistance = jest.fn(() => 1.8);
    const vc = makeSpeakingVC({ onPanelDistance });
    vc.processCommand('パネルを近づけて');
    expect(onPanelDistance).toHaveBeenCalledWith(-0.2);
    expect(vc._spoken.pop()).toBe('パネル距離 1.8メートル');
  });

  test('\'パネルを遠く\' steps the hook +0.2', () => {
    const onPanelDistance = jest.fn(() => 2.2);
    const vc = makeSpeakingVC({ onPanelDistance });
    vc.processCommand('パネルを遠く');
    expect(onPanelDistance).toHaveBeenCalledWith(0.2);
  });

  test('\'panel closer\' routes in English', () => {
    const onPanelDistance = jest.fn(() => 1.8);
    const vc = makeSpeakingVC({ onPanelDistance });
    vc.processCommand('panel closer');
    expect(onPanelDistance).toHaveBeenCalledWith(-0.2);
  });

  test('at a bound the command announces honestly', () => {
    const vc = makeSpeakingVC({ onPanelDistance: () => null });
    vc.processCommand('パネルを近づけて');
    expect(vc._spoken.pop()).toBe('パネルはこれ以上移動できません');
  });
});
