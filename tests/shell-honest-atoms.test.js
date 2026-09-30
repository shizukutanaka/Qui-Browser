/**
 * Shell/share & honest-absence atoms (round 72).
 *
 * Probe-driven: 'プロフィールを開いて' literal-navigated, '閲覧履歴を見せて'
 * web-searched the word '閲覧履歴', '曜日を教えて' searched '曜日',
 * '読み上げを開始' literal-navigated, and share/scroll diminutives/
 * login/orientation/split-view had no surface at all.
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
  vc._onShare = jest.fn(() => Promise.resolve('共有しました'));
  vc.connectBrowser({ tabManager: tm, onGoTo: vc.onGoTo });
  vc.speak = jest.fn((s) => spoken.push(s));
  vc._spoken = spoken;
  vc._tm = tm;
  return vc;
}
const run = (vc, phrase) => vc.processCommand(phrase);
const key = (vc) => vc.lastCommand?.key;
const last = (vc) => vc._spoken[vc._spoken.length - 1] || '';

describe('share-page additions', () => {
  test.each(['ページを送って', 'このページを送って', '友達に送って',
    '友達に共有', 'リンクを共有', 'シェアして', 'シェアする'])(
    '"%s" shares the page', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('share-page');
    });
});

describe('collection-locators & clears', () => {
  test.each(['お気に入りはどこ', 'ブックマークはどこ', 'お気に入りはどこにある'])(
    '"%s" opens the bookmarks panel', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('bookmarks-open');
    });
  test.each(['履歴はどこ', '閲覧履歴を見せて', '履歴はどこにある'])(
    '"%s" opens history, not a web search (misroute fix)', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('history');
      expect(vc.onGoTo).not.toHaveBeenCalled();
    });
  test.each(['お気に入りを全部消して', 'ブックマークを全部削除',
    'ブックマークを全部消して', 'お気に入りをすべて消して',
    'delete all bookmarks', 'clear all favorites'])(
    '"%s" honestly refuses bulk bookmark deletion', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('clear-bookmarks');
      expect(last(vc)).toContain('ブックマークを外して');
    });
  test.each(['ダウンロード履歴', 'ダウンロードしたファイル', 'ダウンロード一覧'])(
    '"%s" explains downloads are unavailable', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('download');
      expect(last(vc)).toContain('できません');
    });
});

describe('date/time additions', () => {
  test.each(['日付は', '曜日を教えて', '曜日は何', '今日の曜日', '日付は何'])(
    '"%s" answers the date, not a web search', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('date');
      expect(last(vc)).toContain('曜日');
      expect(vc.onGoTo).not.toHaveBeenCalled();
    });
});

describe('scroll diminutives & sweep forms', () => {
  test.each(['もうちょっと下', 'もうちょっと下へ', 'ちょっとだけ下',
    '少しだけ下', 'ちょびっと下', '次にめくって', 'ページをめくる', 'めくる'])(
    '"%s" scrolls down', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('scroll-down');
    });
  test.each(['もうちょっと上', 'もうちょっと上へ', 'ちょっとだけ上',
    '少しだけ上', 'ちょびっと上'])('"%s" scrolls up', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('scroll-up');
  });
  test.each(['どんどん下へ', 'ずっと下', '一番下まで一気に',
    '一気に最後まで', 'ずっと下へ'])('"%s" jumps to the bottom', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('scroll-bottom');
  });
});

describe('read-aloud / narration forms (go-to misroute fix)', () => {
  test.each(['読み上げを開始', '読み上げを開始して', '音読を開始',
    '読み始めて', '音読して', '読み聞かせて', 'もう一回最初から',
    '最初からやり直し', '初めから', '最初から読み直して'])(
    '"%s" starts reading instead of navigating', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('read-aloud');
      expect(vc.onGoTo).not.toHaveBeenCalled();
    });
  test.each(['声を止めて', '声を止めろ', '喋るのをやめて', '喋るな', '黙って'])(
    '"%s" stops the narration', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('stop-reading');
    });
  test.each(['どんどん進んで', 'どんどん読んで'])(
    '"%s" resumes the narration', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('resume-reading');
    });
});

describe('translate additions', () => {
  test.each(['この文を翻訳して', '英語に訳して', '日本語に訳して',
    '中国語に訳して', '文章を翻訳', '文章を翻訳して', '訳して', '翻訳'])(
    '"%s" opens the translate page', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('translate-page');
    });
});

describe('trouble additions (comfort/display complaints)', () => {
  test.each(['画面がちらつく', 'ちらつく', '点滅してる', '画面が揺れる',
    '画面が乱れる', '文字化け', '文字化けしてる', 'フォントがおかしい',
    '表示がおかしい', '崩れてる', '酔いそう'])(
    '"%s" gets spoken recovery guidance', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('trouble');
      expect(last(vc)).toContain('リセンター');
    });
});

describe('honest-absence atoms: account / orientation / split-view', () => {
  test.each(['ログインして', 'ログアウトして', 'サインイン', 'サインアウト',
    'ログイン', 'アカウント', 'アカウント設定', 'プロフィール',
    'プロフィールを開いて', 'パスワード', 'パスワードを教えて',
    'パスワードを変えて', 'ユーザー名',
    'log in', 'sign out', 'my account'])(
    '"%s" explains account features are site-side', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('account');
      expect(last(vc)).toContain('サイト内');
      expect(vc.onGoTo).not.toHaveBeenCalled();
    });
  test.each(['縦にして', '横にして', '横向きにして', '縦向きにして',
    '回転して', '画面を回転', '画面を横向き', '向きを変えて',
    'rotate the screen', 'landscape mode'])(
    '"%s" explains panels cannot rotate', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('orientation');
      expect(last(vc)).toContain('ありません');
    });
  test.each(['ウィンドウを2つ', '分割して', '2画面にして', '画面を分割',
    '画面を2つに', 'マルチウィンドウ', '分割表示', '二画面にして',
    'split the screen', 'split view'])(
    '"%s" explains split view and points at new-tab', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('split-view');
      expect(last(vc)).toContain('新しいタブ');
    });
  test.each(['タブを整理して', 'タブを整理', '整理して', '片付けて',
    'タブを片付けて', 'タブをまとめて', 'organize the tabs'])(
    '"%s" points at ordinal move instead of auto-sort', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('sort-tabs');
      expect(last(vc)).toContain('番目に移動');
    });
});

describe('misc aliases', () => {
  test.each(['フルスクリーンで見たい', '全画面表示して', 'フルスクリーンで',
    '全画面で見たい', 'フルスクリーンにしたい'])(
    '"%s" enters fullscreen/VR', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('vr-enter');
    });
  test.each(['通知を止めて', '通知をオフ', '通知をミュート', '通知を消してほしい'])(
    '"%s" dismisses the notification', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('dismiss-notify');
    });
  test.each(['通知設定'])('"%s" opens the settings panel', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('settings-toggle');
  });
  test.each(['フルスクリーンを閉じて', 'exit fullscreen'])(
    '"%s" still exits (coexistence)', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('vr-exit');
    });
  test('"閲覧履歴" bare stays with history-list (coexistence)', () => {
    const vc = makeVC();
    run(vc, '閲覧履歴');
    expect(key(vc)).toBe('history-list');
  });
  test.each(['履歴を消して', 'ページをめくって'])(
    '"%s" keeps its owner (coexistence)', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe(p === '履歴を消して' ? 'clear-history' : 'scroll-down');
    });
});
