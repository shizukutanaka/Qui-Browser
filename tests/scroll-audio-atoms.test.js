/**
 * Round 50 atoms — scroll-top misroute fix ('先頭に戻る' ran back()),
 * 'オプションを開いて' misroute fix (literal navigate), reader-scale-reset
 * (Chrome Ctrl+0 parity), audio-trouble, plus alias pass VII.
 * External basis: Chrome reset-zoom shortcut, NVDA honest error guidance,
 * Chrome 'scroll to top' phrasing.
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
  tm.setActive(1);
  vc.connectBrowser({ tabManager: tm, ...opts });
  return { vc, spoken, tm };
}

describe('scroll-top misroute: 先頭/一番上/トップに戻る must not goBack', () => {
  test.each(['先頭に戻る', '一番上に戻る', 'トップに戻る', 'ページの先頭に戻る',
    '先頭に戻って', '一番上に戻って', 'トップに戻って', 'トップへ'])(
    '"%s" scrolls to top, does not navigate back', (phrase) => {
      const { vc, tm } = makeVC();
      const tab = tm.getActiveTab();
      tab.scrollToTop = jest.fn();
      tab.goBack = jest.fn(() => true);
      vc.processCommand(phrase);
      expect(tab.scrollToTop).toHaveBeenCalled();
      expect(tab.goBack).not.toHaveBeenCalled();
    });
  test('plain 戻る still navigates back', () => {
    const { vc, spoken, tm } = makeVC();
    const tab = tm.getActiveTab();
    tab.scrollToTop = jest.fn();
    tab.goBack = jest.fn(() => true);
    vc.processCommand('戻る');
    expect(tab.goBack).toHaveBeenCalled();
    expect(tab.scrollToTop).not.toHaveBeenCalled();
    expect(spoken[0]).toBe('戻ります');
  });
});

describe('settings misroute: options/preferences open the panel', () => {
  test.each(['オプションを開いて', 'オプション', '設定画面', '環境設定',
    'プリファレンス', 'options', 'preferences'])(
    '"%s" toggles settings, never navigates', (phrase) => {
      const onSettingsPanel = jest.fn(() => true);
      const onGoTo = jest.fn();
      const { vc, spoken } = makeVC({ onSettingsPanel, onGoTo });
      vc.processCommand(phrase);
      expect(onSettingsPanel).toHaveBeenCalled();
      expect(onGoTo).not.toHaveBeenCalled();
      expect(spoken[0]).toBe('設定を開きます');
    });
});

describe('reader-scale-reset: Ctrl+0 parity', () => {
  test.each(['ズームをリセット', '文字サイズを元に戻して', '拡大を戻して',
    'フォントサイズをリセット', 'reset zoom', 'zoom reset', 'reset text size'])(
    '"%s" resets the scale via one delta to 1.0', (phrase) => {
      const onReaderScale = jest.fn(() => 1.0);
      const onReaderScaleStatus = jest.fn(() => 1.75);
      const { vc, spoken } = makeVC({ onReaderScale, onReaderScaleStatus });
      vc.processCommand(phrase);
      expect(onReaderScale).toHaveBeenCalledWith(-0.75);
      expect(spoken[0]).toBe('文字サイズを標準に戻しました');
    });
  test('already at 1.0 announces so', () => {
    const { vc, spoken } = makeVC({ onReaderScale: jest.fn(() => null), onReaderScaleStatus: () => 1.0 });
    vc.processCommand('ズームをリセット');
    expect(spoken[0]).toBe('文字サイズは標準です');
  });
  test('no hooks answers honestly', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('ズームをリセット');
    expect(spoken[0]).toBe('文字サイズを確認できません');
  });
});

describe('find-in-page bare queries prompt for a term', () => {
  test.each(['ページ内を検索', 'ページ内で検索', 'この中から検索', '探して', '検索して'])(
    '"%s" prompts for a query', (phrase) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(phrase);
      expect(spoken[0]).toContain('検索する語');
    });
});

describe('small scroll steps', () => {
  test.each([['ちょっと上', 'up'], ['少し上へ', 'up'], ['もう少し上', 'up'],
    ['ちょっと下', 'down'], ['少し下へ', 'down'], ['もう少し下', 'down']])(
    '"%s" scrolls %s', (phrase, dir) => {
      const onScrollContent = jest.fn();
      const { vc } = makeVC({ onScrollContent });
      vc.processCommand(phrase);
      expect(onScrollContent).toHaveBeenCalled();
      const d = onScrollContent.mock.calls[0][0];
      expect(dir === 'up' ? d < 0 : d > 0).toBe(true);
    });
});

describe('read-aloud aliases', () => {
  test.each(['もう一回読んで', '最初から読み上げ', '最初から読み上げて',
    'このページを読み上げて', 'ページ全体を読み上げて'])(
    '"%s" starts read-aloud', (phrase) => {
      const onReadAloud = jest.fn(() => ['chunk']);
      const { vc } = makeVC({ onReadAloud });
      vc.processCommand(phrase);
      expect(onReadAloud).toHaveBeenCalled();
    });
});

describe('audio-trouble: hearing-side recovery guidance', () => {
  test.each(['聞こえない', '聞こえません', 'よく聞こえない', '音が出ない',
    '音が小さい', '音が聞こえない', '声が聞こえない', "can't hear", 'no sound'])(
    '"%s" speaks audio-command guidance', (phrase) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(phrase);
      expect(spoken[0]).toContain('音量');
      expect(vc.lastCommand.key).toBe('audio-trouble');
    });
});

describe('trouble aliases: performance complaints', () => {
  test.each(['動作が遅い', '重い', 'ページが重い', 'カクカクする',
    'フリーズした', '固まった'])('"%s" speaks recovery guidance', (phrase) => {
    const { vc, spoken } = makeVC();
    vc.processCommand(phrase);
    expect(spoken[0]).toContain('音声は動作中です');
  });
});

describe('battery-status aliases', () => {
  test.each(['電池残量', '充電残量', '残量は', '電源は', '電池残り'])(
    '"%s" reports battery status', (phrase) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(phrase);
      expect(spoken[0]).toContain('バッテリー');
    });
});
