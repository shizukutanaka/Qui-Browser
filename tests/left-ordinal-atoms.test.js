/**
 * Round 49 atoms — close-tabs-left (right twin), JA ordinal tab select,
 * '半分の音量' numeric, misroute fixes, and a sixth alias pass.
 * External basis: Chrome 'close tabs to the right' parity (the left twin),
 * Voice Access ordinal selection, Chrome 'new tab' phrasing.
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
  tm.newTab('https://c.jp');
  tm.tabs[0].currentTitle = 'Aサイト';
  tm.tabs[1].currentTitle = 'Bサイト';
  tm.tabs[2].currentTitle = 'Cサイト';
  tm.setActive(1);
  vc.connectBrowser({ tabManager: tm, ...opts });
  return { vc, spoken, tm };
}

describe('close-tabs-left: Chrome close-right twin', () => {
  test('TabManager.closeTabsToLeft() closes tabs left of active', () => {
    const { tm } = makeVC();
    expect(tm.closeTabsToLeft()).toBe(1);
    expect(tm.tabs.length).toBe(2);
    expect(tm.tabs[0].currentUrl).toBe('https://b.jp');
  });
  test.each(['左側のタブを閉じて', '左のタブを閉じて', 'close tabs to the left'])(
    '"%s" closes the left side', (phrase) => {
      const { vc, spoken, tm } = makeVC();
      vc.processCommand(phrase);
      expect(tm.tabs.length).toBe(2);
      expect(spoken[0]).toContain('閉じ');
    });
  test('"左のタブを閉じて" does not search a tab named 左', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('左のタブを閉じて');
    expect(spoken[0]).not.toContain('ありません');
  });
  test('right side still works', () => {
    const { vc, tm } = makeVC();
    vc.processCommand('右側のタブを閉じて');
    expect(tm.tabs.length).toBe(2);
    expect(tm.tabs[0].currentUrl).toBe('https://a.jp');
  });
});

describe('JA ordinal tab select: N番目のタブ', () => {
  test.each([['一番目のタブ', 0, 'Aサイト'], ['三番目のタブ', 2, 'Cサイト']])(
    '"%s" selects index %i', (phrase, idx, title) => {
      const { vc, spoken, tm } = makeVC();
      vc.processCommand(phrase);
      expect(tm.activeIndex).toBe(idx);
      expect(spoken[0]).toBe(title);
    });
  test('"二番目のタブ" selects index 1 from index 0', () => {
    const { vc, tm } = makeVC();
    tm.setActive(0);
    vc.processCommand('二番目のタブ');
    expect(tm.activeIndex).toBe(1);
  });
  test('out of range announces honestly', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('九番目のタブ');
    expect(spoken[0]).toBe('タブ9はありません');
  });
  test('bare numbered select still works', () => {
    const { vc, tm } = makeVC();
    vc.processCommand('タブ3');
    expect(tm.activeIndex).toBe(2);
  });
});

describe('volume-set: 半分', () => {
  test.each(['半分の音量', '音量を半分に', '音量半分'])(
    '"%s" sets volume to 50', (phrase) => {
      let v = null;
      const { vc, spoken } = makeVC({ onVolumeStatus: () => 80, onVolume: (d) => { v = d; } });
      vc.processCommand(phrase);
      expect(spoken[0]).toBe('音量を50%にしました');
      expect(v).toBeCloseTo(-0.3);
    });
});

describe('alias pass VI', () => {
  test.each(['ページを閉じて', 'サイトを閉じて'])('"%s" closes the tab', (p) => {
    const { vc, tm } = makeVC();
    const n = tm.tabs.length;
    vc.processCommand(p);
    expect(tm.tabs.length).toBe(n - 1);
  });
  test.each(['音を大きく', '音量を大きく'])('"%s" raises volume', (p) => {
    const { vc, spoken } = makeVC({ onVolume: () => 70 });
    vc.processCommand(p);
    expect(spoken[0]).toContain('音量');
  });
  test('"新しいタブで開いて" opens a tab', () => {
    const { vc, tm } = makeVC();
    vc.processCommand('新しいタブで開いて');
    expect(tm.tabs.length).toBe(4);
  });
  test.each(['アドレスバー', 'アドレスバーを見せて'])('"%s" opens URL input', (p) => {
    const { vc, tm } = makeVC();
    const onUrlInput = jest.fn();
    tm.getActiveTab().onUrlInputRequested = onUrlInput;
    vc.processCommand(p);
    expect(onUrlInput).toHaveBeenCalled();
  });
  test.each(['URLを表示', 'URLを読んで', 'アドレスを読んで'])('"%s" reads the URL', (p) => {
    const { vc, spoken } = makeVC();
    vc.processCommand(p);
    expect(spoken[0]).toContain('b.jp');
  });
  test.each(['お気に入り登録', 'お気に入りに登録', '後で読む', 'あとで読む'])(
    '"%s" bookmarks the page', (p) => {
      const onBookmarkPage = jest.fn();
      const { vc } = makeVC({ onBookmarkPage });
      vc.processCommand(p);
      expect(onBookmarkPage).toHaveBeenCalled();
    });
  test('"読書リスト" opens bookmarks', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('読書リスト');
    expect(spoken[0]).toContain('ブックマーク');
  });
  test.each(['ズームインして', '文字を拡大', 'ページを拡大'])('"%s" grows reader text', (p) => {
    const { vc, spoken } = makeVC({ onReaderScale: () => 1.25 });
    vc.processCommand(p);
    expect(spoken[0]).toContain('1.25');
  });
  test.each(['ズームアウトして', 'ページを縮小'])('"%s" shrinks reader text', (p) => {
    const { vc, spoken } = makeVC({ onReaderScale: () => 0.75 });
    vc.processCommand(p);
    expect(spoken[0]).toContain('0.75');
  });
});
