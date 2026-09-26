/**
 * Round 53 atoms — settings-status numeric/value entries (windowDistance,
 * motionSensitivity), motion-sensitivity directional setter, panel-distance
 * complaint phrases + direction fix ('近い' pushes away, '遠い' pulls closer),
 * first/last-tab edge aliases, keyboard/tabs-list/vr-fullscreen/read-url/
 * copy-url aliases, legibility complaints on reader-size, '見えにくい' on
 * trouble.
 * External basis: Voice Access 'is X on' query parity extended to numeric
 * settings, Chrome fullscreen/immersive wording, VoiceOver rotor tab edges.
 * THREE / WebPanel / canvas stubs mirror tab-session.test.js.
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
jest.mock('../src/vr/browser/WebPanel.js', () => ({
  WebPanel: class {
    constructor(opts) {
      this.opts = opts;
      this.isPrivate = !!opts.privateMode;
      this.currentUrl = '';
      this.currentTitle = '';
      this.group = { position: { set: jest.fn() } };
      this.visible = false;
      this.disposed = false;
    }
    addToScene(parent) { this.parent = parent; }
    navigate(url) { this.currentUrl = url; }
    setVisible(v) { this.visible = !!v; }
    dispose() { this.disposed = true; }
  }
}));

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
global.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(t) {
  this.text = t;
};

const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');
const { TabManager } = require('../src/vr/browser/TabManager.js');

function makeVC(opts = {}) {
  const vc = new VoiceCommands();
  const spoken = [];
  vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: () => {}, speaking: false };
  const tm = new TabManager({
    scene: { add: jest.fn(), remove: jest.fn() },
    registerInteractable: jest.fn(),
    unregisterInteractable: jest.fn(),
    onNavigate: jest.fn(),
    maxTabs: 8
  });
  tm.newTab('https://a.jp');
  tm.newTab('https://b.jp');
  vc.connectBrowser({ tabManager: tm, ...opts });
  return { vc, spoken, tm };
}

describe('settings-status: numeric/value entries', () => {
  test.each([
    ['パネルの距離', 'windowDistance'],
    ['パネル距離は', 'windowDistance'],
    ['パネルの距離は', 'windowDistance'],
    ['パネルはどのくらい', 'windowDistance'],
    ['what is the panel distance', 'windowDistance'],
    ['window distance', 'windowDistance']
  ])('"%s" queries %s', (phrase, key) => {
    const onSettingStatus = jest.fn(() => 2.0);
    const { vc, spoken } = makeVC({ onSettingStatus });
    vc.processCommand(phrase);
    expect(onSettingStatus).toHaveBeenCalledWith(key);
    expect(spoken[0]).toBe('パネル距離 2メートルです');
  });

  test.each([
    ['モーション感度は', 'motionSensitivity', 'moderate', 'モーション感度は標準です'],
    ['モーション感度', 'motionSensitivity', 'sensitive', 'モーション感度は敏感です'],
    ['motion sensitivity', 'motionSensitivity', 'tolerant', 'モーション感度は寛容です']
  ])('"%s" maps %s value %s', (phrase, key, value, utterance) => {
    const onSettingStatus = jest.fn(() => value);
    const { vc, spoken } = makeVC({ onSettingStatus });
    vc.processCommand(phrase);
    expect(onSettingStatus).toHaveBeenCalledWith(key);
    expect(spoken[0]).toBe(utterance);
  });
});

describe('motion-sensitivity: directional setter', () => {
  test.each([
    ['モーション感度を上げて', 'sensitive', 'モーション感度を敏感にしました'],
    ['モーション感度を下げて', 'tolerant', 'モーション感度を寛容にしました'],
    ['モーション感度を標準に', 'moderate', 'モーション感度を標準にしました'],
    ['モーション感度を弱く', 'tolerant', 'モーション感度を寛容にしました'],
    ['motion sensitivity up', 'sensitive', 'モーション感度を敏感にしました'],
    ['motion sensitivity down', 'tolerant', 'モーション感度を寛容にしました']
  ])('"%s" sets %s', (phrase, preset, utterance) => {
    const onSettingToggle = jest.fn(() => preset);
    const { vc, spoken } = makeVC({ onSettingToggle });
    vc.processCommand(phrase);
    expect(onSettingToggle).toHaveBeenCalledWith('motionSensitivity', preset);
    expect(spoken[0]).toBe(utterance);
  });

  test('rejected setter answers honestly', () => {
    const onSettingToggle = jest.fn(() => null);
    const { vc, spoken } = makeVC({ onSettingToggle });
    vc.processCommand('モーション感度を上げて');
    expect(spoken[0]).toBe('モーション感度を変更できません');
  });
});

describe('panel-distance: complaint phrases + direction', () => {
  test.each([
    ['パネルが遠い', -0.2], ['パネルが遠すぎる', -0.2], ['画面が遠い', -0.2],
    ['遠すぎる', -0.2], ['too far', -0.2],
    ['パネルが近い', 0.2], ['パネルが近すぎる', 0.2], ['近すぎる', 0.2],
    ['too close', 0.2], ['パネルを遠くして', 0.2], ['パネルを近くして', -0.2]
  ])('"%s" moves the panel %s', (phrase, delta) => {
    const onPanelDistance = jest.fn(() => 2.4);
    const { vc, spoken } = makeVC({ onPanelDistance });
    vc.processCommand(phrase);
    expect(onPanelDistance).toHaveBeenCalledWith(delta);
    expect(spoken[0]).toContain('パネル距離');
  });
});

describe('first/last tab edge aliases', () => {
  test.each([
    ['一番左のタブ', 0], ['左端のタブ', 0], ['leftmost tab', 0],
    ['一番右のタブ', 1], ['右端のタブ', 1], ['rightmost tab', 1]
  ])('"%s" selects tab %s', (phrase, idx) => {
    const { vc, tm } = makeVC();
    const spy = jest.spyOn(tm, 'setActive');
    vc.processCommand(phrase);
    expect(spy).toHaveBeenCalledWith(idx);
  });
});

describe('keyboard aliases', () => {
  test.each(['キーボードを出して', 'キーボードを閉じて', 'キーボードを表示',
    'キーボードをしまって', 'show keyboard', 'hide keyboard'])(
    '"%s" toggles the keyboard', (phrase) => {
      const vrKeyboard = { visible: false, show: jest.fn(), hide: jest.fn() };
      const { vc } = makeVC({ vrKeyboard });
      vc.processCommand(phrase);
      expect(vrKeyboard.show.mock.calls.length + vrKeyboard.hide.mock.calls.length).toBe(1);
    });
});

describe('tabs-list aliases', () => {
  test.each(['タブ一覧を読んで', 'タブを一覧して', '開いてるタブ', '開いているタブ'])(
    '"%s" reads the tab list', (phrase) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(phrase);
      expect(spoken[0]).toContain('個のタブ');
    });
});

describe('fullscreen / immersive aliases on vr-enter + vr-exit', () => {
  test.each(['全画面', 'フルスクリーン', '全画面にして', 'フルスクリーンにして',
    'immersive mode', 'fullscreen'])(
    '"%s" enters immersive mode', (phrase) => {
      const { vc } = makeVC();
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('vr-enter');
      expect(vc.lastCommand.result.enabled).toBe(true);
    });
  test.each(['全画面をやめて', 'フルスクリーンをやめて', '全画面解除',
    'フルスクリーン解除', 'exit fullscreen'])(
    '"%s" exits immersive mode', (phrase) => {
      const { vc } = makeVC();
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('vr-exit');
      expect(vc.lastCommand.result.enabled).toBe(false);
    });
});

describe('reader-size legibility complaints + font aliases', () => {
  test.each(['文字が小さい', '字が小さい', '文字が読めない', '読みにくい',
    'フォントを大きくして', 'フォントを拡大', 'フォントサイズを上げる'])(
    '"%s" enlarges reader text', (phrase) => {
      const onReaderScale = jest.fn(() => 1.2);
      const { vc, spoken } = makeVC({ onReaderScale });
      vc.processCommand(phrase);
      expect(onReaderScale).toHaveBeenCalledWith(expect.any(Number));
      expect(spoken[0]).toContain('文字');
    });
  test.each(['文字が大きい', '字が大きい', 'フォントを小さくして', 'フォントサイズを下げる'])(
    '"%s" shrinks reader text', (phrase) => {
      const onReaderScale = jest.fn(() => 0.9);
      const { vc } = makeVC({ onReaderScale });
      vc.processCommand(phrase);
      expect(onReaderScale).toHaveBeenCalledWith(expect.any(Number));
    });
});

describe('read-url / copy-url aliases', () => {
  test.each(['このページのURL', 'ページのアドレス', 'このページのアドレス', 'URLを言って'])(
    '"%s" reads the URL', (phrase) => {
      const { vc, spoken, tm } = makeVC();
      tm.getActiveTab().currentUrl = 'https://example.jp';
      vc.processCommand(phrase);
      expect(spoken[0]).toBe('https://example.jp');
    });
  test.each(['このページのリンク', 'ページのリンク', 'ページのリンクをコピー'])(
    '"%s" copies the URL', (phrase) => {
      const onCopyUrl = jest.fn(() => 'https://example.jp');
      const { vc, spoken } = makeVC({ onCopyUrl });
      vc.processCommand(phrase);
      expect(onCopyUrl).toHaveBeenCalled();
      expect(spoken[0]).toBe('URLをコピーしました');
    });
});

describe('trouble: visibility complaints', () => {
  test.each(['見えにくい', '見にくい', '画面が見にくい'])(
    '"%s" speaks recovery guidance', (phrase) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(phrase);
      expect(spoken[0]).toContain('音声は動作中です');
    });
});
