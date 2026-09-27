/**
 * R90 — causative/invitation atoms (pass XLIV).
 * Probe (~110 phrases): casual request questions (てくれるか/てもらえるか),
 * negative-invitation んじゃない, causative させて, っぱなし state complaints,
 * EN ASR-corrections ('i said X'), wait idioms, bare lookups ('google it'),
 * and 'the first/last/other one' ordinal references were NO-MATCH.
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

describe('てくれるか/てもらえるか casual request questions', () => {
  test.each([
    ['閉じてくれるか', 'close-tab'],
    ['読んでくれるか', 'read-aloud'],
    ['戻ってくれるか', 'back'],
    ['閉じてくれないか', 'close-tab'],
    ['閉じてもらえるか', 'close-tab'],
    ['読んでもらえるか', 'read-aloud']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('んじゃない negative-invitation (request, not negation)', () => {
  test.each([
    ['閉じるんじゃない', 'close-tab'],
    ['読むんじゃない', 'read-aloud'],
    ['戻るんじゃない', 'back'],
    ['閉じるんじゃね', 'close-tab'],
    ['閉じるんじゃん', 'close-tab'],
    ['読むんじゃね', 'read-aloud']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('させて causative let-me requests', () => {
  test.each([
    ['読ませて', 'read-aloud'],
    ['閉じさせて', 'close-tab'],
    ['戻らせて', 'back'],
    ['調べさせて', 'web-search'],
    ['見させて', 'describe-tab'],
    ['探させて', 'find-in-page']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('っぱなし left-in-state complaints', () => {
  test.each([
    ['閉じっぱなし', 'describe-tab'],
    ['開きっぱなし', 'describe-tab'],
    ['つけっぱなし', 'describe-tab'],
    ['読みっぱなし', 'speaking-status']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('EN ASR-correction + rejection', () => {
  test.each([
    ['i said close it', 'close-tab'],
    ['i meant close it', 'close-tab'],
    ['thats not what i said', 'negate'],
    ['not that', 'negate'],
    ['wrong one', 'negate'],
    ['nope', 'negate'],
    ['nah', 'negate'],
    ['no way', 'negate'],
    ['no thanks', 'negate'],
    ['no thank you', 'negate'],
    ['forget that', 'negate'],
    ['scratch that', 'negate']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('EN wait idioms + bare lookups', () => {
  test.each(['be right back', 'brb', 'hold that thought', 'one moment', 'give me a minute', 'give me a sec'])(
    '%s → pause-reading', (p) => {
      expect(run(makeVC(), p)).toBe('pause-reading');
    }
  );

  test.each([
    ['google it', 'web-search'],
    ['google that', 'web-search'],
    ['search it', 'web-search'],
    ['look it up', 'web-search'],
    ['check that out', 'describe-tab'],
    ['check it out', 'describe-tab']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('EN misc commands', () => {
  test.each([
    ['now what', 'help'],
    ['then what', 'help'],
    ['what now', 'help'],
    ['what next', 'help'],
    ['enough', 'stop-everything'],
    ['thats enough', 'stop-everything'],
    ['that will do', 'stop-everything'],
    ['whats the time', 'time'],
    ['time is it', 'time'],
    ['got the time', 'time'],
    ['count the tabs', 'tabs-list'],
    ['how many are open', 'tabs-list'],
    ['how many do i have', 'tabs-list'],
    ['the first one', 'first-tab'],
    ['the last one', 'last-tab'],
    ['the other one', 'next-tab'],
    ['put it back', 'reopen-tab'],
    ['bring it back', 'reopen-tab'],
    ['try again', 'repeat-command'],
    ['do that again', 'repeat-command'],
    ['again', 'repeat-command'],
    ['one more time', 'repeat-command'],
    ['a little more', 'scroll-down'],
    ['bit more', 'scroll-down'],
    ['tiny bit more', 'scroll-down']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('EN exclamations + presence checks', () => {
  test.each(['wow', 'amazing', 'incredible', 'unbelievable'])('%s → ack', (p) => {
    expect(run(makeVC(), p)).toBe('ack');
  });

  test.each([
    ['do you hear me', 'mic-status'],
    ['are you listening', 'mic-status'],
    ['are you there', 'working-status'],
    ['you there', 'working-status'],
    ['are you on', 'working-status'],
    ['can you see this', 'describe-tab'],
    ['can you see it', 'describe-tab']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('coexistence guards', () => {
  test.each([
    ['読んで', 'read-aloud'],
    ['閉じて', 'close-tab'],
    ['戻って', 'back'],
    ['忘れないで', 'negate'],
    ['please go back', 'back'],
    ['go to google', 'go-to']
  ])('%s → %s unchanged', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});
