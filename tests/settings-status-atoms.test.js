/**
 * Round 52 atoms — settings-status (read-only query twin of the toggleCmd
 * family: a question must answer, never toggle), connection-status
 * (NetworkInformation API), date weekday, and alias pass IX
 * (private 'secret' phrases, language 'read in X', help/reopen/top-sites/
 * clear-history/trouble aliases).
 * External basis: Voice Access 'is X on' query parity, Chrome incognito
 * 'シークレットモード' wording, MDN NetworkInformation.
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
  vc.connectBrowser({ tabManager: tm, ...opts });
  return { vc, spoken, tm };
}

describe('settings-status: read-only query twin of the toggles', () => {
  test.each([
    ['字幕はオン', 'enableCaptions', 'キャプション'],
    ['キャプションはオン', 'enableCaptions', 'キャプション'],
    ['字幕ついてる', 'enableCaptions', 'キャプション'],
    ['キャプションはどう', 'enableCaptions', 'キャプション'],
    ['ハプティックはオン', 'enableHaptics', 'ハプティック'],
    ['振動はオン', 'enableHaptics', 'ハプティック'],
    ['注視選択はオン', 'enableGazeDwell', '注視選択'],
    ['視線選択はオン', 'enableGazeDwell', '注視選択'],
    ['凝視選択はオン', 'enableGazeDwell', '注視選択'],
    ['カーブパネルはオン', 'enableCurvedPanel', 'カーブパネル'],
    ['ウィンドウ追従はオン', 'enableWindowFollow', 'ウィンドウ追従'],
    ['スナップターンはオン', 'enableSnapTurn', 'スナップターン'],
    ['テレポートはオン', 'enableTeleport', 'テレポート'],
    ['コンフォートはオン', 'enableComfort', 'コンフォート'],
    ['サウスポーはオン', 'southpaw', 'サウスポー'],
    ['スムーズ移動はどう', 'enableSmoothMove', 'スムーズ移動'],
    ['are captions on', 'enableCaptions', 'キャプション'],
    ['are the subtitles off', 'enableCaptions', 'キャプション'],
    ['is snap turn on', 'enableSnapTurn', 'スナップターン'],
    ['is gaze on', 'enableGazeDwell', '注視選択'],
    ['is teleport enabled', 'enableTeleport', 'テレポート'],
    ['is curved panel active', 'enableCurvedPanel', 'カーブパネル']
  ])('"%s" queries %s without toggling', (phrase, key, label) => {
    const onSettingStatus = jest.fn(() => true);
    const onSettingToggle = jest.fn(() => true);
    const { vc, spoken } = makeVC({ onSettingStatus, onSettingToggle });
    vc.processCommand(phrase);
    expect(onSettingStatus).toHaveBeenCalledWith(key);
    expect(onSettingToggle).not.toHaveBeenCalled();
    expect(spoken[0]).toBe(`${label}はオンです`);
    expect(vc.lastCommand.key).toBe('settings-status');
  });

  test('off value answers オフです', () => {
    const onSettingStatus = jest.fn(() => false);
    const { vc, spoken } = makeVC({ onSettingStatus });
    vc.processCommand('スムーズ移動はオン');
    expect(spoken[0]).toBe('スムーズ移動はオフです');
  });

  test('absent getter answers honestly', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('字幕はオン');
    expect(spoken[0]).toBe('その設定の状態を確認できません');
  });

  test.each([
    ['キャプションをオン', 'enableCaptions'],
    ['字幕を消して', 'enableCaptions'],
    ['ハプティックをオフ', 'enableHaptics'],
    ['スナップターンをオフ', 'enableSnapTurn']
  ])('"%s" still toggles (not status)', (phrase, key) => {
    const onSettingStatus = jest.fn(() => true);
    const onSettingToggle = jest.fn(() => false);
    const { vc } = makeVC({ onSettingStatus, onSettingToggle });
    vc.processCommand(phrase);
    expect(onSettingToggle).toHaveBeenCalled();
    expect(onSettingToggle.mock.calls[0][0]).toBe(key);
    expect(onSettingStatus).not.toHaveBeenCalled();
  });
});

describe('captions-toggle aliases', () => {
  test.each(['キャプションを出して', 'キャプションを見せて', '字幕を出して'])(
    '"%s" toggles captions', (phrase) => {
      const onSettingToggle = jest.fn(() => true);
      const { vc } = makeVC({ onSettingToggle });
      vc.processCommand(phrase);
      expect(onSettingToggle).toHaveBeenCalled();
      expect(onSettingToggle.mock.calls[0][0]).toBe('enableCaptions');
    });
});

describe('private tab: secret-mode aliases + misroute fix', () => {
  test.each(['秘密のタブ', 'シークレットのタブ', 'プライベートのタブ',
    'シークレットモード', 'シークレットモードで開いて'])(
    '"%s" opens a private tab (not a name search)', (phrase) => {
      const { vc, spoken, tm } = makeVC();
      const spy = jest.spyOn(tm, 'newPrivateTab');
      vc.processCommand(phrase);
      expect(spy).toHaveBeenCalled();
      expect(spoken[0]).toBe('プライベートタブを開きました');
      expect(spoken[0]).not.toContain('のタブがありません');
    });

  test('"ニュースのタブ" still searches by name', () => {
    const { vc, spoken, tm } = makeVC();
    tm.tabs[0].currentTitle = 'ニュースサイト';
    vc.processCommand('ニュースのタブ');
    expect(spoken[0]).not.toBe('プライベートタブを開きました');
    expect(vc.lastCommand.key).toBe('tab-by-name');
  });
});

describe('date: weekday announced', () => {
  test.each(['今何曜日', '何曜日', '曜日は', '今日は何曜日', 'what day is it'])(
    '"%s" speaks the date with weekday', (phrase) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(phrase);
      expect(spoken[0]).toMatch(/今日は\d+月\d+日（[日月火水木金土]曜日）です/);
    });
});

describe('language-switch: read-in-language aliases', () => {
  test.each([
    ['英語で読んで', 'en-US', 'Switched to English'],
    ['読み上げ言語を英語', 'en-US', 'Switched to English'],
    ['英語で読み上げて', 'en-US', 'Switched to English'],
    ['日本語で読んで', 'ja-JP', '日本語に切り替えました'],
    ['読み上げ言語を日本語', 'ja-JP', '日本語に切り替えました'],
    ['日本語で読み上げて', 'ja-JP', '日本語に切り替えました']
  ])('"%s" switches narration language to %s', (phrase, lang, utterance) => {
    const { vc, spoken } = makeVC();
    vc.processCommand(phrase);
    expect(vc.language).toBe(lang);
    expect(spoken[0]).toBe(utterance);
  });
});

describe('help aliases', () => {
  test.each(['困った', 'わからない', 'ヘルプミー', '使い方を教えて'])(
    '"%s" reads the command list', (phrase) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(phrase);
      expect(spoken[0]).toContain('使用可能なコマンドは');
    });
});

describe('reopen-tab aliases', () => {
  test.each(['もとに戻して', '取り消し', '取り消して'])(
    '"%s" reopens the closed tab', (phrase) => {
      const { vc, tm } = makeVC();
      const spy = jest.spyOn(tm, 'reopenClosedTab');
      vc.processCommand(phrase);
      expect(spy).toHaveBeenCalled();
    });
});

describe('top-sites aliases', () => {
  test.each(['スタートページ', 'よく見るサイト', 'おすすめサイト', 'よく行くサイト'])(
    '"%s" opens top sites', (phrase) => {
      const onTopSites = jest.fn();
      const { vc } = makeVC({ onTopSites });
      vc.processCommand(phrase);
      expect(onTopSites).toHaveBeenCalled();
    });
});

describe('clear-history aliases', () => {
  test.each(['閲覧履歴を全部消して', '履歴を全部消して', '履歴を全部消す'])(
    '"%s" clears history', (phrase) => {
      const onClearHistory = jest.fn();
      const { vc } = makeVC({ onClearHistory });
      vc.processCommand(phrase);
      expect(onClearHistory).toHaveBeenCalled();
    });
});

describe('trouble: slow-network complaint', () => {
  test('"ネットが遅い" speaks recovery guidance', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('ネットが遅い');
    expect(spoken[0]).toContain('音声は動作中です');
  });
});

describe('connection-status', () => {
  test('absent NetworkInformation answers honestly', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('回線速度');
    expect(spoken[0]).toBe('通信情報を取得できません');
  });

  test('reports effectiveType and downlink when present', () => {
    const { vc, spoken } = makeVC();
    Object.defineProperty(globalThis.navigator, 'connection', {
      value: { effectiveType: '4g', downlink: 8.5 }, configurable: true
    });
    try {
      vc.processCommand('通信速度');
      expect(spoken[0]).toBe('接続状態: 4G、約8.5Mbpsです');
      vc.processCommand('ネットの速度');
      expect(spoken[1]).toContain('Mbps');
    } finally {
      delete globalThis.navigator.connection;
    }
  });
});
