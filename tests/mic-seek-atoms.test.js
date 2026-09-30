/**
 * Round 54 atoms — alias pass XI: mic-stop verb forms ('マイクを切って',
 * 'turn off the mic'), video-seek natural forms ('早送り', '巻き戻し',
 * 'fast forward', '少し戻して'), speech-rate verb/object forms
 * ('読み上げ速度を上げて/下げて', '話す速度を…', '速読して', 'ゆっくり'),
 * read-aloud whole-article forms ('全部読んで', 'read all',
 * 'from the beginning'), copy-url bare forms ('コピーして',
 * 'ページをコピー'), panel-size phrasing ('パネルを大きくして' nearer /
 * '画面を小さくして' farther — size words map to distance), title
 * ('タイトルを読んで', 'whats the title', 'read the title'), read-url
 * ('今のページのアドレス', 'whats the url', 'page address'),
 * speech-rate-status '再生速度', paste-go ('ペーストして', 'paste it').
 * External basis: Voice Access "microphone off"/"stop listening" wording,
 * Chrome "paste and go", media-key fast-forward/rewind parity.
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

describe('stop: mic-off phrasing', () => {
  test.each([
    'マイクを切って', 'マイクをオフにして', 'マイク停止',
    '聞き取りをやめて', '聞き取り停止', '聞くのをやめて',
    '音声認識を止めて', '音声認識を終了',
    'turn off the mic', 'turn the mic off', 'turn off the microphone'
  ])('"%s" stops listening', (phrase) => {
    const { vc } = makeVC();
    vc.recognition = { stop: jest.fn() };
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('stop');
    expect(vc.lastCommand.result.action).toBe('stop');
  });

  test('mic-status query is not stolen by stop', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('マイクの状態');
    expect(vc.lastCommand.key).toBe('mic-status');
    expect(spoken[0]).not.toBe('音声認識を停止します');
  });
});

describe('video-seek: natural forms', () => {
  test.each([
    ['早送り', 10],
    ['早送りして', 10],
    ['動画を早送り', 10],
    ['fast forward', 10],
    ['fast forward the video', 10],
    ['seek forward', 10],
    ['巻き戻し', -10],
    ['巻き戻す', -10],
    ['少し戻して', -10],
    ['10秒戻して', -10],
    ['30秒進めて', 30]
  ])('"%s" seeks %+d', (phrase, delta) => {
    const onVideoSeek = jest.fn(() => 42);
    const { vc, spoken } = makeVC({ onVideoSeek });
    vc.processCommand(phrase);
    expect(onVideoSeek).toHaveBeenCalledWith(delta);
    expect(spoken[0]).toMatch(/秒(戻り|進み)ました/);
  });

  test('no video answers honestly', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('早送り');
    expect(spoken[0]).toBe('再生中の動画がありません');
  });
});

describe('speech-rate: verb/object forms', () => {
  test.each([
    ['読み上げ速度を上げて', 'speech-faster'],
    ['読み上げの速度を上げて', 'speech-faster'],
    ['話す速度を上げて', 'speech-faster'],
    ['話すスピードを上げて', 'speech-faster'],
    ['速読して', 'speech-faster'],
    ['speed up the reading', 'speech-faster'],
    ['読み上げ速度を下げて', 'speech-slower'],
    ['読み上げの速度を下げて', 'speech-slower'],
    ['話す速度を下げて', 'speech-slower'],
    ['話すスピードを下げて', 'speech-slower'],
    ['ゆっくり', 'speech-slower'],
    ['slow down the reading', 'speech-slower']
  ])('"%s" routes %s', (phrase, key) => {
    const { vc } = makeVC();
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe(key);
  });
});

describe('speech-rate-status: playback-speed alias', () => {
  test.each(['再生速度', '再生速度は', '再生速度を教えて'])('"%s" announces rate', (phrase) => {
    const { vc, spoken } = makeVC();
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('speech-rate-status');
    expect(spoken[0]).toBe('読み上げ速度は1倍です');
  });
});

describe('read-aloud: whole-article forms', () => {
  test.each([
    '全部読んで', '全て読んで', '最初から読んで',
    'read all', 'read everything', 'read it all',
    'from the top', 'from the beginning', 'from the start'
  ])('"%s" starts read-aloud', (phrase) => {
    const onReadAloud = jest.fn(() => ['先頭', '次']);
    const { vc } = makeVC({ onReadAloud });
    vc.processCommand(phrase);
    expect(onReadAloud).toHaveBeenCalled();
    expect(vc.lastCommand.key).toBe('read-aloud');
  });

  test('"from the top" reads aloud, not scroll-top', () => {
    const onReadAloud = jest.fn(() => ['先頭']);
    const scroll = jest.fn();
    const { vc } = makeVC({ onReadAloud, onReaderScroll: scroll });
    vc.processCommand('from the top');
    expect(vc.lastCommand.key).toBe('read-aloud');
    expect(scroll).not.toHaveBeenCalled();
  });
});

describe('copy-url: bare copy forms', () => {
  test.each(['コピーして', 'ページをコピー', 'このページをコピー'])(
    '"%s" copies the URL', (phrase) => {
      const onCopyUrl = jest.fn(() => 'https://a.jp');
      const onCopyText = jest.fn();
      const { vc, spoken } = makeVC({ onCopyUrl, onCopyText });
      vc.processCommand(phrase);
      expect(onCopyUrl).toHaveBeenCalled();
      expect(onCopyText).not.toHaveBeenCalled();
      expect(spoken[0]).toBe('URLをコピーしました');
    }
  );
});

describe('panel-distance: size phrasing maps to distance', () => {
  test.each([
    ['パネルを大きくして', -0.2],
    ['パネルを大きく', -0.2],
    ['画面を大きくして', -0.2],
    ['ウィンドウを大きくして', -0.2],
    ['panel bigger', -0.2],
    ['パネルを小さくして', 0.2],
    ['画面を小さくして', 0.2],
    ['ウィンドウを小さくして', 0.2],
    ['panel smaller', 0.2]
  ])('"%s" moves panel %+d', (phrase, delta) => {
    const onPanelDistance = jest.fn(() => 1.8);
    const { vc } = makeVC({ onPanelDistance });
    vc.processCommand(phrase);
    expect(onPanelDistance).toHaveBeenCalledWith(delta);
  });
});

describe('title: read/question forms', () => {
  test.each([
    'タイトルを読んで', 'タイトルを教えて',
    'whats the title', 'read the title', 'read this title',
    'what is the title'
  ])('"%s" reads the title', (phrase) => {
    const { vc, spoken, tm } = makeVC();
    tm.tabs[tm.activeIndex].currentTitle = 'ニュース';
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('title');
    expect(spoken[0]).toBe('ニュース');
  });
});

describe('read-url: address phrasing', () => {
  test.each([
    '今のページのアドレス', '今のページのURL', 'ページURL', 'アドレスを言って',
    'whats the url', 'what is the address', 'page address', 'tab url'
  ])('"%s" reads the URL', (phrase) => {
    const { vc, spoken, tm } = makeVC();
    tm.tabs[tm.activeIndex].currentUrl = 'https://a.jp';
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('read-url');
    expect(spoken[0]).toBe('https://a.jp');
  });
});

describe('paste-go: shorter forms', () => {
  test.each(['ペーストして', 'ペーストして開いて', '貼り付けて', 'paste it', 'paste the clipboard'])(
    '"%s" resolves the clipboard', (phrase) => {
      const onPasteGo = jest.fn(() => Promise.resolve('貼り付け先へ移動します'));
      const { vc } = makeVC({ onPasteGo });
      vc.processCommand(phrase);
      expect(onPasteGo).toHaveBeenCalled();
      expect(vc.lastCommand.key).toBe('paste-go');
    }
  );

  test('no hook answers honestly', async () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('ペーストして');
    await Promise.resolve();
    await Promise.resolve();
    expect(spoken[0]).toBe('URLがコピーされていません');
  });
});

describe('coexistence guards', () => {
  test('"少し進めて" still navigates forward (video-seek does not steal it)', () => {
    const onVideoSeek = jest.fn();
    const { vc } = makeVC({ onVideoSeek });
    vc.processCommand('少し進めて');
    expect(vc.lastCommand.key).toBe('navigate');
    expect(vc.lastCommand.result.direction).toBe('forward');
    expect(onVideoSeek).not.toHaveBeenCalled();
  });

  test('"この行をコピー" still copies the line, not the URL', () => {
    const onCopyUrl = jest.fn();
    const onCopyLine = jest.fn(() => '一行目');
    const { vc } = makeVC({ onCopyUrl, onCopyLine });
    vc.processCommand('この行をコピー');
    expect(vc.lastCommand.key).toBe('copy-line');
    expect(onCopyUrl).not.toHaveBeenCalled();
  });
});
