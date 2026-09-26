/**
 * Round 55 atoms — alias pass XII: trouble complaint coverage
 * ('何も見えない'/'真っ白'/'固まる'/'落ちた'/'クラッシュ'), audio-trouble
 * ('声が出ない'/'音がしない'), refresh '再起動', home 'トップページ'/
 * '開始ページ', hostname 'サイトを教えて', describe-tab
 * 'このサイトについて', line-status reading-position queries
 * ('今どこを読んでる'/'読み上げ位置'/'現在位置'), char-count length
 * forms ('記事の長さ'/'このページの長さ'), sentences-left remaining
 * forms ('残りの記事'/'未読'/'読み残し'), remaining-time 'あとどのくらい',
 * tabs-list forms ('タブの一覧'/'タブリスト'/'開いてるもの'/'一覧を読んで'),
 * tab-status count forms ('タブの数'/'ウィンドウの数'), bookmarks/history
 * read forms, bookmark-count 'お気に入りは何個', keyboard hide forms,
 * video-toggle/stop/status forms, reader-size bare '拡大'/'縮小',
 * jump-back 'この場所に戻って', percent-jump bare 'N%' and JA 'N割'.
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

describe('trouble: complaint coverage', () => {
  test.each([
    '何も見えない', '真っ白', '画面が白い', '映らない',
    '固まる', '落ちた', 'クラッシュした', 'クラッシュ',
    '画面が落ちた', 'アプリが落ちた'
  ])('"%s" gives recovery guidance', (phrase) => {
    const { vc, spoken } = makeVC();
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('trouble');
    expect(spoken[0]).toContain('リセンター');
  });
});

describe('audio-trouble: hearing complaints', () => {
  test.each(['声が出ない', '音がしない', '無音になった', '何も聞こえない'])(
    '"%s" gives audio recovery guidance', (phrase) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('audio-trouble');
      expect(spoken[0]).toContain('音量');
    }
  );
});

describe('refresh/home: restart + top-page phrasing', () => {
  test.each(['再起動', 'ブラウザを再起動して'])('"%s" reloads', (phrase) => {
    const { vc, tm } = makeVC();
    tm.tabs[tm.activeIndex].reload = jest.fn();
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('refresh');
  });

  test.each(['トップページ', '開始ページ', 'トップページに戻る'])(
    '"%s" opens home', (phrase) => {
      const { vc, spoken } = makeVC();
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('home');
      expect(spoken[0]).toBe('ホームに戻りました');
    }
  );

  test('"スタートページ" still opens top-sites', () => {
    const { vc } = makeVC();
    vc.processCommand('スタートページ');
    expect(vc.lastCommand.key).toBe('top-sites');
  });
});

describe('hostname/describe-tab: site phrasing', () => {
  test.each(['サイトを教えて', 'サイト名を教えて', 'このサイトのドメイン'])(
    '"%s" reads the hostname', (phrase) => {
      const { vc, spoken, tm } = makeVC();
      tm.tabs[tm.activeIndex].currentUrl = 'https://a.jp/x';
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('hostname');
      expect(spoken[0]).toContain('a.jp');
    }
  );

  test('"このサイトについて" describes the tab', () => {
    const { vc, spoken, tm } = makeVC();
    tm.tabs[tm.activeIndex].currentTitle = 'ニュース';
    vc.processCommand('このサイトについて');
    expect(vc.lastCommand.key).toBe('describe-tab');
    expect(spoken[0]).toContain('ニュース');
  });
});

describe('line-status: reading-position queries', () => {
  test.each([
    '今どこを読んでる', 'どこまで読んでる', '読み上げ位置',
    '読み上げ中の行', '読み上げ中の場所', '現在位置', '今の位置',
    '読み上げ中', '読み上げの位置'
  ])('"%s" answers position', (phrase) => {
    const onLineStatus = jest.fn(() => ({ index: 3, total: 10 }));
    const { vc, spoken } = makeVC({ onLineStatus });
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('line-status');
    expect(spoken[0]).toBe('現在3行目（全10行）');
  });

  test('"読み上げ中ですか" still answers speaking-status', () => {
    const onLineStatus = jest.fn(() => ({ index: 1, total: 2 }));
    const { vc } = makeVC({ onLineStatus });
    vc.speakingNow = true;
    vc.processCommand('読み上げ中ですか');
    expect(vc.lastCommand.key).toBe('speaking-status');
  });
});

describe('char-count: length forms', () => {
  test.each([
    '記事の長さ', 'このページの長さ', 'どのくらいの長さ',
    'どれくらいの長さ', '記事の長さは'
  ])('"%s" announces the count', (phrase) => {
    const onCharCount = jest.fn(() => 1234);
    const { vc, spoken } = makeVC({ onCharCount });
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('char-count');
    expect(spoken[0]).toBe('記事は1234文字です');
  });
});

describe('sentences-left/remaining-time: remaining forms', () => {
  test.each(['残りの記事', '残りのテキスト', '未読', '読み残し', '読み残した部分'])(
    '"%s" reports sentences left', (phrase) => {
      const onSentenceStatus = jest.fn(() => ({ index: 2, total: 7 }));
      const { vc, spoken } = makeVC({ onSentenceStatus });
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('sentences-left');
      expect(spoken[0]).toBe('あと5文です');
    }
  );

  test('"あとどのくらい" reports minutes left', () => {
    const onRemainingTime = jest.fn(() => 3);
    const { vc, spoken } = makeVC({ onRemainingTime });
    vc.processCommand('あとどのくらい');
    expect(vc.lastCommand.key).toBe('remaining-time');
    expect(spoken[0]).toBe('残り約3分です');
  });
});

describe('tabs-list/tab-status: strip forms', () => {
  test.each([
    'タブの一覧', 'タブリスト', 'タブ全部', '開いてるのは',
    '開いてるもの', 'すべてのタブを教えて', 'タブを全部読んで',
    '一覧を読んで', 'すべてのタブを読んで', '全部のタブ'
  ])('"%s" reads the tab list', (phrase) => {
    const { vc, spoken, tm } = makeVC();
    tm.tabs[0].currentTitle = 'ニュース';
    tm.tabs[1].currentTitle = 'メモ';
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('tabs-list');
    expect(spoken[0]).toContain('2個のタブ');
  });

  test.each(['タブの数', 'ウィンドウの数', 'タブの枚数'])('"%s" answers count', (phrase) => {
    const onTabStatus = jest.fn(() => ({ index: 1, total: 2 }));
    const { vc, spoken } = makeVC({ onTabStatus });
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('tab-status');
    expect(spoken[0]).toBe('2個のタブの1枚目を表示中');
  });
});

describe('bookmarks/history: read + favorite forms', () => {
  test.each(['ブックマークを読んで', 'お気に入りを読んで', 'お気に入り一覧を読んで'])(
    '"%s" reads the bookmark list', (phrase) => {
      const onBookmarkList = jest.fn(() => ['A', 'B']);
      const { vc, spoken } = makeVC({ onBookmarkList });
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('bookmarks-list');
      expect(spoken[0]).toContain('A');
    }
  );

  test.each(['履歴を読んで', '履歴を読み上げて'])('"%s" reads history', (phrase) => {
    const onHistoryList = jest.fn(() => ['C']);
    const { vc, spoken } = makeVC({ onHistoryList });
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('history-list');
    expect(spoken[0]).toContain('C');
  });

  test.each(['お気に入りは何個', 'お気に入りの数', 'お気に入りはいくつ'])(
    '"%s" counts bookmarks', (phrase) => {
      const onBookmarkList = jest.fn(() => ['A', 'B', 'C']);
      const { vc, spoken } = makeVC({ onBookmarkList });
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('bookmark-count');
      expect(spoken[0]).toBe('3個のブックマークがあります');
    }
  );

  test('"お気に入り一覧" still opens the panel', () => {
    const onBookmarkList = jest.fn(() => []);
    const { vc } = makeVC({ onBookmarkList });
    vc.processCommand('お気に入り一覧');
    expect(vc.lastCommand.key).toBe('bookmarks-open');
  });
});

describe('keyboard: hide/show forms', () => {
  test.each(['キーボードを隠して', 'キーボードをしまう', 'キーボードを収納', 'keyboard'])(
    '"%s" toggles the keyboard', (phrase) => {
      const vrKeyboard = { visible: false, show: jest.fn(), hide: jest.fn() };
      const { vc } = makeVC({ vrKeyboard });
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('keyboard');
      expect(vrKeyboard.show).toHaveBeenCalled();
    }
  );
});

describe('video: play/stop/status forms', () => {
  test.each(['動画を再生', '再生して', 'ポーズ'])('"%s" toggles video', (phrase) => {
    const onVideoToggle = jest.fn(() => 'playing');
    const { vc, spoken } = makeVC({ onVideoToggle });
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('video-toggle');
    expect(onVideoToggle).toHaveBeenCalled();
    expect(spoken[0]).toBe('再生を再開します');
  });

  test.each(['再生を止めて', '動画を停止'])('"%s" stops video', (phrase) => {
    const onVideoStop = jest.fn(() => true);
    const { vc, spoken } = makeVC({ onVideoStop });
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('video-stop');
    expect(onVideoStop).toHaveBeenCalled();
    expect(spoken[0]).toBe('動画を停止します');
  });

  test.each(['今どの辺', 'どの辺まで', '再生位置', '再生時間'])(
    '"%s" reports video position', (phrase) => {
      const onVideoStatus = jest.fn(() => ({ t: 75, d: 300 }));
      const { vc, spoken } = makeVC({ onVideoStatus });
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('video-status');
      expect(spoken[0]).toBe('1分15秒を再生中（全5分0秒）');
    }
  );
});

describe('reader-size: bare zoom words', () => {
  test('"拡大" enlarges the text', () => {
    const onReaderScale = jest.fn(() => 1.25);
    const { vc, spoken } = makeVC({ onReaderScale });
    vc.processCommand('拡大');
    expect(onReaderScale).toHaveBeenCalledWith(0.25);
    expect(spoken[0]).toContain('1.25倍');
  });

  test('"縮小" shrinks the text', () => {
    const onReaderScale = jest.fn(() => 0.75);
    const { vc, spoken } = makeVC({ onReaderScale });
    vc.processCommand('縮小');
    expect(onReaderScale).toHaveBeenCalledWith(-0.25);
    expect(spoken[0]).toContain('0.75倍');
  });
});

describe('jump-back: return phrasing', () => {
  test.each([
    'この場所に戻って', 'さっきの場所に戻って', '前の場所に戻って',
    '元の場所に戻って', 'さっきの位置に戻って'
  ])('"%s" jumps back', (phrase) => {
    const onJumpBack = jest.fn(() => true);
    const { vc, spoken } = makeVC({ onJumpBack });
    vc.processCommand(phrase);
    expect(onJumpBack).toHaveBeenCalled();
    expect(spoken[0]).toBe('元の場所に戻りました');
  });
});

describe('percent-jump: bare % and JA 割', () => {
  test.each([
    ['50%', 50], ['50%に', 50], ['3割', 30], ['7割', 70], ['10割', 100]
  ])('"%s" jumps to %d%%', (phrase, pct) => {
    const onReaderPercent = jest.fn(() => true);
    const { vc, spoken } = makeVC({ onReaderPercent });
    vc.processCommand(phrase);
    expect(vc.lastCommand.key).toBe('percent-jump');
    expect(onReaderPercent).toHaveBeenCalledWith(pct);
    expect(spoken[0]).toBe(`${pct}%に移動しました`);
  });
});

describe('pause-reading: interrupt phrasing', () => {
  test.each(['読み上げを中断', '中断して', '読み上げを中断する'])(
    '"%s" pauses narration', (phrase) => {
      const { vc } = makeVC();
      vc.pauseSpeaking = jest.fn();
      vc.processCommand(phrase);
      expect(vc.lastCommand.key).toBe('pause-reading');
      expect(vc.pauseSpeaking).toHaveBeenCalled();
    }
  );

  test('"一時停止" still toggles the video', () => {
    const onVideoToggle = jest.fn(() => 'paused');
    const { vc } = makeVC({ onVideoToggle });
    vc.pauseSpeaking = jest.fn();
    vc.processCommand('一時停止');
    expect(vc.lastCommand.key).toBe('video-toggle');
    expect(onVideoToggle).toHaveBeenCalled();
    expect(vc.pauseSpeaking).not.toHaveBeenCalled();
  });
});
