/**
 * R91 — suggestion/idiom atoms (pass XLV).
 * Probe (~130 phrases): conditional suggestions (たら/ば/べき/ほうがいい),
 * volitional (よう/ましょう/とこ), dialect imperatives (んさい/みゃあ/っち/だべ),
 * EN acknowledgment fillers + permission idioms ('go ahead' misrouted to
 * literal navigation!), presence checks, and collection bulk-phrasing were
 * NO-MATCH or misrouted.
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
    },
    togglePin() {},
    moveTabToStart() {
      return true;
    },
    moveTabToEnd() {
      return true;
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

describe('conditional suggestion tails → て-form', () => {
  test.each([
    ['閉じたらいい', 'close-tab'],
    ['戻ったら', 'back'],
    ['閉じればいい', 'close-tab'],
    ['戻ればいい', 'back'],
    ['閉じたほうがいい', 'close-tab'],
    ['戻ったほうがいい', 'back'],
    ['読んだほうがいい', 'read-aloud'],
    ['閉じるべき', 'close-tab'],
    ['読むべき', 'read-aloud'],
    ['閉じてもいいですか', 'close-tab']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('volitional + dialect imperatives', () => {
  test.each([
    ['閉じよう', 'close-tab'],
    ['閉じよ', 'close-tab'],
    ['戻ろう', 'back'],
    ['戻ろ', 'back'],
    ['読もう', 'read-aloud'],
    ['読も', 'read-aloud'],
    ['閉じましょう', 'close-tab'],
    ['閉じとこ', 'close-tab'],
    ['閉じるんか', 'close-tab'],
    ['閉じるんかい', 'close-tab'],
    ['読むんか', 'read-aloud'],
    ['閉じんさい', 'close-tab'],
    ['読みんさい', 'read-aloud'],
    ['閉じみゃあ', 'close-tab'],
    ['読みゃあ', 'read-aloud'],
    ['閉じっち', 'close-tab'],
    ['閉じだべ', 'close-tab'],
    ['閉じだ', 'close-tab'],
    ['読みつつ', 'read-aloud'],
    ['読みながら', 'read-aloud']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('EN acknowledgment + permission idioms (go-ahead misroute fix)', () => {
  test.each([
    'go ahead', 'go right ahead', 'go for it', 'yeah', 'yep', 'yup', 'yes', 'uh huh',
    'hmm', 'alright', 'aight', 'okay then', 'sure thing', 'you got it', 'no problem',
    'welcome', 'cool', 'sweet', 'neat', 'interesting', 'fine by me', 'correct',
    'exactly', 'thats right', 'who cares', 'come on', 'cmon', 'lets go', 'leggo',
    'lets do this', 'no rush', 'take your time', 'whenever you are ready',
    'when you get a chance', 'much appreciated', 'thanks a bunch', 'bless you',
    'and then', 'well then'
  ])('%s → ack', (p) => {
    expect(run(makeVC(), p)).toBe('ack');
  });
});

describe('EN rejection/mistake → negate', () => {
  test.each([
    'nvm', 'disregard', 'ignore that', 'ignore me', 'drop it', 'my bad', 'whoops',
    'oops', 'thanks anyway', 'wrong', 'thats wrong', 'incorrect'
  ])('%s → negate', (p) => {
    expect(run(makeVC(), p)).toBe('negate');
  });
});

describe('EN presence + collection bulk phrasing', () => {
  test.each([
    ['still there', 'working-status'],
    ['are you still there', 'working-status'],
    ['still listening', 'working-status'],
    ['you still here', 'working-status'],
    ['still with me', 'working-status'],
    ['boring', 'trouble'],
    ['ugh', 'trouble'],
    ['leave the browser', 'vr-exit'],
    ['shut it all down', 'vr-exit'],
    ['wipe my history', 'clear-history'],
    ['purge history', 'clear-history'],
    ['mute them all', 'tab-audio'],
    ['mute every tab', 'tab-audio'],
    ['mute the other tabs', 'tab-audio'],
    ['open a duplicate', 'duplicate-tab'],
    ['duplicate this page', 'duplicate-tab'],
    ['clone it', 'duplicate-tab'],
    ['close the rest', 'close-other-tabs'],
    ['close everything else', 'close-other-tabs'],
    ['close all but this', 'close-other-tabs'],
    ['keep just this one', 'close-other-tabs'],
    ['pin em all', 'pin-all'],
    ['unpin everything', 'unpin-all'],
    ['reload em all', 'reload-all'],
    ['refresh them all', 'reload-all'],
    ['alphabetize', 'sort-tabs'],
    ['sort by name', 'sort-tabs'],
    ['second to last tab', 'tab-relative'],
    ['second from last', 'tab-relative'],
    ['penultimate tab', 'tab-relative'],
    ['the tab before this', 'prev-tab'],
    ['the one on the left', 'prev-tab'],
    ['the tab next to this one', 'next-tab'],
    ['the one after this', 'next-tab'],
    ['the one on the right', 'next-tab'],
    ['put this tab first', 'move-tab-start'],
    ['send this tab to the front', 'move-tab-start'],
    ['send this tab to the back', 'move-tab-end'],
    ['put this tab last', 'move-tab-end'],
    ['start over', 'read-aloud'],
    ['reset it all', 'settings-reset'],
    ['fresh start', 'settings-reset'],
    ['clean slate', 'settings-reset']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('JA social/filler acks + decline', () => {
  test.each(['どうも', 'すみません', 'すいません', 'ごめん', 'お疲れ', 'ご苦労さま', 'はい',
    'うん', 'ええ', 'そう', 'そうだね', 'そっか', 'ふーん', 'うーん', 'えーと', 'あのー'])(
    '%s → ack', (p) => {
      expect(run(makeVC(), p)).toBe('ack');
    }
  );

  test.each(['まあいいや', 'もういいや', 'どうでもいい', 'それじゃない', 'それは違う',
    'やめといた', 'やっぱりやめて'])('%s → negate', (p) => {
    expect(run(makeVC(), p)).toBe('negate');
  });
});

describe('coexistence guards', () => {
  test.each([
    ['読んで', 'read-aloud'],
    ['閉じて', 'close-tab'],
    ['戻って', 'back'],
    ['go to google', 'go-to'],
    ['戻る', 'back'],
    ['go back', 'back'],
    ['read this page', 'read-aloud'],
    ['open a copy', 'duplicate-tab'],
    ['go to the top', 'scroll-top']
  ])('%s → %s unchanged', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});
