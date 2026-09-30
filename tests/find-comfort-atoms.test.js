/**
 * Round 51 atoms — find-in-page scoped-search + quote stripping,
 * VR enter/exit aliases, say-again/echo aliases, heading/paragraph section
 * aliases, mute/volume natural JA phrases, unbookmark aliases, comfort
 * complaints on trouble.
 * External basis: Chrome 'find in page X' phrasing, Voice Access mute/quiet,
 * NVDA honest-guidance pattern for comfort complaints.
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

describe('find-in-page: scoped search + quote stripping', () => {
  test.each([
    ['ページ内で「テスト」を検索', 'テスト'],
    ['ページ内を「あ」で検索', 'あ'],
    ['「テスト」を探して', 'テスト'],
    ['『キーワード』を探して', 'キーワード']
  ])('"%s" searches for "%s" without the quotes', (phrase, term) => {
    const { vc, spoken, tm } = makeVC();
    const findInReader = jest.fn(() => 3);
    tm.getActiveTab().findInReader = findInReader;
    vc.processCommand(phrase);
    expect(findInReader).toHaveBeenCalledWith(term);
    expect(spoken[0]).toBe('3件見つかりました');
  });
  test('"ページ内を検索" still prompts for a term', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('ページ内を検索');
    expect(spoken[0]).toContain('検索する語');
  });
  test('"バナナを検索" still goes to web-search, not in-page', () => {
    const onGoTo = jest.fn();
    const { vc, tm } = makeVC({ onGoTo });
    const findInReader = jest.fn(() => 0);
    tm.getActiveTab().findInReader = findInReader;
    vc.processCommand('バナナを検索して');
    expect(findInReader).not.toHaveBeenCalled();
  });
});

describe('VR enter/exit aliases', () => {
  test.each(['VRを始める', 'VRモードに入る', 'VRモードで', '没入モード', 'VRを開始'])(
    '"%s" enters VR', (phrase) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('vr-enter');
      expect(spoken[0]).toBe('VRモードを開始します');
    });
  test.each(['VRを終了', 'VRをやめる', 'VRを出る'])('"%s" exits VR', (phrase) => {
    const { vc, spoken } = makeVC();
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('vr-exit');
    expect(spoken[0]).toBe('VRモードを終了します');
  });
});

describe('echo aliases', () => {
  test.each(['何を言った', '何を聞き取った', '今何を言った'])(
    '"%s" echoes the last transcript', (phrase) => {
      const { vc, spoken } = makeVC();
      // _prevTranscript is written by handleRecognitionResult (the ASR
      // path); inject the prior utterance directly — same state as a user
      // who just said '戻る' and then asks what was heard.
      vc._prevTranscript = '戻る';
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('say-last-transcript');
      expect(spoken[0]).toBe('「戻る」と聞き取りました');
    });
  test.each(['もう一回言って', '今の行をもう一度'])(
    '"%s" replays the last spoken message', (phrase) => {
      const { vc, spoken, tm } = makeVC();
      tm.getActiveTab().goBack = () => true;
      vc.processCommand('戻る');
      spoken.length = 0;
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('say-again');
      expect(spoken[0]).toBe('戻ります');
    });
});

describe('section/heading aliases', () => {
  test('"見出しを読み上げて" reads the current heading text', () => {
    const { vc, spoken, tm } = makeVC();
    tm.getActiveTab().headingHere = () => ({ text: '序章', index: 1, total: 5 });
    vc.processCommand('見出しを読み上げて');
    expect(spoken[0]).toBe('「序章」（1番目/全5）');
  });
  test('"次のセクション" steps to the next heading', () => {
    const { vc, tm } = makeVC();
    tm.getActiveTab().nextHeading = jest.fn(() => ({ index: 2, total: 5 }));
    vc.processCommand('次のセクション');
    expect(tm.getActiveTab().nextHeading).toHaveBeenCalledWith(1);
  });
  test('"前のセクション" steps back a heading', () => {
    const { vc, tm } = makeVC();
    tm.getActiveTab().prevHeading = jest.fn(() => ({ index: 0, total: 5 }));
    vc.processCommand('前のセクション');
    expect(tm.getActiveTab().prevHeading).toHaveBeenCalled();
  });
  test.each(['スキップして', '先読みして', '読み飛ばして'])(
    '"%s" advances a paragraph', (phrase) => {
      const onParagraphStep = jest.fn(() => ({ index: 2, total: 9 }));
      const { vc } = makeVC({ onParagraphStep });
      vc.processCommand(phrase);
      expect(onParagraphStep).toHaveBeenCalledWith(1);
    });
  test.each(['さっきの文', 'さっきの文を読んで'])(
    '"%s" steps back a sentence', (phrase) => {
      const onSentenceStep = jest.fn(() => ({ sentence: '前文。', line: 3 }));
      const { vc, spoken } = makeVC({ onSentenceStep });
      vc.processCommand(phrase);
      expect(onSentenceStep).toHaveBeenCalledWith(-1);
      expect(spoken[0]).toBe('前文。');
    });
});

describe('quiet/mute aliases', () => {
  test.each(['静かにして', '無音にして', '静音にして'])(
    '"%s" toggles mute', (phrase) => {
      const onMute = jest.fn(() => true);
      const { vc, spoken } = makeVC({ onMute });
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('mute-toggle');
      expect(onMute).toHaveBeenCalled();
    });
  test.each(['うるさい', '音が大きい'])('"%s" lowers volume', (phrase) => {
    const onVolume = jest.fn();
    const { vc } = makeVC({ onVolume });
    vc.processCommand(phrase);
    expect(onVolume).toHaveBeenCalledWith(-0.1);
  });
});

describe('unbookmark aliases', () => {
  test.each(['お気に入りから消して', 'お気に入りを外して', 'ブックマークから外して'])(
    '"%s" removes the bookmark', (phrase) => {
      const { vc, spoken, tm } = makeVC();
      const tab = tm.getActiveTab();
      tab.isBookmarked = () => true;
      tab.onToggleBookmark = jest.fn();
      vc.processCommand(phrase);
      expect(tab.onToggleBookmark).toHaveBeenCalled();
      expect(spoken[0]).toBe('ブックマークを外しました');
    });
});

describe('trouble aliases: comfort complaints', () => {
  test.each(['耳が痛い', '酔った', '気分が悪い', '目が疲れた',
    '滑らかじゃない', 'ヘッドセットが暑い'])(
    '"%s" speaks recovery guidance', (phrase) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(phrase);
      expect(spoken[0]).toContain('音声は動作中です');
    });
});
