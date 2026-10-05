/**
 * Positional-tab & device-app atoms (round 64).
 *
 * Probe-driven: '右のタブに移動'/'タブ3に移動' literal-navigated via go-to,
 * '一つ右のタブ' was misrouted to tab-by-name's named lookup, and the whole
 * device-app family (メモ/タイマー/メール/音楽/テレビ…) was NO-MATCH or
 * worse. Voice Access parity: complaints are not commands, and an absent
 * app deserves an honest refusal pointing at what IS possible.
 */

let VoiceCommands;
try {
  VoiceCommands = require('../src/vr/input/VoiceCommands').VoiceCommands;
} catch {
  VoiceCommands = null;
}

function makeVC(opts = {}) {
  const spoken = [];
  const tm = opts.tabManager || {
    tabs: [
      {
        id: 'a',
        currentUrl: 'https://news.jp',
        currentTitle: 'ニュース',
        goBack: jest.fn(() => true),
        goForward: jest.fn(() => true)
      },
      {
        id: 'b',
        currentUrl: 'https://weather.jp',
        currentTitle: '天気',
        goBack: jest.fn(() => true),
        goForward: jest.fn(() => true)
      },
      {
        id: 'c',
        currentUrl: 'https://memo.jp',
        currentTitle: 'メモ',
        goBack: jest.fn(() => true),
        goForward: jest.fn(() => true)
      }
    ],
    activeIndex: 0,
    nextTab: jest.fn(),
    prevTab: jest.fn(),
    setActive: jest.fn(function (i) {
      this.activeIndex = i;
    }),
    moveTab: jest.fn(() => true),
    moveTabToStart: jest.fn(),
    moveTabToEnd: jest.fn()
  };
  const vc = new VoiceCommands({ enabled: true });
  vc.onGoTo = opts.onGoTo || jest.fn();
  vc.connectBrowser({ tabManager: tm, onGoTo: vc.onGoTo });
  vc.speak = jest.fn((s) => spoken.push(s));
  vc._spoken = spoken;
  vc._tm = tm;
  return vc;
}
const run = (vc, phrase) => vc.processCommand(phrase);

describe('positional tab phrases', () => {
  test.each([['右のタブに移動'], ['右のタブに'], ['右隣のタブ'], ['隣のタブ'], ['一つ右のタブ'], ['ひとつ右のタブ']])(
    '"%s" switches to next tab, never navigates',
    (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(vc._tm.nextTab).toHaveBeenCalled();
      expect(vc.onGoTo).not.toHaveBeenCalled();
    }
  );
  test.each([['左のタブに移動'], ['左のタブに'], ['左隣のタブ'], ['一つ左のタブ']])(
    '"%s" switches to previous tab, never navigates',
    (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(vc._tm.prevTab).toHaveBeenCalled();
      expect(vc.onGoTo).not.toHaveBeenCalled();
    }
  );
  test('positional phrases never hit the by-name lookup', () => {
    const vc = makeVC();
    run(vc, '一つ右のタブ');
    expect(vc._spoken[vc._spoken.length - 1] || '').not.toContain('ありません');
  });
  test('「タブNに移動/のN番目」selects tab N by index', () => {
    const vc = makeVC();
    run(vc, 'タブ2に移動');
    expect(vc._tm.setActive).toHaveBeenCalledWith(1);
    run(vc, 'タブの3番目');
    expect(vc._tm.setActive).toHaveBeenCalledWith(2);
    expect(vc.onGoTo).not.toHaveBeenCalled();
  });
  test('「タブを右に移動」still reorders (move-tab-right), not switch', () => {
    const vc = makeVC();
    run(vc, 'タブを右に移動');
    expect(vc._tm.moveTab).toHaveBeenCalled();
    expect(vc._tm.nextTab).not.toHaveBeenCalled();
  });
  test('「3番目に移動して」still moves the active tab (move-tab-to-n)', () => {
    const vc = makeVC();
    run(vc, '3番目に移動して');
    expect(vc._tm.moveTab).toHaveBeenCalled();
  });
});

describe('device-apps honest absence', () => {
  test.each([
    'メモして',
    'メモを取って',
    'メモを開いて',
    'タイマー',
    'タイマーをセット',
    'アラーム',
    'ストップウォッチ',
    'カレンダー',
    '予定を教えて',
    'リマインダー',
    '電話をかけて',
    '連絡先',
    'メール',
    'メールを開いて',
    'メールをチェック',
    '受信トレイ',
    '計算機',
    '音楽を再生',
    '音楽を聴きたい',
    'ラジオ',
    'テレビを見て'
  ])('"%s" answers honestly without navigating', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(vc.lastCommand?.key).toBe('device-apps');
    expect(vc._spoken[vc._spoken.length - 1]).toContain('ありません');
    expect(vc.onGoTo).not.toHaveBeenCalled();
  });
  test('「メモのタブ」 still does the named lookup (real tab search)', () => {
    const vc = makeVC();
    run(vc, 'メモのタブ');
    expect(vc._tm.setActive).toHaveBeenCalledWith(2);
  });
});

describe('media-search honest absence', () => {
  test.each(['画像検索', '動画検索', '画像を検索', '動画を検索', '画像を探して'])(
    '"%s" refuses instead of searching the literal word',
    (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(vc.lastCommand?.key).toBe('media-search');
      expect(vc._spoken[vc._spoken.length - 1]).toContain('まだできません');
      expect(vc.onGoTo).not.toHaveBeenCalled();
    }
  );
  test('「ニュースを検索して」 still web-searches normally', () => {
    const vc = makeVC();
    run(vc, 'ニュースを検索して');
    expect(vc.lastCommand?.key).toBe('web-search');
  });
});

describe('complaint-form aliases', () => {
  test.each(['早すぎる', 'ゆっくり言って', 'ゆっくり話して', 'もっとゆっくり', '聞き取れない'])(
    '"%s" slows the narration rate',
    (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(vc.lastCommand?.key).toBe('speech-slower');
    }
  );
  test.each(['読み上げが遅い', 'ナレーションが遅い'])('"%s" speeds the narration rate', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(vc.lastCommand?.key).toBe('speech-faster');
  });
  test('「遅すぎる」goes to trouble, not speech-faster', () => {
    const vc = makeVC();
    run(vc, '遅すぎる');
    expect(vc.lastCommand?.key).toBe('trouble');
  });
  test.each(['音が小さすぎる', '声が小さい', '声を大きく', '大きな声で'])('"%s" raises the volume', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(vc.lastCommand?.key).toBe('volume-up');
  });
  test.each(['声を小さく', 'うるさすぎる', '声が大きい'])('"%s" lowers the volume', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(vc.lastCommand?.key).toBe('volume-down');
  });
  test('「音が小さい」 keeps the audio-trouble answer (complaint→advice)', () => {
    const vc = makeVC();
    run(vc, '音が小さい');
    expect(vc.lastCommand?.key).toBe('audio-trouble');
  });
});

describe('collection & status aliases', () => {
  test.each(['あと何分で読み終わる', '読み終わりまで', '残りの時間'])('"%s" hits remaining-time', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(vc.lastCommand?.key).toBe('remaining-time');
  });
  test.each(['ページ数は', '全部で何ページ'])('"%s" hits reader-progress', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(vc.lastCommand?.key).toBe('reader-progress');
  });
  test('「読んだ履歴」 opens history', () => {
    const vc = makeVC();
    run(vc, '読んだ履歴');
    expect(vc.lastCommand?.key).toBe('history');
  });
  test.each(['さっきの記事', '開いたばかりのページ'])('"%s" hits history-latest', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(vc.lastCommand?.key).toBe('history-latest');
  });
  test.each(['タブを並べて', 'タブを左右に'])('"%s" hits sort-tabs honest answer', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(vc.lastCommand?.key).toBe('sort-tabs');
  });
  test.each(['通知はある', '通知がある', '新しい通知'])('"%s" hits read-notify', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(vc.lastCommand?.key).toBe('read-notify');
  });
  test.each(['女性の声で', '男性の声で', '別の声で', '高い声で'])('"%s" hits select-voice', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(vc.lastCommand?.key).toBe('select-voice');
  });
});
