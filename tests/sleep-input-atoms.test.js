/**
 * Sleep/input/adverbial atoms (round 77).
 *
 * Probe-driven: JA sleep twins ('おやすみ','寝る','スタンバイ','起きて') and
 * 'go to sleep'/'good night' had no route to sleep-mode — 'go to sleep' even
 * literal-navigated via go-to. Element gestures ('クリックして','押して',
 * '入力して') and adverbial rate forms ('ゆっくりと','丁寧に','急いで') were
 * NO-MATCH; '何を開いてる' mis-navigated instead of listing tabs;
 * '読み進めて'/'読み上げを進めて' executed page-forward via navigate's 進め.
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
    })
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

describe('sleep/wake twins → sleep-mode honest atom', () => {
  test.each(['おやすみ', 'おやすみなさい', '寝る', '寝かせて', '寝ます',
    'スタンバイ', 'スリープ', '起きて', '起きてよ', 'ウェイクアップ',
    'good night', 'go to sleep', 'wake me up'])(
    '"%s" explains sleep lives on the headset', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('sleep-mode');
      expect(last(vc)).toContain('ヘッドセット本体');
      expect(vc.onGoTo).not.toHaveBeenCalled();
    });
});

describe('element gestures/input → input-methods honest atom', () => {
  test.each(['入力して', '文字を入力', 'テキストを入力', '書き込んで',
    '入力欄', 'フォーカスして', 'カーソルを置いて', 'カーソルを当てて',
    'クリックして', '押して', 'タップして', '選択して',
    'click', 'click here', 'click it', 'tap', 'tap it'])(
    '"%s" explains available input methods', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('input-methods');
      expect(last(vc)).toContain('見つめて');
      expect(vc.onGoTo).not.toHaveBeenCalled();
    });
});

describe('collection question forms → tabs-list', () => {
  test.each(['何を開いてる', '開いているもの', '開いてるものは', '開いてるやつ'])(
    '"%s" lists open tabs instead of navigating', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('tabs-list');
      expect(vc.onGoTo).not.toHaveBeenCalled();
    });
});

describe('resume-reading continuations (navigate misroute fix)', () => {
  test.each(['読み進めて', '読み進め', '読み上げ続けて', '読み続けて',
    '続けて読んで', '読み上げを進めて'])(
    '"%s" resumes reading instead of page-forward', (p) => {
      const vc = makeVC();
      const spy = jest.fn();
      vc.resumeSpeaking = spy;
      run(vc, p);
      expect(key(vc)).toBe('resume-reading');
    });
});

describe('adverbial rate forms', () => {
  test.each(['ゆっくりと', '丁寧に', '丁寧に読んで', 'はっきりと',
    'はっきり言って', '正確に読んで', 'ゆっくりと読んで'])(
    '"%s" slows the speech rate', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('speech-slower');
    });
  test.each(['急いで', '早くして', '速くして', 'さっさと', '急いで読んで'])(
    '"%s" raises the speech rate', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('speech-faster');
    });
});

describe('reopen mis-phrase forms', () => {
  test.each(['さっき閉じたやつ', '閉じたばっかり', '間違って閉じた',
    '間違って閉じちゃった', '閉じる前のタブ'])(
    '"%s" reopens the closed tab', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('reopen-tab');
    });
});

describe('panel-distance / zoom / skip additions', () => {
  test.each(['近くで見せて', '近くで', '近くで読みたい'])(
    '"%s" pulls the panel nearer', (p) => {
      const vc = makeVC();
      const spy = jest.fn(() => 1.8);
      vc._onPanelDistance = spy;
      run(vc, p);
      expect(key(vc)).toBe('panel-distance');
      expect(spy).toHaveBeenCalledWith(-0.2);
    });
  test.each(['小さくして'])('"%s" pushes the panel away', (p) => {
    const vc = makeVC();
    const spy = jest.fn(() => 2.2);
    vc._onPanelDistance = spy;
    run(vc, p);
    expect(key(vc)).toBe('panel-distance');
    expect(spy).toHaveBeenCalledWith(0.2);
  });
  test('"ズームして" announces the current zoom', () => {
    const vc = makeVC();
    vc._onReaderScaleStatus = jest.fn(() => 1.5);
    run(vc, 'ズームして');
    expect(key(vc)).toBe('reader-scale-status');
    expect(last(vc)).toContain('1.5倍');
  });
  test.each(['飛ばして', '飛ばす', '読み飛ばす'])(
    '"%s" skips to the next paragraph', (p) => {
      const vc = makeVC();
      const spy = jest.fn(() => ({ index: 2, total: 5 }));
      vc._onParagraphStep = spy;
      run(vc, p);
      expect(key(vc)).toBe('next-paragraph');
      expect(spy).toHaveBeenCalledWith(1);
    });
});

describe('coexistence guards', () => {
  test.each([['進んで', 'navigate'], ['次に進んで', 'navigate'],
    ['ページを進めて', 'navigate'], ['戻る', 'back'],
    ['タブ一覧', 'tabs-list'], ['何が開いてる', 'tabs-list'],
    ['カーソル', 'input-methods'], ['sleep', 'sleep-mode'],
    ['一つ戻る', 'back'], ['大きくして', 'reader-size-up'],
    ['読み上げを再開', 'resume-reading']])(
    '"%s" stays with %s', (p, want) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe(want);
    });
});
