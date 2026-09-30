/**
 * Help/rate/volume-alias atoms (round 73).
 *
 * Probe-driven: 'ヘルプを開いて'/'サポート' NO-MATCH (go-to lookahead blocked
 * nav but no command claimed), '曜日を教えて'-class questions were covered
 * last round — this round adds the describe/hostname/security question forms
 * ('これは何'/'誰のサイト'/'危険ですか'), read-rest forms ('最後まで読んで'),
 * speech-reset casual forms ('もとの速さに'), named volume targets
 * ('音量を最大'), and volume/mute verb forms ('声を上げて'/'音を切って').
 */

let VoiceCommands;
try { VoiceCommands = require('../src/vr/input/VoiceCommands').VoiceCommands; }
catch { VoiceCommands = null; }

function makeVC() {
  const spoken = [];
  const tm = {
    tabs: [
      { id: 'a', currentUrl: 'https://news.jp', currentTitle: 'ニュース', pinned: false },
    ],
    activeIndex: 0,
    setActive: jest.fn(function (i) { this.activeIndex = i; }),
    getActiveTab: jest.fn(function () { return this.tabs[this.activeIndex]; }),
    closeTab: jest.fn(() => true),
    newTab: jest.fn(() => ({ id: 'new' })),
  };
  const vc = new VoiceCommands({ enabled: true });
  vc.onGoTo = jest.fn();
  vc._onVolumeStatus = jest.fn(() => 40);
  vc._onVolume = jest.fn();
  vc._onMute = jest.fn((want) => (want === undefined ? true : want));
  vc.connectBrowser({ tabManager: tm, onGoTo: vc.onGoTo });
  vc.speak = jest.fn((s) => spoken.push(s));
  vc._spoken = spoken;
  vc._tm = tm;
  return vc;
}
const run = (vc, phrase) => vc.processCommand(phrase);
const key = (vc) => vc.lastCommand?.key;
const last = (vc) => vc._spoken[vc._spoken.length - 1] || '';

describe('help additions', () => {
  test.each(['ヘルプを開いて', 'ヘルプを出して', 'サポート', 'サポートを開いて',
    '問い合わせ', 'やり方は', 'やり方を教えて', '使い方はどこ'])(
    '"%s" reads the help listing', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('help');
      expect(last(vc)).toContain('コマンド');
      expect(vc.onGoTo).not.toHaveBeenCalled();
    });
});

describe('page-question forms', () => {
  test.each(['これは何', '何これ', 'このページは何', '何のページ',
    'ページは何', 'どんなページだ', '説明して',
    '説明してほしい', '内容は'])(
    '"%s" describes the active tab', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('describe-tab');
      expect(last(vc)).toContain('ニュース');
    });
  test.each(['誰のサイト', 'どこのサイトですか', 'URLはどこ', 'アドレスはどこ',
    'サイトのアドレス', 'どこのページ'])(
    '"%s" announces the hostname', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('hostname');
      expect(last(vc)).toContain('news.jp');
    });
  test.each(['危険ですか', '危ないですか', '暗号化されてる',
    '暗号化されている', '暗号化されてますか', '接続は安全', '通信は安全'])(
    '"%s" reports the security state', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('security-status');
      expect(last(vc)).toContain('暗号化');
    });
});

describe('read-rest & read-all forms', () => {
  test.each(['最後まで読んで', 'あと全部読んで', '残り全部', 'あとを読んで',
    'この先を読んで', '続きをすべて読んで'])(
    '"%s" reads from here (rest)', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('read-here');
    });
  test.each(['全部読み上げて', '全部を読み上げて', '全てを読み上げて',
    'すべて読んで', 'すべてを読んで'])(
    '"%s" reads the whole article', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('read-aloud');
    });
});

describe('speech rate: reset & faster casual forms', () => {
  test.each(['標準の速さで', '普通の速さで', 'いつもの速さで', 'もとの速さに',
    'もとの速さに戻して', '速さを戻して', '速度リセット',
    '読み上げ速度を戻して', '読み上げをもとに戻して', 'スピードを戻して'])(
    '"%s" resets speech rate and pitch', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('speech-reset');
      expect(last(vc)).toContain('リセット');
      expect(vc._speechRate).toBe(1.0);
    });
  test.each(['早口で読んで', '速めで読んで', '速めに読んで'])(
    '"%s" speeds the narration', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('speech-faster');
    });
});

describe('volume: named targets & verb forms', () => {
  test.each([['音量を最大', 100], ['音量最大', 100], ['音量を最大にして', 100],
    ['音量を最小', 0], ['音量を最小に', 0], ['最小音量', 0],
    ['音量をゼロ', 0], ['音量をゼロにして', 0], ['volume zero', 0]])(
    '"%s" sets volume to %i', (p, want) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('volume-set');
      expect(vc._onVolume).toHaveBeenCalledWith((want - 40) / 100);
    });
  test.each(['声を大きくして', '声を上げて', 'ボリュームを上げて',
    'ボリュームアップ', 'ボリュームを大きく', '音を上げて'])(
    '"%s" raises the volume', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('volume-up');
      expect(vc._onVolume).toHaveBeenCalledWith(0.1);
    });
  test.each(['声を下げて', '声を小さくして', 'ボリュームを下げて',
    'ボリュームを小さく', 'ボリュームダウン', '音を下げて'])(
    '"%s" lowers the volume', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('volume-down');
      expect(vc._onVolume).toHaveBeenCalledWith(-0.1);
    });
});

describe('mute forms', () => {
  test.each(['音を切って', '音を切る'])('"%s" toggles mute', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('mute-toggle');
    expect(vc._onMute).toHaveBeenCalledWith(undefined);
  });
  test.each(['ミュート解除して', 'ミュートを外して', 'ミュートを解除して',
    '音をつけて', '音をならして', '音ありにして'])(
    '"%s" requests the unmuted state', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('mute-toggle');
      expect(vc._onMute).toHaveBeenCalledWith(false);
      expect(last(vc)).toContain('解除');
    });
});

describe('coexistence guards', () => {
  test.each([['音量を上げて', 'volume-up'], ['音量を下げて', 'volume-down'],
    ['ミュート', 'mute-toggle'], ['閲覧履歴', 'history-list'],
    ['読み直して', 'read-aloud'], ['続きを読んで', 'read-here'],
    ['このページは', 'where-am-i'],
    ['内容を教えて', 'article-summary'],
    ['音量を半分', 'volume-set']])('"%s" stays with %s', (p, want) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe(want);
  });
});
