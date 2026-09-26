/**
 * Device-settings / calc / video-time atoms (round 71).
 *
 * Probe-driven: 'Wi-Fiを切って' was answered by online-status ('オンライン
 * です' — a toggle request answered with a status), '1分進めて' ran
 * navigate goForward, 'チュートリアルを開いて' literal-navigated, '10割る3'
 * was eaten by percent-jump's N割 rule, and selection/link copy + calc had
 * no surface at all.
 */

let VoiceCommands;
try { VoiceCommands = require('../src/vr/input/VoiceCommands').VoiceCommands; }
catch { VoiceCommands = null; }

function makeVC() {
  const spoken = [];
  const tm = {
    tabs: [
      { id: 'a', currentUrl: 'https://news.jp', currentTitle: 'ニュース', pinned: false },
      { id: 'b', currentUrl: 'https://weather.jp', currentTitle: '天気', pinned: true },
    ],
    activeIndex: 0,
    setActive: jest.fn(function (i) { this.activeIndex = i; }),
    getActiveTab: jest.fn(function () { return this.tabs[this.activeIndex]; }),
    closeTab: jest.fn(() => true),
    newTab: jest.fn(() => ({ id: 'new' })),
  };
  const vc = new VoiceCommands({ enabled: true });
  vc.onGoTo = jest.fn();
  vc._onVideoSeek = jest.fn(() => 0);
  vc.connectBrowser({ tabManager: tm, onGoTo: vc.onGoTo });
  vc.speak = jest.fn((s) => spoken.push(s));
  vc._spoken = spoken;
  vc._tm = tm;
  return vc;
}
const run = (vc, phrase) => vc.processCommand(phrase);
const key = (vc) => vc.lastCommand?.key;
const last = (vc) => vc._spoken[vc._spoken.length - 1] || '';

describe('device-settings honest atom (radio/passthrough toggles)', () => {
  test.each(['Wi-Fiを切って', 'Wi-Fiをつけて', 'WiFiを切って', 'ワイファイを切って',
    'Bluetoothをつけて', 'Bluetoothを切って', 'Bluetooth',
    '機内モード', '機内モードにして', 'パススルーにして',
    '周りが見えるようにして', 'ガーディアンを設定', 'カメラを起動',
    'バッテリーを節約', '節電モード',
    'turn off the wifi', 'turn on bluetooth', 'airplane mode', 'passthrough'])(
    '"%s" explains the headset OS owns it', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('device-settings');
      expect(last(vc)).toContain('ヘッドセット');
    });
  test.each(['Wi-Fiは', 'オンラインか', 'are we online'])(
    '"%s" stays a status query (coexistence)', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('online-status');
      expect(last(vc)).toContain('オンライン');
    });
});

describe('calc atom (spoken arithmetic)', () => {
  test.each([
    ['1足す2は', '3です'], ['10掛ける5', '50です'], ['5引く8', '-3です'],
    ['10割る3', '3.333333です'], ['3 plus 4', '7です'],
    ['10-4', '6です'], ['2×3', '6です'],
  ])('"%s" computes %s', (p, want) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('calc');
    expect(last(vc)).toBe(want);
  });
  test('"8 ÷ 0" refuses division by zero', () => {
    const vc = makeVC();
    run(vc, '8 ÷ 0');
    expect(key(vc)).toBe('calc');
    expect(last(vc)).toContain('ゼロでは割れません');
  });
  test.each(['計算して', '計算', '割り算', '足し算'])(
    '"%s" prompts for the expression', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('calc');
      expect(last(vc)).toContain('式を言ってください');
    });
  test.each(['3割', '50%', '真ん中まで'])(
    '"%s" stays a percent jump (coexistence)', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('percent-jump');
    });
  test('"10割る3" is arithmetic, not a 100% jump', () => {
    const vc = makeVC();
    run(vc, '10割る3');
    expect(key(vc)).toBe('calc');
  });
});

describe('video-seek minute/restart forms (time-seek misroute fix)', () => {
  test.each([
    ['1分進めて', 60], ['5分戻して', -300], ['30秒スキップ', 30],
    ['10秒戻って', -10], ['2分スキップ', 120],
  ])('"%s" seeks %d seconds', (p, delta) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('video-seek');
    expect(vc._onVideoSeek).toHaveBeenCalledWith(delta);
  });
  test.each(['頭から再生', '最初から再生', '最初から再生して',
    '動画を最初から'])(
    '"%s" restarts the video', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('video-seek');
      expect(vc._onVideoSeek).toHaveBeenCalledWith(-1e9);
    });
  test('"進んで" still navigates forward (coexistence)', () => {
    const vc = makeVC();
    run(vc, '進んで');
    expect(key(vc)).toBe('navigate');
  });
  test.each(['from the beginning', 'skip ahead'])(
    '"%s" keeps its earlier owner (coexistence)', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).not.toBe('video-seek');
    });
});

describe('video-status aliases', () => {
  test.each(['再生位置は', '再生時間は', 'あとどれくらいの動画',
    'どのくらいの動画', '動画の残り'])(
    '"%s" reports the video position honestly', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('video-status');
      expect(last(vc)).toContain('動画がありません');
    });
});

describe('help / trouble / device-apps additions', () => {
  test.each(['チュートリアルを開いて', 'チュートリアルを見せて', 'チュートリアル',
    '音声ガイドを読んで', 'ガイドを開いて', '使い方を見せて'])(
    '"%s" opens help instead of navigating', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('help');
      expect(vc.onGoTo).not.toHaveBeenCalled();
    });
  test.each(['コントローラーが効かない', 'コントローラーが反応しない',
    'コントローラーが動かない', 'ボタンが効かない', 'ボタンが反応しない',
    '操作が効かない'])('"%s" routes to trouble', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('trouble');
    expect(last(vc)).toContain('リセンター');
  });
  test.each(['メモをして', 'メモする', '5分タイマー', 'アラームをかけて',
    '目覚まし', '電卓', '計算機'])(
    '"%s" honestly explains the app is absent', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('device-apps');
      expect(last(vc)).toContain('このブラウザにはありません');
    });
});

describe('brightness / captions-toggle additions', () => {
  test.each(['もっと暗く', 'もっと暗くして', '暗くしてほしい', '暗くならない',
    '画面を暗くして', '暗くなって'])(
    '"%s" points at headset brightness (honest)', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('brightness');
      expect(last(vc)).toContain('本体の設定');
    });
  test.each(['キャプションを隠して', '字幕を隠して'])(
    '"%s" toggles captions', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('captions-toggle');
    });
});

describe('copy-selection honest atom', () => {
  test.each(['ここをコピー', 'ここをコピーして', '選択した部分をコピー',
    'この段落をコピー', '段落をコピー',
    'リンクのURLをコピー', 'リンク先をコピー',
    'copy this part', 'copy the selection'])(
    '"%s" points at the available copy surfaces', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('copy-selection');
      expect(last(vc)).toContain('まだできません');
      expect(last(vc)).toContain('記事をコピー');
    });
  test('"この行をコピー" stays copy-line (coexistence)', () => {
    const vc = makeVC();
    run(vc, 'この行をコピー');
    expect(key(vc)).toBe('copy-line');
  });
  test('"リンクをコピー" stays copy-url (coexistence)', () => {
    const vc = makeVC();
    run(vc, 'リンクをコピー');
    expect(key(vc)).toBe('copy-url');
  });
  test('"残り時間は" stays remaining-time (coexistence)', () => {
    const vc = makeVC();
    run(vc, '残り時間は');
    expect(key(vc)).toBe('remaining-time');
  });
});

describe('web-search topic shortcuts', () => {
  test.each([
    ['今日の天気', '今日の天気'], ['最新ニュース', '最新ニュース'],
    ['ニュース', 'ニュース'], ['天気を教えて', '天気'],
    ['面白い記事', '面白い記事'], ['おすすめの記事', 'おすすめの記事'],
    ['ニュースを見せて', 'ニュース'],
  ])('"%s" searches for "%s"', (p, term) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('web-search');
    expect(vc.onGoTo).toHaveBeenCalledWith(term);
  });
  test('"音声検索" still prompts for a term (coexistence)', () => {
    const vc = makeVC();
    run(vc, '音声検索');
    expect(key(vc)).toBe('web-search');
    expect(last(vc)).toContain('検索語がありません');
  });
  test('"使い方を教えて" stays help (coexistence)', () => {
    const vc = makeVC();
    run(vc, '使い方を教えて');
    expect(key(vc)).toBe('help');
  });
});

describe('misc aliases', () => {
  test.each(['あとで読み直す', 'あとで読み返す'])(
    '"%s" bookmarks the page', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('bookmark-page');
    });
  test.each(['読み上げを早送り', '読み上げを早送りして'])(
    '"%s" speeds up narration', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('speech-faster');
    });
});
