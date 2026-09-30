/**
 * History/resume & privacy atoms (round 75).
 *
 * Probe-driven: history bare forms ('履歴消して'/'履歴を一覧'/'昨日の履歴'),
 * "when did I visit" questions ('いつ見た'/'さっきのページは'), other-app
 * histories ('再生履歴'/'視聴履歴'/'購入履歴' — honest absence), data-deletion
 * phrases ('キャッシュ削除'/'パスワードを消して'/'オートフィルを消して'),
 * resume-reading forms ('読みかけ'/'止めたところから'), finished-reading
 * status forms ('読み終わった'/'半分読んだ'), and remaining-time forms
 * ('何分残ってる') all had no route.
 */

let VoiceCommands;
try {
  VoiceCommands = require('../src/vr/input/VoiceCommands').VoiceCommands;
} catch {
  VoiceCommands = null;
}

function makeVC() {
  const spoken = [];
  const tm = {
    tabs: [{ id: 'a', currentUrl: 'https://news.jp', currentTitle: 'ニュース', pinned: false }],
    activeIndex: 0,
    setActive: jest.fn(function (i) {
      this.activeIndex = i;
    }),
    getActiveTab: jest.fn(function () {
      return this.tabs[this.activeIndex];
    }),
    closeTab: jest.fn(() => true)
  };
  const vc = new VoiceCommands({ enabled: true });
  vc.onGoTo = jest.fn();
  vc.connectBrowser({ tabManager: tm, onGoTo: vc.onGoTo });
  vc.speak = jest.fn((s) => spoken.push(s));
  vc._spoken = spoken;
  return vc;
}
const run = (vc, phrase) => vc.processCommand(phrase);
const key = (vc) => vc.lastCommand?.key;
const last = (vc) => vc._spoken[vc._spoken.length - 1] || '';

describe('privacy-clean data-deletion phrases (honest)', () => {
  test.each(['キャッシュ削除', 'キャッシュを削除', 'クッキー削除', 'クッキーを削除',
    'Cookieを削除', 'データを消して', 'ブラウザデータを消して',
    'フォームデータを消して', 'パスワードを消して', 'パスワードを削除して',
    '自動入力を消して', 'オートフィルを消して', 'ダウンロードを消して',
    'サイトデータを消して', '保存データを消して', 'clear browsing data'])(
    '"%s" explains honestly and points at history', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('privacy-clean');
      expect(last(vc)).toContain('履歴');
    });
});

describe('other-history honest atom', () => {
  test.each(['再生履歴', '視聴履歴', '購入履歴', '再生履歴を見せて',
    '視聴履歴を見せて', 'watch history', 'purchase history'])(
    '"%s" explains only browsing history exists', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('other-history');
      expect(last(vc)).toContain('履歴を読んで');
    });
});

describe('history-list bare/time forms', () => {
  test.each(['最近の履歴', 'さっきの履歴', '昨日の履歴', '今日の履歴',
    '履歴を一覧', '履歴を全部読んで', '履歴を確認'])(
    '"%s" reads the history list', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('history-list');
    });
});

describe('history-latest "when did I visit" questions', () => {
  test.each(['履歴はいつ', 'いつ見た', 'いつ見たっけ', 'いつ見たんだっけ',
    'さっき見たのは', 'さっきのページは', '前のページは', 'さっきのサイトは',
    '前に見たサイト', '最後に見たのは', '一番最後に見たページ'])(
    '"%s" announces the latest entry', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('history-latest');
    });
});

describe('clear-history additional forms', () => {
  test.each(['履歴消して', '履歴を消去して', '履歴を削除して', '履歴をクリアして'])(
    '"%s" clears history', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('clear-history');
    });
});

describe('resume-reading / read-here split', () => {
  test.each(['読みかけ', '読みかけを再開', 'さっきの続き', '中断したところから',
    '止めたところから', '読んでたところ', '前に読んでた', '止めたところから読んで'])(
    '"%s" resumes narration', (p) => {
      const vc = makeVC();
      const spy = jest.spyOn(vc, 'resumeSpeaking');
      run(vc, p);
      expect(key(vc)).toBe('resume-reading');
      expect(spy).toHaveBeenCalled();
    });
  test.each(['途中から', '途中から読み上げて', '途中から読み上げ'])(
    '"%s" reads from the current caret', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('read-here');
    });
});

describe('finished-reading status → reader-progress', () => {
  test.each(['読み終わった', '読み終わり', '読了', '読み終わったとき',
    '読み上げが終わった', '読み上げ終わった', '読み上げは終わった',
    'まだ読んでる', '読んでる途中', '半分読んだ', '半分まで読んだ', 'もう半分'])(
    '"%s" reports progress', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('reader-progress');
    });
});

describe('remaining-time additional forms', () => {
  test.each(['あとどのくらい読む', '何分残ってる', 'あと何分くらい', '残りは何分'])(
    '"%s" reports remaining minutes', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('remaining-time');
    });
});

describe('coexistence guards', () => {
  test.each([['閲覧履歴', 'history-list'], ['履歴を消して', 'clear-history'],
    ['さっき見たページ', 'back'], ['再開して', 'video-toggle'],
    ['さっき見たサイト', 'back'], ['続きを読んで', 'read-here'],
    ['パスワードを教えて', 'account'], ['検索履歴を消して', 'clear-history'],
    ['ダウンロード履歴', 'download'], ['履歴を見て', 'history']])('"%s" stays with %s', (p, want) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe(want);
  });
});
