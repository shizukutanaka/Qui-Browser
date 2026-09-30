/**
 * EN-parity atoms (round 80): 'scroll to the top' (the-'the' gap in the
 * regex), bare 'slower'/'faster', 'what did you say', 'what page/site',
 * 'clear my history', reader-size EN forms, 'whats playing', 'am i online',
 * 'go offline' honest, stuck/crash complaints, replay-to-start, JA
 * 繰り返し/止めて forms.
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

describe('scroll edges EN', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['scroll to the top', 'jump to top'])(
    '「%s」 goes to the top', (p) => {
      const spy = jest.fn();
      vc._tabManager.getActiveTab().scrollToTop = spy;
      expect(run(vc, p)).toBe('scroll-top');
      expect(spy).toHaveBeenCalled();
    });
  test.each(['scroll to the bottom', 'jump to bottom'])(
    '「%s」 goes to the bottom', (p) => {
      const spy = jest.fn();
      vc._tabManager.getActiveTab().scrollToBottom = spy;
      expect(run(vc, p)).toBe('scroll-bottom');
      expect(spy).toHaveBeenCalled();
    });
  test('scroll to top still works (coexistence)', () => {
    expect(run(vc, 'scroll to top')).toBe('scroll-top');
  });
});

describe('speech rate bare + please forms', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['slower', 'slower please', 'more slowly'])(
    '「%s」 slows narration', (p) => expect(run(vc, p)).toBe('speech-slower'));
  test.each(['faster', 'faster please', 'more quickly'])(
    '「%s」 speeds narration', (p) => expect(run(vc, p)).toBe('speech-faster'));
});

describe('echo + replay', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['what did you say', 'what did it say', 'リピート',
    '今のを繰り返して', '今の言葉', 'さっきの言葉'])(
    '「%s」 repeats the last utterance', (p) => expect(run(vc, p)).toBe('say-again'));
  test.each(['もう一回再生', 'もう一度再生', 'リプレイ', 'play it again'])(
    '「%s」 restarts the video', (p) => {
      const spy = jest.fn(() => 0);
      vc._onVideoSeek = spy;
      expect(run(vc, p)).toBe('video-seek');
      expect(spy).toHaveBeenCalledWith(-1e9);
    });
});

describe('page/site + online queries', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['what page', 'what site'])(
    '「%s」 describes the tab', (p) => expect(run(vc, p)).toBe('describe-tab'));
  test.each(['what page is this', 'what site is this'])(
    '「%s」 answers where-am-i (earlier registration)', (p) => expect(run(vc, p)).toBe('where-am-i'));
  test.each(['am i online', 'am i offline', 'are we connected', 'is the internet working'])(
    '「%s」 answers online status', (p) => expect(run(vc, p)).toBe('online-status'));
  test.each(['whats playing', "what's playing", '何が再生されてる'])(
    '「%s」 reports video status', (p) => expect(run(vc, p)).toBe('video-status'));
  test('go offline gets the honest device-settings answer', () => {
    expect(run(vc, 'go offline')).toBe('device-settings');
  });
});

describe('history + text size EN forms', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(['clear my history', 'clear history', 'delete history', 'erase history'])(
    '「%s」 clears history', (p) => expect(run(vc, p)).toBe('clear-history'));
  test.each(['too small', 'make it bigger', 'text is too small', 'make the text bigger'])(
    '「%s」 enlarges reader text', (p) => expect(run(vc, p)).toBe('reader-size-up'));
  test.each(['make it smaller', 'text is too big', 'make the text smaller'])(
    '「%s」 shrinks reader text', (p) => expect(run(vc, p)).toBe('reader-size-down'));
});

describe('complaints + stops', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test.each(["i'm stuck", 'im stuck', 'something is wrong', 'it froze', 'it crashed'])(
    '「%s」 is a trouble complaint', (p) => expect(run(vc, p)).toBe('trouble'));
  test.each(['聞こえにくい', '聞きにくい'])(
    '「%s」 is an audio-trouble complaint', (p) => expect(run(vc, p)).toBe('audio-trouble'));
  test.each(['pause this', 'pause it'])(
    '「%s」 pauses narration', (p) => expect(run(vc, p)).toBe('pause-reading'));
  test.each(['これを止めて', '読むのを止めて'])(
    '「%s」 stops narration', (p) => expect(run(vc, p)).toBe('stop-reading'));
  test.each(['やめさせて', '全部やめて', '止めさせて'])(
    '「%s」 stops everything', (p) => expect(run(vc, p)).toBe('stop-everything'));
});

describe('panel-distance もうちょっと', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test('「もうちょっと大きく」 moves the panel nearer', () => {
    const spy = jest.fn(() => 1.8);
    vc._onPanelDistance = spy;
    expect(run(vc, 'もうちょっと大きく')).toBe('panel-distance');
    expect(spy).toHaveBeenCalledWith(-0.2);
  });
  test('「もうちょっと小さく」 moves the panel farther', () => {
    const spy = jest.fn(() => 2.2);
    vc._onPanelDistance = spy;
    expect(run(vc, 'もうちょっと小さく')).toBe('panel-distance');
    expect(spy).toHaveBeenCalledWith(0.2);
  });
});

describe('coexistence guards', () => {
  let vc;
  beforeEach(() => {
    vc = makeVC();
  });
  test('戻る still navigates back', () => {
    expect(run(vc, '戻る')).toBe('back');
  });
  test('ページの先頭 still scrolls top', () => {
    expect(run(vc, 'ページの先頭')).toBe('scroll-top');
  });
  test('pause still pauses', () => {
    expect(run(vc, 'pause')).toBe('pause-reading');
  });
  test('what time is it still answers the clock', () => {
    expect(run(vc, 'what time is it')).toBe('time');
  });
});
