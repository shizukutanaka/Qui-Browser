/**
 * Page-turn/status atoms (round 79): colloquial page-turn + scroll
 * directions, line steppers ('行を進めて' was page-forwarding via
 * navigate!), voice/language chooser forms, honest pin/bookmark state
 * queries, error/freeze complaints, jump-back 'さっきのところ'.
 */
const VC = require('../src/vr/input/VoiceCommands').VoiceCommands;

function makeVC() {
  const vc = new VC({ enabled: true });
  const tm = {
    tabs: [{ currentTitle: 't', currentUrl: 'u', pinned: false, history: ['a', 'b'], historyIdx: 1 }],
    activeIndex: 0,
    getActiveTab() {
      return this.tabs[this.activeIndex];
    }
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.said = [];
  vc.speak = (s) => vc.said.push(s);
  return vc;
}
const run = (vc, p) => {
  vc.lastCommand = null; vc.processCommand(p); return vc.lastCommand ? vc.lastCommand.key : null;
};

describe('scroll direction colloquial', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['もっと下に', '下に行って', '下に向かって'])(
    '「%s」 scrolls down', (p) => expect(run(vc, p)).toBe('scroll-down'));
  test.each(['もっと上に', '上に行って', '上に向かって'])(
    '「%s」 scrolls up', (p) => expect(run(vc, p)).toBe('scroll-up'));
});

describe('page-turn forms', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['ページ送り', 'ページをめくれ'])(
    '「%s」 turns the page forward', (p) => expect(run(vc, p)).toBe('next-page'));
  test.each(['ページを戻して', 'ページを戻す'])(
    '「%s」 turns the page back', (p) => expect(run(vc, p)).toBe('prev-page'));
  test('ページをめくって still scrolls (coexistence)', () => {
    expect(run(vc, 'ページをめくって')).toBe('scroll-down');
  });
  test('ページを送って still shares (coexistence)', () => {
    expect(run(vc, 'ページを送って')).toBe('share-page');
  });
});

describe('line steppers', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['行を進めて', '一つ下へ', 'ひとつ下へ'])(
    '「%s」 steps to the next line without navigating', (p) => {
      const tab = vc._tabManager.getActiveTab();
      tab.goForward = jest.fn();
      expect(run(vc, p)).toBe('next-line');
      expect(tab.goForward).not.toHaveBeenCalled();
    });
  test.each(['行を戻って', '一つ上へ', 'ひとつ上へ'])(
    '「%s」 steps to the previous line', (p) => {
      const tab = vc._tabManager.getActiveTab();
      tab.goBack = jest.fn();
      expect(run(vc, p)).toBe('prev-line');
      expect(tab.goBack).not.toHaveBeenCalled();
    });
  test('進めて still page-forwards (coexistence)', () => {
    expect(run(vc, '進めて')).toBe('navigate');
  });
  test('ページを進めて still page-forwards (coexistence)', () => {
    expect(run(vc, 'ページを進めて')).toBe('navigate');
  });
  test('読み進めて still resumes reading (coexistence)', () => {
    expect(run(vc, '読み進めて')).toBe('resume-reading');
  });
});

describe('voice + language chooser', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['男の声で', '女の声で', '男性の声', '女性の声', '女の声にして', '男の声にして'])(
    '「%s」 picks another voice', (p) => expect(run(vc, p)).toBe('select-voice'));
  test.each(['言語を変えて', '言語を切り替えて', 'change language'])(
    '「%s」 asks which language instead of guessing', (p) => {
      expect(run(vc, p)).toBe('language-switch');
      expect(vc.said[0]).toMatch(/指定してください/);
    });
  test('日本語にして still switches (coexistence)', () => {
    expect(run(vc, '日本語にして')).toBe('language-switch');
    expect(vc.said[0]).toMatch(/日本語に切り替えました/);
  });
});

describe('reader text-size complaints', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['字が見えない', '字を大きく', '字を大きくして', 'ズームアップ'])(
    '「%s」 enlarges reader text', (p) => expect(run(vc, p)).toBe('reader-size-up'));
});

describe('state questions', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['お気に入りに入ってる', 'お気に入り済み', 'ブックマーク済み', '保存してる', '保存されてる'])(
    '「%s」 answers bookmark status', (p) => expect(run(vc, p)).toBe('bookmark-status'));
  test.each(['ピン留めしてる', 'ピンしてる', 'ピンされてる', 'ピン留めされてる'])(
    '「%s」 answers pin status', (p) => expect(run(vc, p)).toBe('pin-status'));
  test('音量を元に戻して → settings-reset honest answer', () => {
    expect(run(vc, '音量を元に戻して')).toBe('settings-reset');
  });
  test('頭から読んで reads aloud from the top', () => {
    expect(run(vc, '頭から読んで')).toBe('read-aloud');
  });
  test('さっきのところ jumps back', () => {
    expect(run(vc, 'さっきのところ')).toBe('jump-back');
  });
});

describe('error/freeze complaints', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['エラーが出た', 'エラーが出る', 'エラーが起きた', '止まった', 'とまった',
    '勝手に閉じた', '勝手に動いた', '開けない', 'タブが開けない'])(
    '「%s」 is a trouble complaint', (p) => expect(run(vc, p)).toBe('trouble'));
  test.each(['リンクが開けない', 'リンクを開けない'])(
    '「%s」 gets the honest links answer', (p) => expect(run(vc, p)).toBe('links'));
});

describe('returns', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test('帰ってきて navigates back', () => {
    expect(run(vc, '帰ってきて')).toBe('back');
  });
  test('戻る still navigates back (coexistence)', () => {
    expect(run(vc, '戻る')).toBe('back');
  });
});
