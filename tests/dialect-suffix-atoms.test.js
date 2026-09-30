/**
 * R88 — dialect & progressive atoms (pass XLII).
 * Probe (~120 phrases): Kansai/dialect progressives (てん/でん, とる/どる, てや,
 * てはる, てもろて, てくれん), negatives (へん/ひん, ずに), っす casual,
 * 'open up a tab' misrouting to tab-by-name 'a', EN wait idioms and
 * close-em-all forms were all NO-MATCH or misrouted.
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
    closeTab: () => true,
    closeAllTabs() {
      return this.tabs.length;
    }
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

describe('てん/でん progressive contraction', () => {
  test.each([
    ['戻ってん', 'back'],
    ['読んでん', 'read-aloud'],
    ['閉じてん', 'close-tab'],
    ['読んでんか', 'speaking-status'],
    ['閉じてんか', 'describe-tab'],
    ['閉じてんの', 'describe-tab']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('とる/どる Kansai progressive', () => {
  test.each([
    ['戻っとる', 'back-status'],
    ['読んどる', 'speaking-status'],
    ['閉じとる', 'describe-tab'],
    ['使っとる', 'working-status'],
    ['開いとる', 'describe-tab']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('てや/てはる/てもろて/てくれん request dialects', () => {
  test.each([
    ['読んでや', 'read-aloud'],
    ['閉じてや', 'close-tab'],
    ['見せてや', 'tabs-list'],
    ['読んではる', 'read-aloud'],
    ['閉じてはる', 'close-tab'],
    ['読んでもろて', 'read-aloud'],
    ['閉じてもろて', 'close-tab'],
    ['消してもろて', 'dismiss-notify'],
    ['閉じてくれへん', 'close-tab'],
    ['読んでくれん', 'read-aloud'],
    ['見せてくれん', 'tabs-list']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('へん/ひん negatives + ずに', () => {
  test.each([
    ['読んでへん', 'read-aloud'],
    ['閉じてへん', 'close-tab'],
    ['戻られへん', 'back-status'],
    ['戻れへん', 'back-status']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });

  test.each(['読まずに', '閉じずに', '戻らずに', '消さずに', '開かずに'])('%s → negate', (p) => {
    expect(run(makeVC(), p)).toBe('negate');
  });

  test.each(['知らん', 'しらん', 'できひん'])('%s → help', (p) => {
    expect(run(makeVC(), p)).toBe('help');
  });
});

describe('っす casual strip', () => {
  test.each([
    ['わかったっす', 'ack'],
    ['読んでるっす', 'speaking-status']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('EN wait idioms + status questions', () => {
  test.each(['hang on', 'hold up', 'wait up', 'wait a sec', 'one sec', 'gimme a sec', 'hold on', 'just a sec'])(
    '%s → pause-reading', (p) => {
      expect(run(makeVC(), p)).toBe('pause-reading');
    }
  );

  test.each(['whatcha doing', 'whatcha up to', 'what are you doing', 'whats happening', 'whatcha reading'])(
    '%s → working-status', (p) => {
      expect(run(makeVC(), p)).toBe('working-status');
    }
  );

  test.each(['何してる', '何やってる', '何してるの'])('%s → working-status', (p) => {
    expect(run(makeVC(), p)).toBe('working-status');
  });
});

describe('close-em-all + open-up + bring/pull-up', () => {
  test.each(['close all of them', 'close em all', 'close em', 'close them all'])(
    '%s → close-all-tabs', (p) => {
      expect(run(makeVC(), p)).toBe('close-all-tabs');
    }
  );

  test.each(['open up a tab', 'open a tab', 'open up new tab'])('%s → new-tab (not tab-by-name "a")', (p) => {
    expect(run(makeVC(), p)).toBe('new-tab');
  });

  test.each([
    ['open up settings', 'settings-toggle'],
    ['bring up settings', 'settings-toggle'],
    ['pull up the tabs', 'tabs-list'],
    ['bring up tabs', 'tabs-list'],
    ['pull up the history', 'history'],
    ['bring up bookmarks', 'bookmarks-open']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('go-to up-verbs', () => {
  test.each(['fire up youtube', 'pull up google', 'open up gmail'])('%s → go-to', (p) => {
    expect(run(makeVC(), p)).toBe('go-to');
  });
});

describe('greetings → ack', () => {
  test.each(['sup', 'yo', 'hey you', 'hows it going', 'how are ya', 'whats up'])('%s → ack', (p) => {
    expect(run(makeVC(), p)).toBe('ack');
  });
});

describe('coexistence guards', () => {
  test.each([
    ['読んで', 'read-aloud'],
    ['戻って', 'back'],
    ['閉じて', 'close-tab'],
    ['消して', 'dismiss-notify'],
    ['わからん', 'help'],
    ['そのまま', 'negate'],
    ['open settings', 'settings-toggle'],
    ['go to google', 'go-to'],
    ['open the news tab', 'tab-by-name'],
    ['close the news tab', 'close-tab-by-name']
  ])('%s → %s unchanged', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});
