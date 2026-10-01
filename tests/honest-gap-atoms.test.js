/**
 * Round 63 atoms — complaint-form routing + honest-absence cluster II.
 *
 * - Negative/potential nav forms no longer EXECUTE navigation:
 *   '戻れない'/'戻れません' → back-status, '進めない'/'進めません' →
 *   forward-status (back's /戻[るれ]/ and navigate's /進[むめ]/ gained
 *   〜ない/〜ません/〜ます lookaheads in BOTH registerDefaultCommands and
 *   connectBrowser copies — probe-verified they executed goBack/goForward).
 * - '押せない'/'選べない'/'触れない'/'クリックできない' → trouble guidance.
 * - 'N行下/上に' → reader-scroll-lines ('下'=forward, '上'=back).
 * - 'Nつ先/前の段落' (digits + kanji) → paragraph-skip-n via the same
 *   _onParagraphStep relative stepper next/prev-paragraph use.
 * - Honest-absence cluster II — spoken refusal instead of NO-MATCH or a
 *   fake action: links ('リンクを開いて' was literal-navigating through
 *   go-to — probe-verified), input-methods, text-style, settings-reset,
 *   privacy-clean, download, sleep-mode.
 * - Alias pass XX: brightness complaints ('明るすぎる'/'眩しい'), dark-mode
 *   complaints ('背景を暗く'/'ブルーライト'), quiet forms ('おしゃべりを
 *   止めて'/'喋らないで' → stop-reading; '静音'/'サイレント'/'音なし' →
 *   mute-toggle), 'このタブをもう一つ' → duplicate-tab, 'タブを減らして' →
 *   close-tab, '共有したい'/'印刷したい' → share-page/print, content
 *   questions ('ここに書いてあること'/'何が書かれてる') → article-summary.
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

// ── Complaint / question nav forms answer, never navigate ────────────────────
describe('nav complaints → status, never navigation', () => {
  test.each(['戻れない', '戻れません', '戻れます', '戻れる'])(
    '"%s" answers back-status without calling goBack', (p) => {
      const { vc, tm, spoken } = makeVC();
      const spy = jest.fn();
      tm.tabs.forEach(t => { t.goBack = spy; });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('back-status');
      expect(spy).not.toHaveBeenCalled();
      expect(spoken.pop()).toMatch(/戻れ/);
    }
  );
  test.each(['進めない', '進めません'])(
    '"%s" answers forward-status without calling goForward', (p) => {
      const { vc, tm, spoken } = makeVC();
      const spy = jest.fn();
      tm.tabs.forEach(t => { t.goForward = spy; });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('forward-status');
      expect(spy).not.toHaveBeenCalled();
      expect(spoken.pop()).toMatch(/進め/);
    }
  );
  test('bare 戻れ imperative still navigates', () => {
    const { vc, tm } = makeVC();
    const spy = jest.fn(() => true);
    tm.tabs.forEach(t => { t.goBack = spy; });
    vc.processCommand('戻れ');
    expect(vc.lastCommand.key).toBe('back');
    expect(spy).toHaveBeenCalled();
  });
  test("'戻ってください' still reaches back via polite retry", () => {
    const { vc, tm } = makeVC();
    const spy = jest.fn(() => true);
    tm.tabs.forEach(t => { t.goBack = spy; });
    vc.processCommand('戻ってください');
    expect(vc.lastCommand.key).toBe('back');
  });
  test.each(['押せない', '選べない', '触れない', 'クリックできない',
    '押しても反応しない', '動きません'])(
    '"%s" → trouble guidance', (p) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('trouble');
      expect(spoken.pop()).toContain('リセンター');
    }
  );
});

// ── Counted reader navigation ────────────────────────────────────────────────
describe('counted scroll/paragraph moves', () => {
  test.each([['3行下に', 3], ['5行上に', -5], ['2行下', 2]])(
    '"%s" scrolls the reader by %i lines', (p, delta) => {
      const onReaderScroll = jest.fn(() => true);
      const { vc } = makeVC({ onReaderScroll });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('reader-scroll-lines');
      expect(onReaderScroll).toHaveBeenCalledWith(delta);
    }
  );
  test.each([['2つ先の段落', 2], ['二つ前の段落', -2], ['3個先の段落', 3],
    ['skip ahead 4 paragraphs', 4], ['go back 2 paragraphs', -2]])(
    '"%s" steps %i paragraphs', (p, delta) => {
      const onParagraphStep = jest.fn(() => ({ index: 3, total: 10 }));
      const { vc } = makeVC({ onParagraphStep });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('paragraph-skip-n');
      expect(onParagraphStep).toHaveBeenCalledWith(delta);
    }
  );
  test.each(['次の段落', '前の段落'])('"%s" still routes to next/prev-paragraph', (p) => {
    const { vc } = makeVC();
    vc.processCommand(p);
    expect(vc.lastCommand.key).toMatch(/^(next|prev)-paragraph$/);
  });
});

// ── Honest-absence cluster II ────────────────────────────────────────────────
describe('honest-absence cluster II', () => {
  test.each(['リンクを開いて', 'リンクに移動', 'リンク一覧', '最初のリンク',
    'ボタンを押して', 'list the links', 'open a link', 'click the button'])(
    '"%s" → links honest refusal (no literal navigation)', (p) => {
      const onGoTo = jest.fn();
      const { vc, spoken } = makeVC({ onGoTo });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('links');
      expect(spoken.pop()).toContain('直接選択はまだできません');
      expect(onGoTo).not.toHaveBeenCalled();
    }
  );
  test.each(['音声入力', 'ジェスチャー', '視線で選択', '目で選ぶ',
    'コントローラーで操作', 'マウスカーソル', 'hand tracking'])(
    '"%s" → input-methods answer', (p) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('input-methods');
      expect(spoken.pop()).toContain('視線と音声');
    }
  );
  test.each(['フォントを変えて', '明朝体にして', '行間を広げて',
    'change the font'])(
    '"%s" → text-style honest refusal', (p) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('text-style');
      expect(spoken.pop()).toContain('まだできません');
    }
  );
  test.each(['設定をリセット', '設定を初期化', 'reset the settings',
    'factory reset'])(
    '"%s" → settings-reset honest refusal', (p) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('settings-reset');
      expect(spoken.pop()).toContain('まだできません');
    }
  );
  test.each(['キャッシュを消して', 'Cookieを削除', 'clear the cache',
    'delete cookies'])(
    '"%s" → privacy-clean honest refusal', (p) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('privacy-clean');
      expect(spoken.pop()).toContain('履歴を消して');
    }
  );
  test.each(['ダウンロード', 'ダウンロードしたい', 'download this'])(
    '"%s" → download honest refusal', (p) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('download');
      expect(spoken.pop()).toContain('まだできません');
    }
  );
  test.each(['スリープして', '省電力モード', '電源を切って', 'sleep mode'])(
    '"%s" → sleep-mode honest refusal', (p) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('sleep-mode');
      expect(spoken.pop()).toContain('ヘッドセット本体');
    }
  );
});

// ── Alias pass XX ────────────────────────────────────────────────────────────
describe('alias pass XX', () => {
  test.each(['明るすぎる', '眩しい', 'まぶしい', '暗すぎる'])(
    '"%s" → brightness headset pointer', (p) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('brightness');
      expect(spoken.pop()).toContain('ヘッドセット本体');
    }
  );
  test.each(['背景を暗く', '目に優しく', 'ブルーライト', '夜用モード'])(
    '"%s" → dark-mode pointer', (p) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('dark-mode');
      expect(spoken.pop()).toContain('ハイコントラスト');
    }
  );
  test.each(['おしゃべりを止めて', '喋らないで', 'しゃべるな', '読まないで'])(
    '"%s" → stop-reading', (p) => {
      const { vc } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('stop-reading');
    }
  );
  test.each(['静音', 'サイレント', '音なし', '音を出さないで', '無音モード'])(
    '"%s" → mute-toggle', (p) => {
      const onMute = jest.fn(() => true);
      const { vc } = makeVC({ onMute });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('mute-toggle');
      expect(onMute).toHaveBeenCalled();
    }
  );
  test.each(['このタブをもう一つ', '同じタブをもう一つ', '今のタブをコピー'])(
    '"%s" → duplicate-tab', (p) => {
      const { vc, tm } = makeVC();
      const before = tm.tabs.length;
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('duplicate-tab');
      expect(tm.tabs.length).toBe(before + 1);
    }
  );
  test.each(['タブを減らして', 'タブを減らす'])(
    '"%s" → close-tab', (p) => {
      const { vc, tm } = makeVC();
      const before = tm.tabs.length;
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('close-tab');
      expect(tm.tabs.length).toBe(before - 1);
    }
  );
  test('共有したい → share-page', () => {
    const { vc } = makeVC({ onShare: () => 'リンクをコピーしました' });
    vc.processCommand('共有したい');
    expect(vc.lastCommand.key).toBe('share-page');
  });
  test('印刷したい → print honest refusal', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('印刷したい');
    expect(vc.lastCommand.key).toBe('print');
    expect(spoken.pop()).toContain('印刷できません');
  });
  test.each(['ここに書いてあること', 'ここに何が書いてある', '何が書かれてる',
    '内容を教えて', 'ページの内容を教えて'])(
    '"%s" → article-summary', (p) => {
      const { vc } = makeVC();
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('article-summary');
    }
  );
});

// ── Coexistence guards (designed-green: phrases that must keep their owner) ──
describe('coexistence', () => {
  test("'ミュートを解除' still clears mute, not toggles blindly", () => {
    const onMute = jest.fn(() => false);
    const { vc } = makeVC({ onMute });
    vc.processCommand('ミュートを解除');
    expect(onMute).toHaveBeenCalledWith(false);
  });
  test("'次の段落を読み上げ' style: bare forms unchanged", () => {
    const { vc } = makeVC();
    vc.processCommand('next paragraph');
    expect(vc.lastCommand.key).toBe('next-paragraph');
  });
  test("'履歴を消して' still clears history (privacy-clean only owns cache/cookie)", () => {
    const onClearHistory = jest.fn(() => true);
    const { vc } = makeVC({ onClearHistory });
    vc.processCommand('履歴を消して');
    expect(vc.lastCommand.key).toBe('clear-history');
    expect(onClearHistory).toHaveBeenCalled();
  });
  test("'充電は' still reaches battery-status (privacy/sleep didn't steal it)", () => {
    const { vc } = makeVC({ onBatteryStatus: () => ({ level: 0.8, charging: true }) });
    vc.processCommand('充電は');
    expect(vc.lastCommand.key).toBe('battery-status');
  });
});
