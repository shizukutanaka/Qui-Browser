/**
 * Round 61 atoms — tab-search (Chrome "Search tabs"), read-notify
 * (caption readout twin), pin-list, honest-absence cluster, web-search
 * 'を見せて/見たい' forms, zoom-status aliases, caption direction fix.
 *
 * - tab-search: 'タブを検索して' was searching the WEB for 'タブ'
 *   (web-search owned /を検索/ — probe-verified), and 'Xのタブを探して'/
 *   'find the news tab' searched the PAGE via find-in-page's /を探して/+
 *   /find (.+)/ (probe-verified). Registered before find-in-page; bare
 *   forms prompt for a title, term forms switch to the match.
 * - read-notify: '最新の通知'/'read the notification' re-speaks the newest
 *   caption line via onReadNotify → CaptionSystem.lastLine(); nothing
 *   pending answers honestly.
 * - pin-list: pinned titles enumerated (Chrome has no spoken pinned
 *   surface — pin-count's readout twin).
 * - 'を見せて'/'を見たい'/'が見たい' → web-search; panel-scoped '見せて'
 *   (タブ/履歴/ブックマーク/設定/通知) keep their earlier owners.
 * - Honest-absence: reader-mode (always-on), dark-mode (points at
 *   high-contrast), brightness (headset OS domain), print, screenshot,
 *   sort-tabs (points at move-tab-to-n) — a plain answer beats
 *   '認識できませんでした', which can't tell phrase-failure from
 *   feature-absence.
 * - settings-toggle gained メニュー aliases ('メニューを開いて' was a
 *   go-to literal navigation — probe-verified misroute).
 * - onOff() gained 見せて|出して in the on-branch: '字幕を見せて' used to
 *   return undefined → blind TOGGLE, turning captions OFF when the user
 *   asked to see them.
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
      this.pinned = false;
      this.currentUrl = '';
      this.currentTitle = '';
      this.group = { position: { set: jest.fn() } };
      this.visible = false;
      this.disposed = false;
      this.findQueryValue = null;
      this.findCount = 0;
    }
    addToScene(parent) { this.parent = parent; }
    navigate(url) { this.currentUrl = url; }
    setVisible(v) { this.visible = !!v; }
    dispose() { this.disposed = true; }
    findInReader(q) { this.findQueryValue = q; return this.findCount; }
    findQuery() { return this.findQueryValue; }
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
  vc.speak = jest.fn((t) => spoken.push(t));
  vc.synthesis = { speak: () => {}, cancel: () => {}, speaking: false };
  const tm = new TabManager({
    scene: { add: jest.fn(), remove: jest.fn() },
    registerInteractable: jest.fn(),
    unregisterInteractable: jest.fn(),
    onNavigate: jest.fn(),
    maxTabs: 8
  });
  tm.newTab('https://news.jp');
  tm.newTab('https://weather.jp');
  tm.newTab('https://memo.jp');
  tm.tabs[0].currentTitle = 'ニュース';
  tm.tabs[1].currentTitle = '天気';
  tm.tabs[2].currentTitle = 'メモ';
  vc.connectBrowser({ tabManager: tm, ...opts });
  return { vc, spoken, tm };
}

describe('tab-search: web/page-search misroute fix', () => {
  test.each(['タブを検索', 'タブを検索して', 'タブを探して', 'タブをさがして',
    'タブを調べて', 'タブを探す', 'タブサーチ', 'find tab', 'tab search',
    'search my tabs'])(
    '"%s" prompts for a title — never searches the web or page', (p) => {
      const onGoTo = jest.fn();
      const { vc, spoken } = makeVC({ onGoTo });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('tab-search');
      expect(onGoTo).not.toHaveBeenCalled();
      expect(spoken[0]).toBe('タブの名前を言ってください');
    }
  );
  test.each(['ニュースのタブを探して', 'ニュースのタブを検索', 'ニュースのタブを検索して',
    'タブの中で天気を探して', 'find the weather tab',
    'search my tabs for weather'])(
    '"%s" switches to the matching tab — never a literal search', (p) => {
      const onGoTo = jest.fn();
      const { vc, spoken, tm } = makeVC({ onGoTo });
      tm.setActive(0);
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('tab-search');
      expect(onGoTo).not.toHaveBeenCalled();
      expect(spoken[0]).toMatch(/タブ\dに切り替えました/);
    }
  );
  test('"ニュースのタブを探して" activates the news tab', () => {
    const { vc, spoken, tm } = makeVC();
    tm.setActive(2);
    vc.processCommand('ニュースのタブを探して');
    expect(tm.activeIndex).toBe(0);
    expect(spoken[0]).toBe('タブ1に切り替えました。ニュース');
  });
  test('a missing title answers honestly without switching', () => {
    const { vc, spoken, tm } = makeVC();
    tm.setActive(2);
    vc.processCommand('xyzのタブを探して');
    expect(vc.lastCommand.key).toBe('tab-search');
    expect(tm.activeIndex).toBe(2);
    expect(spoken[0]).toBe('「xyz」のタブがありません');
  });
});

describe('read-notify: caption readout twin', () => {
  test.each(['通知を読んで', '通知を読み上げて', '最新の通知', '最近の通知',
    '最後の通知', '何を通知した', '通知の内容', '通知を見せて',
    '通知を表示して', '通知を確認', 'last notification',
    'read the notification', 'what was the notification'])(
    '"%s" re-speaks the newest caption line', (p) => {
      const onReadNotify = jest.fn(() => 'Wi-Fiが切断されました');
      const { vc, spoken } = makeVC({ onReadNotify });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('read-notify');
      expect(onReadNotify).toHaveBeenCalled();
      expect(spoken[0]).toBe('Wi-Fiが切断されました');
    }
  );
  test('empty queue answers honestly', () => {
    const onReadNotify = jest.fn(() => null);
    const { vc, spoken } = makeVC({ onReadNotify });
    vc.processCommand('最新の通知');
    expect(spoken[0]).toBe('通知はありません');
  });
  test('absent hook answers honestly', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('通知を読んで');
    expect(spoken[0]).toBe('通知はありません');
  });
});

describe('pin-list: pinned readout twin', () => {
  test.each(['ピン留め一覧', 'ピン留めのタブ一覧', 'ピンの一覧',
    'ピン留めを読んで', 'list pinned', 'read the pinned tabs'])(
    '"%s" reads pinned titles', (p) => {
      const { vc, spoken, tm } = makeVC();
      tm.tabs[0].pinned = true;
      tm.tabs[2].pinned = true;
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('pin-list');
      expect(spoken[0]).toBe('ピン留めは2個。ニュース、メモ');
    }
  );
  test('no pinned tabs answers honestly', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('ピン留め一覧');
    expect(spoken[0]).toBe('ピン留めタブはありません');
  });
});

describe('web-search 見せて/見たい forms', () => {
  test.each([['ニュースを見せて', 'ニュース'], ['画像を見せて', '画像'],
    ['写真を見たい', '写真'], ['動画が見たい', '動画'], ['地図を見せて', '地図'],
    ['マップを見せてほしい', 'マップ'], ['Xを見せて', 'X']])(
    '"%s" searches the web for "%s"', (p, term) => {
      const onGoTo = jest.fn();
      const { vc, spoken } = makeVC({ onGoTo });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('web-search');
      expect(onGoTo).toHaveBeenCalledWith(term);
      expect(spoken[0]).toBe(`「${term}」を検索します`);
    }
  );
  // Coexistence guards — panel-scoped '見せて' keeps its earlier owner.
  test('"タブを見せて" stays on tabs-list, never a web search', () => {
    const onGoTo = jest.fn();
    const { vc, spoken } = makeVC({ onGoTo });
    vc.processCommand('タブを見せて');
    expect(vc.lastCommand.key).toBe('tabs-list');
    expect(onGoTo).not.toHaveBeenCalled();
    expect(spoken[0]).toMatch(/個のタブ。/);
  });
  test.each([['履歴を見せて', 'history'], ['ブックマークを見せて', 'bookmarks-open'],
    ['設定を見せて', 'settings-toggle'], ['通知を見せて', 'read-notify']])(
    '"%s" keeps routing to %s', (p, key) => {
      const onGoTo = jest.fn();
      const { vc } = makeVC({ onGoTo });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe(key);
      expect(onGoTo).not.toHaveBeenCalled();
    }
  );
});

describe('settings メニュー aliases (go-to misroute fix)', () => {
  test.each(['メニュー', 'メニューを開いて', 'メニューを表示', 'メニューを見せて',
    '設定を表示して', '設定を見せて', '設定を出して', 'open the menu', 'show menu'])(
    '"%s" opens the settings panel — never navigates', (p) => {
      const onGoTo = jest.fn();
      const onSettingsPanel = jest.fn(() => true);
      const { vc, spoken } = makeVC({ onGoTo, onSettingsPanel });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('settings-toggle');
      expect(onGoTo).not.toHaveBeenCalled();
      expect(spoken[0]).toBe('設定を開きます');
    }
  );
});

describe('caption direction: 見せて/出して now mean ON', () => {
  test.each(['字幕を見せて', 'キャプションを見せて', '字幕を出して',
    'キャプションを出して'])(
    '"%s" requests ON — never a blind toggle', (p) => {
      const onSettingToggle = jest.fn(() => true);
      const { vc, spoken } = makeVC({ onSettingToggle });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('captions-toggle');
      expect(onSettingToggle).toHaveBeenCalledWith('enableCaptions', true);
      expect(spoken[0]).toBe('キャプション オンです');
    }
  );
  test('"字幕を消して" still requests OFF', () => {
    const onSettingToggle = jest.fn(() => false);
    const { vc } = makeVC({ onSettingToggle });
    vc.processCommand('字幕を消して');
    expect(onSettingToggle).toHaveBeenCalledWith('enableCaptions', false);
  });
});

describe('zoom-status aliases', () => {
  test.each(['ズームレベルは', 'ズームは何倍', '今のズーム', 'ズーム倍率',
    'what zoom level', 'whats the zoom', 'zoom level'])(
    '"%s" → reader-scale-status', (p) => {
      const onReaderScaleStatus = jest.fn(() => 1.5);
      const { vc, spoken } = makeVC({ onReaderScaleStatus });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('reader-scale-status');
      expect(spoken[0]).toBe('記事の文字サイズは1.5倍です');
    }
  );
});

describe('honest-absence cluster', () => {
  test.each(['リーダー表示', 'リーダーモード', 'リーダーモードにして',
    'シンプルな表示', '簡易表示', 'reader mode', 'easy reading'])(
    '"%s" → reader-mode (always-on answer)', (p) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('reader-mode');
      expect(spoken[0]).toBe('記事は常にリーダー表示で開きます');
    }
  );
  test.each(['ダークモード', 'ダークモードにして', 'ナイトモード', '夜モード',
    'dark mode', 'night mode', 'dark theme'])(
    '"%s" → dark-mode pointer', (p) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('dark-mode');
      expect(spoken[0]).toBe('ダークモードはありません。ハイコントラストモードが使えます');
    }
  );
  test.each(['明るくして', '暗くして', '明るさを上げて', '明るさを下げて',
    '画面を明るく', '画面を暗く', '輝度', 'brightness', 'brighter', 'dimmer',
    'make the screen brighter'])(
    '"%s" → brightness honest', (p) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('brightness');
      expect(spoken[0]).toBe('明るさはヘッドセット本体の設定で変更してください');
    }
  );
  test.each(['印刷して', 'プリントして', '印刷', 'プリント',
    'このページを印刷', 'print', 'print this page'])(
    '"%s" → print honest', (p) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('print');
      expect(spoken[0]).toBe('このブラウザでは印刷できません');
    }
  );
  test.each(['スクリーンショット', 'スクショ', '画面を撮って', '写真を撮って',
    '画面をキャプチャ', 'screenshot', 'take a screenshot', 'take a picture'])(
    '"%s" → screenshot honest', (p) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('screenshot');
      expect(spoken[0]).toBe('このブラウザではスクリーンショットを撮影できません');
    }
  );
  test.each(['タブを並び替えて', 'タブを並べ替えて', 'タブをソート',
    'タブ順を整えて', 'sort tabs', 'reorder my tabs'])(
    '"%s" → sort-tabs pointer', (p) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('sort-tabs');
      expect(spoken[0]).toBe('自動並び替えはありません。N番目に移動して、と言ってください');
    }
  );
});
