// Pass CCIII — plinth atom sweep: EN done-status/obligation declarations +
// 'em-contractions; JA decision/shidai + noun-delegation tails + ki-mo-suru
// weak intent + was-on-verge reports + deliberation questions.
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

describe('plinth atom sweep (CCIII)', () => {
  it.each([
    // EN done-status declarations -> close-tab
    'its closed', 'it is closed', 'its done for', 'it is done',
    'its over', 'it is over', 'its finished', 'it is finished',
    'its dealt with', 'it is dealt with', 'its handled',
    'it is handled', 'its sorted', 'it is sorted', 'its dead',
    'it is dead', 'its toast', 'it is toast', 'its history',
    'it is history', 'the tab is done', 'the tab is over',
    'the tabs done', 'this tabs done', 'this tab is done',
    'this tab is over',
  ])('declaration %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN obligation / 'em-contraction -> close-tab
    'the tab has to go', 'the tab needs to go', 'the tabs got to go',
    'tab needs to go', 'tab has to go', 'tabs got to go',
    'close r up', 'close r down', 'close er up', 'close er down',
    'close that one', 'close this one', 'close the one',
    'close the thing', 'close that tab there',
  ])('obligation %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN 'em-contraction bulk -> close-all-tabs
    'close m all', 'close em', 'close em up', 'close em all',
    'shut m all', 'shut em all',
  ])('bulk %s -> close-all-tabs', (p) => {
    expect(key(mk(), p)).toBe('close-all-tabs');
  });

  it.each([
    // JA decision / shidai -> close-tab
    '閉じることにする', '閉じることにします', '閉じることにしました',
    '閉じることとします', '閉じることとする', '閉じることにした',
    '閉じる次第でございます', '閉じる次第である', '閉じる次第でして',
    '閉じるようにする', '閉じるようにします', '閉じるなり',
  ])('JA decision %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA noun-delegation -> close-tab
    '閉じるのを頼む', '閉じるのをお願い', '閉じるのを願います',
    '閉じるのをよろしく', '閉じるのをお願いします',
    '閉じるのをお願いしたい', '閉じるのお願いします',
    '閉じるの頼みます', '閉じるのをたのむ', '閉じるのを手伝って',
    '閉じるのを頼まれて',
  ])('JA delegation %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA weak intent (気もする) + emphatic ぞ + confirm-seek -> close-tab
    '閉じるのもいいかも', '閉じるのもあり', '閉じるのも一興',
    '閉じたい気もする', '閉じる気もする', '閉じたほうがいい気もする',
    '閉じるのだぞ', '閉じるんだぞ', '閉じるのよ', '閉じるんだよ',
    '閉じてくれるんだよね', '閉じてくれるのよね', '閉じてくれるよね',
    '閉じてほしいんだよね', '閉じてほしいのよね', '閉じてほしいよね',
  ])('JA intent %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA was-on-verge reports -> describe-tab
    '閉じるとこだった', '閉じるところだった', '閉じるとこでした',
    '閉じるところでした', '閉じる寸前だった', '閉じる寸前でした',
    '閉じそうだった', '閉じそうでした', '閉じかけていた',
    '閉じかけた', '閉じかけてた',
  ])('JA verge %s -> describe-tab', (p) => {
    expect(key(mk(), p)).toBe('describe-tab');
  });

  it.each([
    // JA deliberation questions -> help
    '閉じたほうがいいかしら', '閉じるほうがいいかしら',
    '閉じるのとどう思う', '閉じたらどうなるかしら',
  ])('JA deliberation %s -> help', (p) => {
    expect(key(mk(), p)).toBe('help');
  });

  it.each([
    // established pins kept
    ['shut er down', 'vr-exit'],        // shut-X-down family
    ['shut r down', null],              // 'er-variant uncovered, ambiguous
    ['close that there tab', 'close-tab-by-name'], // deictic-by-name established
  ])('pin %s', (p, expected) => {
    expect(key(mk(), p)).toBe(expected);
  });
});
