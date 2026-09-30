/**
 * R82 — Question-form misroute fixes + natural-phrase fills (pass XXXVI).
 * Probe-driven: interrogative shapes were *executing* the action they ask
 * about ('did i bookmark this' toggled the bookmark, 'is the mic on' started
 * listening, 'am i muted' toggled mute), positional 'close the tab on the
 * right' closed the ACTIVE tab, and several natural EN/JA phrasings fell
 * through to literal navigation or NO-MATCH.
 */
const VC = require('../src/vr/input/VoiceCommands').VoiceCommands;

function makeVC() {
  const vc = new VC({ enabled: true });
  const tm = {
    tabs: [
      { currentTitle: 'Inbox — mail', currentUrl: 'https://mail.example.com', pinned: false, history: ['a', 'b'], historyIdx: 1 },
      { currentTitle: 'News', currentUrl: 'https://news.example.com', pinned: false, history: ['a'], historyIdx: 0 }
    ],
    activeIndex: 0,
    getActiveTab() {
      return this.tabs[this.activeIndex];
    },
    setActive(i) {
      this.activeIndex = i;
    },
    closeTab: jest.fn()
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.tm = tm;
  vc.said = [];
  vc.speak = (s) => vc.said.push(s);
  return vc;
}
const run = (vc, p) => {
  vc.lastCommand = null;
  vc.processCommand(p);
  return vc.lastCommand ? vc.lastCommand.key : null;
};

describe('question-form misroutes (must not execute the action)', () => {
  test.each([
    'did i bookmark this',
    'have i bookmarked this',
    'did i save this',
    'ブックマークした'
  ])('%s → bookmark-status (not a toggle)', (p) => {
    expect(run(makeVC(), p)).toBe('bookmark-status');
  });

  test.each([
    'am i muted',
    'are we muted',
    'ミュートしてる',
    'ミュートされてる',
    'ミュート中'
  ])('%s → mute-status (not a toggle)', (p) => {
    expect(run(makeVC(), p)).toBe('mute-status');
  });

  test.each([
    'is the mic on',
    'is the microphone on',
    'mic check',
    'microphone check'
  ])('%s → mic-status (does not call start)', (p) => {
    const vc = makeVC();
    const spy = jest.spyOn(vc, 'start');
    expect(run(vc, p)).toBe('mic-status');
    expect(spy).not.toHaveBeenCalled();
  });

  test("'close the tab on the right' does NOT close the active tab", () => {
    const vc = makeVC();
    expect(run(vc, 'close the tab on the right')).not.toBe('close-tab');
  });

  test("'close the tab on the left' does NOT close the active tab", () => {
    const vc = makeVC();
    expect(run(vc, 'close the tab on the left')).not.toBe('close-tab');
  });

  test('close-tab still works for the plain phrase', () => {
    const vc = makeVC();
    expect(run(vc, 'close this tab')).toBe('close-tab');
  });
});

describe('go-to steals fixed', () => {
  test.each([
    ['go to my email tab', 'mail'],
    ['go to the news tab', 'news'],
    ['open my mail tab', 'mail']
  ])('%s → tab-by-name, selects the matching tab', (p, term) => {
    const vc = makeVC();
    expect(run(vc, p)).toBe('tab-by-name');
    const tab = vc.tm.getActiveTab();
    expect(`${tab.currentTitle} ${tab.currentUrl}`).toContain(term);
  });

  test('go to google still navigates', () => {
    expect(run(makeVC(), 'go to google')).toBe('go-to');
  });

  test('open my settings → settings-toggle (not navigate)', () => {
    expect(run(makeVC(), 'open my settings')).toBe('settings-toggle');
  });

  test('settings please → settings-toggle', () => {
    expect(run(makeVC(), 'settings please')).toBe('settings-toggle');
  });

  test('bare settings → settings-toggle', () => {
    expect(run(makeVC(), 'settings')).toBe('settings-toggle');
  });
});

describe('navigate/video-seek boundary', () => {
  test("'go forward 30 seconds' → video-seek +30 (not navigate)", () => {
    const vc = makeVC();
    vc._onVideoSeek = jest.fn(() => 30);
    vc.lastCommand = null;
    vc.processCommand('go forward 30 seconds');
    expect(vc.lastCommand.key).toBe('video-seek');
  });

  test("'skip ahead 30 seconds' → video-seek", () => {
    expect(run(makeVC(), 'skip ahead 30 seconds')).toBe('video-seek');
  });

  test("'jump forward 5 minutes' → video-seek", () => {
    expect(run(makeVC(), 'jump forward 5 minutes')).toBe('video-seek');
  });

  test('skip forward 10 seconds → video-seek', () => {
    expect(run(makeVC(), 'skip forward 10 seconds')).toBe('video-seek');
  });

  test('skip ahead 4 paragraphs → paragraph nav (not video-seek)', () => {
    expect(run(makeVC(), 'skip ahead 4 paragraphs')).toBe('paragraph-skip-n');
  });

  test('bare go forward still navigates forward', () => {
    const vc = makeVC();
    vc.tm.getActiveTab().goForward = jest.fn(() => true);
    expect(run(vc, 'go forward')).toBe('navigate');
  });

  test('forward a page → navigate', () => {
    const vc = makeVC();
    vc.tm.getActiveTab().goForward = jest.fn(() => true);
    expect(run(vc, 'forward a page')).toBe('navigate');
  });

  test('one page forward → navigate', () => {
    const vc = makeVC();
    vc.tm.getActiveTab().goForward = jest.fn(() => true);
    expect(run(vc, 'one page forward')).toBe('navigate');
  });
});

describe('bulk close fills', () => {
  test.each([
    'close the other tabs',
    'close all the other tabs',
    'close all other tabs'
  ])('%s → close-other-tabs', (p) => {
    const vc = makeVC();
    vc.tm.closeOtherTabs = jest.fn();
    expect(run(vc, p)).toBe('close-other-tabs');
    expect(vc.tm.closeOtherTabs).toHaveBeenCalled();
  });

  test.each([
    'close my tabs',
    'close all my tabs',
    'close everything'
  ])('%s → close-all-tabs', (p) => {
    const vc = makeVC();
    vc.tm.closeAllTabs = jest.fn(() => 1);
    expect(run(vc, p)).toBe('close-all-tabs');
    expect(vc.tm.closeAllTabs).toHaveBeenCalled();
  });
});

describe('back English fills', () => {
  test.each([
    'take me back',
    'send me back',
    'bring me back'
  ])('%s → back', (p) => {
    const vc = makeVC();
    vc.tm.getActiveTab().goBack = jest.fn(() => true);
    expect(run(vc, p)).toBe('back');
  });
});

describe('status/utility fills', () => {
  test.each(['tell me the time', '時計', '時計は'])('%s → time', (p) => {
    expect(run(makeVC(), p)).toBe('time');
  });

  test.each(["what's my battery", 'whats my battery'])('%s → battery-status', (p) => {
    expect(run(makeVC(), p)).toBe('battery-status');
  });

  test.each(['version number', 'who made this', 'who built it', 'バージョン番号'])('%s → about', (p) => {
    expect(run(makeVC(), p)).toBe('about');
  });

  test.each(['when did i visit', 'did i visit this', 'have i been here', '前に来たことある'])('%s → history-latest', (p) => {
    expect(run(makeVC(), p)).toBe('history-latest');
  });
});

describe('scroll/complaint/input fills', () => {
  test.each(['to the top', 'go back up', 'scroll back up'])('%s → scroll-top', (p) => {
    expect(run(makeVC(), p)).toBe('scroll-top');
  });

  test('to the bottom → scroll-bottom', () => {
    expect(run(makeVC(), 'to the bottom')).toBe('scroll-bottom');
  });

  test.each(['its not working', "it doesn't work", 'cant see anything', '見えない', '動いてない'])('%s → trouble', (p) => {
    expect(run(makeVC(), p)).toBe('trouble');
  });

  test.each(['cant hear anything', "can't hear anything"])('%s → audio-trouble', (p) => {
    expect(run(makeVC(), p)).toBe('audio-trouble');
  });

  test.each(['press enter', 'hit enter', 'press ok', 'return key', 'エンターを押して', 'エンターキー'])('%s → input-methods', (p) => {
    expect(run(makeVC(), p)).toBe('input-methods');
  });
});

describe('panel-distance English verb forms', () => {
  test.each([
    'move it closer',
    'bring it closer',
    'push it away',
    'push the panel back',
    'shrink the window',
    'shrink the panel'
  ])('%s → panel-distance', (p) => {
    expect(run(makeVC(), p)).toBe('panel-distance');
  });
});

describe('speech rate English forms', () => {
  test.each(['read this faster', 'speed it up'])('%s → speech-faster', (p) => {
    expect(run(makeVC(), p)).toBe('speech-faster');
  });

  test.each(['slow it down', 'slow down', 'read it slower'])('%s → speech-slower', (p) => {
    expect(run(makeVC(), p)).toBe('speech-slower');
  });
});

describe('coexistence guards (prior claims unchanged)', () => {
  test('close other tabs (untouched) → close-other-tabs', () => {
    const vc = makeVC();
    vc.tm.closeOtherTabs = jest.fn();
    expect(run(vc, 'close other tabs')).toBe('close-other-tabs');
  });

  test('go to top still scrolls', () => {
    const vc = makeVC();
    vc.tm.getActiveTab().scrollToTop = jest.fn();
    expect(run(vc, 'go to the top')).toBe('scroll-top');
  });

  test('mute still toggles', () => {
    expect(run(makeVC(), 'mute')).toBe('mute-toggle');
  });

  test('unmute still toggles to off', () => {
    expect(run(makeVC(), 'unmute')).toBe('mute-toggle');
  });

  test('mic on still starts listening', () => {
    const vc = makeVC();
    const spy = jest.spyOn(vc, 'start').mockImplementation(() => {});
    expect(run(vc, 'mic on')).toBe('mic-on');
    expect(spy).toHaveBeenCalled();
  });

  test('bookmark this still bookmarks', () => {
    expect(run(makeVC(), 'bookmark this')).toBe('bookmark-page');
  });

  test('add this to reading list → bookmark-page', () => {
    expect(run(makeVC(), 'add this to reading list')).toBe('bookmark-page');
  });

  test('save this for later → bookmark-page', () => {
    expect(run(makeVC(), 'save this for later')).toBe('bookmark-page');
  });
});
