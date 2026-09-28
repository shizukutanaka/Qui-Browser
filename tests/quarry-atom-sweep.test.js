// Pass CC — quarry atom sweep: EN needs/wants declaratives + verdict
// declaratives + duration complaints + sequential prefaces + retracted consent
// (negate); JA べき/なくては past obligations + 忘れ/残置 reports + 開きっぱなし
// state reports (describe-tab).
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

describe('quarry atom sweep (CC)', () => {
  it.each([
    // EN sequential / order prefaces -> close-tab
    'before you do anything close it', 'before anything close it',
    'first things first close it', 'first order of business close it',
    'the first order of business close it', 'to start with close it',
    'to begin with close it', 'starting off close it',
    'kicking off close it', 'opening move close it',
  ])('preface %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN needs/wants + obligation declaratives -> close-tab
    'that tab needs closing', 'that tab wants closing', 'it wants closing',
    'it wants to be closed', 'it has to be closed', 'it ought to be closed',
    'it should already be closed', 'it was supposed to be closed',
    'it was meant to be closed', 'it was supposed to go away',
    'it wasnt supposed to stay', 'it was never meant to stay',
    'it outstayed its welcome', 'the tab outstayed its welcome',
    'it overstayed its welcome', 'this overstayed its welcome',
  ])('obligation %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN verdict declaratives -> close-tab
    'as far as im concerned its closed', 'as far as im concerned its gone',
    'consider it closed', 'consider it shut', 'consider it gone',
    'lets consider it closed', 'consider that tab done',
    'as good as closed', 'for all intents and purposes its closed',
  ])('verdict %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN duration complaints -> close-tab
    'its been open too long', 'its been up too long',
    'its lingered too long', 'it stayed too long',
    'its time it went', 'its time it was closed',
    'its time for it to go', 'its time for it to be gone',
    'about time it went', 'its about time it went',
    'high time it was closed', 'high time it went',
  ])('duration %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN retracted consent -> negate
    'i changed my mind close it', 'hold on close it',
    'close it wait no', 'close it never mind', 'close it hold on',
    'close it i changed my mind', 'close it scratch that',
    'close it that was a joke', 'close it just kidding',
    'scratch that close it', 'that was a joke close it',
    'just kidding close it', 'dont bother closing it',
    'never mind close it', 'forget about closing it',
    'hold off on closing it', 'wait dont close it', 'cancel that close it',
  ])('retract %s -> negate', (p) => {
    expect(key(mk(), p)).toBe('negate');
  });

  it.each([
    // JA past obligation / necessity -> close-tab
    '閉じるべきだった', '閉じるべきでした', '閉じるべきなのに',
    '閉じるべきだったのに', '閉じるべきだったんだけど',
    '閉じなければならなかった', '閉じないといけなかった',
    '閉じなくちゃいけなかった', '閉じなくてはいけなかった',
    '閉じる必要があった',
  ])('JA past-obligation %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA forgot / left-behind reports -> close-tab
    '閉じるのを忘れてた', '閉じるのを忘れました', '閉じるの忘れてた',
    '閉じるの忘れた', '閉じるの忘れてました', '閉じるの忘れていた',
    '閉じるのを忘れていました', '閉じること忘れてた',
    '閉じ忘れてた', '閉じ残してた', '閉じ残してました', '閉じずに残った',
  ])('JA forgot %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA っぱなし/まま state reports -> describe-tab
    '開きっぱなし', '開きっぱなしだ', '開きっぱなしだった',
    '開きっぱなしだったのに', '開いたまま', '開いたままだった',
    '開いたまま残ってた', '開きっぱなしのまま', '閉じ残したまま',
  ])('JA state %s -> describe-tab', (p) => {
    expect(key(mk(), p)).toBe('describe-tab');
  });

  it.each([
    // established pins kept
    ['閉じるべきだったはず', 'trouble'],   // はず complaint form
    ['閉じてないんだけど', 'trouble'],      // still-not-closed complaint
    ['まだ閉じてないんだけど', 'trouble'],
    ['閉じてないんですよ', 'negate'],       // variant path hits negate; logged
    ['閉じていない', null],                 // plain state report, ambiguous
    ['閉じてないですけど', null],
    ['閉じてないのに', null],
    ['閉じてないんです', null],
    ['閉じていないんです', null],
    ['閉じてないんですけど', null],
    ['閉じてないですよ', null],
    ['まだ閉じてない', null],
    ['まだ閉じてないのに', null],
    ['ずっと閉じてない', null],
    ['閉じてもない', null],
  ])('pin %s', (p, expected) => {
    expect(key(mk(), p)).toBe(expected);
  });
});
