// Pass CCXII — girder atom sweep: EN time-nudges/before-urgency;
// JA te-oku III + kara/shi + zo-emphasis + mai-reports (negate).
import { VoiceCommands } from '../src/vr/input/VoiceCommands.js';

function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = {
    activeTabId: 't1',
    tabs: [
      { id: 't1', title: 'Alpha', url: 'https://alpha' },
      { id: 't2', title: 'Beta', url: 'https://beta' },
      { id: 't3', title: 'Gamma', url: 'https://gamma' },
    ],
    getActiveTab() { return this.tabs.find(t => t.id === this.activeTabId); },
    closeAllTabs() { return this.tabs.length; },
    closeTab() {}, pinTab() {}, closeOtherTabs() {},
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}

function key(vc, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

describe('girder atom sweep (CCXII)', () => {
  it.each([
    // EN time-nudges -> close-tab
    'isnt it time to close it', 'isnt it time it closed',
    'isnt it time it went', 'its about time it closed',
    'its about time to close it', 'its high time it closed',
    'time to close it', 'time it closed', 'time it went', 'time it goes',
    'nows the time to close it', 'now is the time to close it',
    'the time has come to close it', 'the time is now close it',
    'its now or never close it', 'now or never close it',
  ])('time-nudge %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN before-urgency -> close-tab
    'close it before it loads', 'close it before its too late',
    'close it before you go', 'close it before i lose it',
    'close it before anything else', 'close it before we leave',
    'close it before i forget', 'close it before it crashes',
    'close it before it eats my ram', 'close it before it wastes more time',
    'close it before i change my mind',
  ])('before %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA ておく III residue -> close-tab
    '閉じておいたほうがいい', '閉じておいた方がいい',
    '閉じておくほうがいい', '閉じておくべき', '閉じておくべきだ',
    '閉じておくべきです', '閉じておきなさい', '閉じておきなさいよ',
    '閉じておきなさいね', '閉じておきなされ', '閉じておきやす',
    '閉じておきましょう', '閉じておきましょうよ', '閉じておきます',
    '閉じておきますよ',
  ])('JA te-oku III %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA から/し reason tails -> close-tab
    '閉じるから', '閉じるからね', '閉じるんだから', '閉じるんだからね',
    '閉じるんだし', '閉じるからいい', '閉じるからいいよ',
    '閉じてくれから', '閉じてくれんだから', '閉じてほしいから',
    '閉じてほしいんだから',
  ])('JA kara %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA ぞ emphasis tails -> close-tab
    '閉じるぞい', '閉じるぞな', '閉じるぞね', '閉じるぞよ', '閉じるぞえ',
    '閉じるのぞ', '閉じるんだぞい', '閉じるんぞ', '閉じるぜい',
    '閉じるぜよ', '閉じちゃうぞ', '閉じちゃうぞい', '閉じるわよぞ',
    '閉じるぞって',
  ])('JA zo %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA まい not-to reports -> negate
    '閉じるまいと思う', '閉じるまいと思っている', '閉じるまいと思った',
  ])('JA mai %s -> negate', (p) => {
    expect(key(mk(), p)).toBe('negate');
  });

  it.each([
    // deliberation pins kept
    ['閉じるかどうかだよね', null],
    ['閉じるかどうか決めよう', null],
    ['閉じるか閉じないかだ', null],
    ['閉じるかどうするか', 'help'],          // どうするか interrogative
    ['閉じるべきか閉じないべきか', 'help'],   // AかBか deliberation
    ['閉じるか閉じるまいか', 'help'],
  ])('pin %s', (p, expected) => {
    expect(key(mk(), p)).toBe(expected);
  });
});
