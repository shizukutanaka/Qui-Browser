/**
 * R87 — colloquial suffix & bare-word atoms (pass XLI).
 * Probe (~160 phrases): ~ちゃお volitional, ~なきゃ obligation, double-suffix
 * chains (~てあげてください, ~てくださると, ~ていただければ, ~てほしいな),
 * かい sentence-final particle, bare EN nouns/verbs, and EN casual
 * contractions (gonna/wanna/gotta/gimme/lemme) were all NO-MATCH.
 */
const VC = require('../src/vr/input/VoiceCommands').VoiceCommands;

function makeVC() {
  const vc = new VC({ enabled: true });
  const tm = {
    tabs: [
      { currentTitle: 'Inbox', currentUrl: 'https://mail.example.com', pinned: false },
      { currentTitle: 'News', currentUrl: 'https://news.example.com', pinned: false }
    ],
    activeIndex: 0,
    getActiveTab() {
      return this.tabs[this.activeIndex];
    },
    setActive(i) {
      this.activeIndex = i;
    },
    nextTab() {},
    prevTab() {},
    closeTab: () => true
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

describe('~ちゃお/~じゃお volitional contraction', () => {
  test.each([
    ['閉じちゃお', 'close-tab'],
    ['消しちゃお', 'dismiss-notify'],
    ['読んじゃお', 'read-aloud']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('~なきゃ obligation forms', () => {
  test.each([
    ['読まなきゃ', 'read-aloud'],
    ['閉じなきゃ', 'close-tab'],
    ['戻らなきゃ', 'back'],
    ['進まなきゃ', 'navigate'],
    ['止めなきゃ', 'stop-everything'],
    ['消さなきゃ', 'dismiss-notify']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('double-suffix request chains', () => {
  test.each([
    ['読んであげてください', 'read-aloud'],
    ['閉じてあげてください', 'close-tab'],
    ['読んでくださると', 'read-aloud'],
    ['読んでいただければ', 'read-aloud'],
    ['閉じていただければ', 'close-tab'],
    ['閉じてほしいんだけど', 'close-tab'],
    ['閉じてほしいな', 'close-tab'],
    ['読んでほしいな', 'read-aloud'],
    ['戻ってほしいな', 'back']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('かい question particle', () => {
  test('読んでるかい → speaking-status', () => {
    expect(run(makeVC(), '読んでるかい')).toBe('speaking-status');
  });
});

describe('bare EN nouns/verbs', () => {
  test.each([
    ['tabs', 'tabs-list'],
    ['the tabs', 'tabs-list'],
    ['bookmarks', 'bookmarks-open'],
    ['favorites', 'bookmarks-open'],
    ['history', 'history'],
    ['scroll', 'scroll-down'],
    ['read', 'read-aloud'],
    ['find', 'find-in-page'],
    ['search', 'find-in-page'],
    ['stop', 'stop-reading'],
    ['top', 'scroll-top'],
    ['bottom', 'scroll-bottom'],
    ['up', 'scroll-up'],
    ['down', 'scroll-down']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('EN casual contractions', () => {
  test.each([
    ['wanna go back', 'back'],
    ['gonna close this', 'close-tab'],
    ['close this', 'close-tab'],
    ['gotta stop', 'stop-reading'],
    ['gimme the tabs', 'tabs-list'],
    ['lemme see', 'describe-tab'],
    ['let me see', 'describe-tab']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('EN escape/home + slow complaints', () => {
  test.each(['take me home', 'bring me home', 'send me home'])('%s → home', (p) => {
    expect(run(makeVC(), p)).toBe('home');
  });

  test.each(['get outta here', 'get me out', 'get me out of here', 'get out of here'])(
    '%s → vr-exit', (p) => {
      expect(run(makeVC(), p)).toBe('vr-exit');
    }
  );

  test.each(['kinda slow', 'kinda laggy', 'a bit slow', 'little slow'])('%s → trouble', (p) => {
    expect(run(makeVC(), p)).toBe('trouble');
  });
});

describe('gratitude/praise extras', () => {
  test.each(['cheers', 'appreciate it', 'nice one', 'good job', 'well done', 'excellent'])(
    '%s → ack', (p) => {
      expect(run(makeVC(), p)).toBe('ack');
    }
  );
});

describe('JP pointing words → describe-tab', () => {
  test.each(['なにこれ', 'これなに', 'あれなに', '何それ', 'それなに', 'なんだこれ', 'what is this', 'whats this'])(
    '%s → describe-tab', (p) => {
      expect(run(makeVC(), p)).toBe('describe-tab');
    }
  );
});

describe('half-page / wait / imperative fills', () => {
  test.each([
    ['半分進んで', 'half-page-forward'],
    ['半分下', 'half-page-forward'],
    ['半分戻って', 'half-page-back'],
    ['半分上', 'half-page-back'],
    ['待て', 'pause-reading'],
    ['待ってくれ', 'pause-reading'],
    ['検索しろ', 'find-in-page'],
    ['探しろ', 'find-in-page'],
    ['やって', 'help'],
    ['やってくれ', 'help']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('coexistence guards', () => {
  test.each([
    ['読んで', 'read-aloud'],
    ['戻って', 'back'],
    ['閉じて', 'close-tab'],
    ['消して', 'dismiss-notify'],
    ['半分の音量', 'volume-set'],
    ['go home', 'home'],
    ['stop reading', 'stop-reading'],
    ['stop everything', 'stop-everything'],
    ['scroll down', 'scroll-down'],
    ['scroll to top', 'scroll-top'],
    ['find a word', 'find-in-page'],
    ['read the page', 'read-aloud'],
    ['読んでほしい', 'read-aloud'],
    ['閉じてほしい', 'close-tab'],
    ['読んでくれ', 'read-aloud']
  ])('%s → %s unchanged', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});
