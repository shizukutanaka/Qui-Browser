/**
 * Landmark/form/query atoms (round 81): screen-reader link-rotor phrasing,
 * form-field prompts, case transforms and select/copy honest answers,
 * 'go to main content' misroute fix, 'search the page for X', redo honest
 * twin of undo, caret word/char queries, rate/position/scale queries,
 * resume 'where i left off' forms, small-scroll amounts.
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

describe('link rotor forms (honest)', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['next link', 'previous link', 'prev link', 'links list',
    'link list', '前のリンク', 'リンクに進んで', 'リンクに戻って'])(
    '「%s」 gets the honest link-selection answer', (p) => {
      expect(run(vc, p)).toBe('links');
    });
  test('次のリンク still works (coexistence)', () => {
    expect(run(vc, '次のリンク')).toBe('links');
  });
});

describe('landmarks honest atom + misroute fix', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['next landmark', 'landmark list', 'main region', 'ランドマーク',
    'メインに飛んで', 'メインコンテンツ'])(
    '「%s」 gets the honest landmark answer', (p) => {
      expect(run(vc, p)).toBe('landmarks');
    });
  test.each(['go to main content', 'go to the content', 'jump to the nav'])(
    '「%s」 no longer literal-navigates', (p) => {
      expect(run(vc, p)).toBe('landmarks');
    });
  test('go to google still navigates (coexistence)', () => {
    expect(run(vc, 'go to google')).toBe('go-to');
  });
});

describe('form fields + case transforms (honest)', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['next field', 'previous field', 'form controls', 'edit box',
    'fill the form', 'text box', '次の入力欄', '前の入力欄', 'テキストボックス',
    'フォーム', 'フォームに入力'])(
    '「%s」 gets the input-methods answer', (p) => {
      expect(run(vc, p)).toBe('input-methods');
    });
  test.each(['all caps', 'uppercase', 'lowercase', 'capitalize', 'bold',
    '大文字にして', '小文字にして', '太字にして'])(
    '「%s」 gets the text-style answer', (p) => {
      expect(run(vc, p)).toBe('text-style');
    });
  test.each(['select all', 'copy page', 'copy the page', '全部選択して',
    'すべて選択して', 'テキストをコピー'])(
    '「%s」 gets the copy-selection answer', (p) => {
      expect(run(vc, p)).toBe('copy-selection');
    });
});

describe('redo honest twin of undo', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['redo', 'redo it', 'redo that', 'やり直して', 'やり直し'])(
    '「%s」 explains redo is unavailable', (p) => {
      expect(run(vc, p)).toBe('redo');
    });
  test('undo still reopens the closed tab (coexistence)', () => {
    expect(run(vc, 'undo')).toBe('reopen-tab');
  });
});

describe('find-in-page EN capture forms', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['search the page for banana', 'search this page for banana',
    'look for banana'])(
    '「%s」 searches the page', (p) => {
      const spy = jest.fn(() => 2);
      vc._tabManager.getActiveTab().findInReader = spy;
      expect(run(vc, p)).toBe('find-in-page');
      expect(spy).toHaveBeenCalledWith('banana');
    });
});

describe('shell + capability questions', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['quit the app', 'quit the browser'])(
    '「%s」 exits VR', (p) => expect(run(vc, p)).toBe('vr-exit'));
  test.each(['restart the app', 'reboot', 'reboot the headset',
    'ヘッドセットを再起動'])(
    '「%s」 gets the honest device-settings answer', (p) => {
      expect(run(vc, p)).toBe('device-settings');
    });
  test('再起動して reloads the page (refresh owns it)', () => {
    expect(run(vc, '再起動して')).toBe('refresh');
  });
  test.each(['what can you do', 'show me the commands', 'command list',
    'list commands', '何を聞けばいい'])(
    '「%s」 answers with help', (p) => expect(run(vc, p)).toBe('help'));
  test.each(['today is', "what's today"])(
    '「%s」 answers the date', (p) => expect(run(vc, p)).toBe('date'));
});

describe('caret word/char queries', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['what word is this', 'this word', '今の単語'])(
    '「%s」 answers word position', (p) => expect(run(vc, p)).toBe('word-status'));
  test.each(['what letter is this', 'this character', 'この文字', '今の文字'])(
    '「%s」 answers char position', (p) => expect(run(vc, p)).toBe('char-status'));
  test.each(['how is it spelled', 'how do you spell it', 'どう綴る', '綴りは'])(
    '「%s」 spells the word', (p) => expect(run(vc, p)).toBe('spell-word'));
});

describe('rate/panel/progress queries', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['what speed', '読む速さは', 'どのくらいの速さ', '読むスピード'])(
    '「%s」 answers speech rate', (p) => expect(run(vc, p)).toBe('speech-rate-status'));
  test.each(['where is the panel', 'center the panel', 'パネルを中央に',
    'パネルが見えない', 'パネルはどこ'])(
    '「%s」 recenters', (p) => expect(run(vc, p)).toBe('recenter'));
  test.each(['am i at the top', 'are we at the bottom', 'how far along',
    'ページの先頭にいる', 'どのくらい進んだ'])(
    '「%s」 answers progress', (p) => expect(run(vc, p)).toBe('reader-progress'));
  test.each(['拡大率', '倍率は', 'magnification level'])(
    '「%s」 answers scale', (p) => expect(run(vc, p)).toBe('reader-scale-status'));
  test('magnify enlarges text', () => {
    expect(run(vc, 'magnify')).toBe('reader-size-up');
  });
});

describe('small scrolls + resume + toc', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['scroll a little', 'a little bit down', 'tiny scroll',
    'もう少しだけ下', 'ごく少し下'])(
    '「%s」 scrolls down', (p) => expect(run(vc, p)).toBe('scroll-down'));
  test.each(['scroll up a little', 'a little bit up', 'もう少しだけ上'])(
    '「%s」 scrolls up', (p) => expect(run(vc, p)).toBe('scroll-up'));
  test.each(['continue from where i stopped', 'where i left off',
    'pick up where i left off', '続きはどこ', '続きから読んで'])(
    // '続きを読んで' stays with read-here — coexistence asserted below
    '「%s」 resumes reading', (p) => expect(run(vc, p)).toBe('resume-reading'));
  test.each(['目次はどこ', '目次は'])(
    '「%s」 reads the TOC', (p) => expect(run(vc, p)).toBe('toc'));
  test('この単語 still reads the word (coexistence)', () => {
    expect(run(vc, 'この単語')).toBe('read-word');
  });
  test('続きを読んで stays with read-here (coexistence)', () => {
    expect(run(vc, '続きを読んで')).toBe('read-here');
  });
  test('skip the paragraph advances one paragraph', () => {
    const spy = jest.fn(() => ({ index: 2, total: 5 }));
    vc._onParagraphStep = spy;
    expect(run(vc, 'skip the paragraph')).toBe('next-paragraph');
    expect(spy).toHaveBeenCalledWith(1);
  });
});
