// Pass CXCVIII — segment atom sweep: EN done-for declaratives + make/see-it-closed
// + as-well/at-least/no-harm frames + archaic request frames + manner tails;
// JA benefactive request tails + intent-declaration frames + dict nouns XXXVII.
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

describe('segment atom sweep (CXCVIII)', () => {
  it.each([
    // EN done-for state declaratives → close-tab
    'this tab is done', 'this tabs done', 'this tabs finished',
    'this tab is finished', 'this tab is over', 'this tabs over',
    'this tab is history', 'this tab is toast', 'this ones toast',
    'this tab is dead', 'this tabs dead', 'this tab is gone',
    'this tabs done for', 'this tab is done for', 'this tabs had it',
    'this tabs had its day', 'its all over for this tab', 'its over for this tab',
    'game over for this tab', 'the shows over for this tab',
    'partys over for this tab', 'this tab served its purpose',
    'this has run its course', 'this page is spent',
    'this ones finished', 'this ones done for',
  ])('done-for %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN make/see-it-closed frames → close-tab
    'make it go away', 'make this go away', 'make the tab go away',
    'make it disappear', 'make this disappear', 'make the tab disappear',
    'lets have it closed', 'lets see it closed', 'lets get it closed',
    'i wanna see it closed', 'i want to see it closed',
    'id like to see it closed', 'i need to see it closed',
    'wrap this one',
  ])('see-it-closed %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN as-well / at-least / no-harm frames → close-tab
    'you might just as well close it', 'you might at least close it',
    'you could at least close it', 'could at least close it',
    'at least close it', 'you could do worse than close it',
    'cant hurt to close it', 'wont hurt to close it', 'it cant hurt to close it',
    'no harm in closing it', 'no reason not to close it',
    'theres no reason not to close it', 'least you can do is close it',
    'least you could do is close it', 'the least you could do is close it',
  ])('as-well/at-least %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN archaic request frames → close-tab
    'i pray you will close it', 'i pray youll close it',
    'pray close it', 'prithee close it',
    'wouldst thou close it', 'dost thou close it', 'wilt thou close it',
  ])('archaic %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN manner tails & speaker-declaration → close-tab
    'close it like a boss', 'close it nicely', 'close it slow',
    'close it real slow', 'im closing this whether you like it or not',
  ])('manner %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA benefactive/request tails → close-tab
    '閉じてくれのじゃ', '閉じてくれんかなあ', '閉じてもらおうかなあ',
    '閉じてもらうといいなあ', '閉じてくれればそれでよい',
    '閉じてさえくれればいい', '閉じてさえもらえれば',
    '閉じてくれんこともない', '閉じてもいいんじゃないかなあ',
    '閉じてもいいんじゃないかな', '閉じてもかまわないんじゃないかな',
    '閉じてもいいんではないかなあ',
  ])('JA request tail %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA intent-declaration frames → close-tab
    '閉じる運びとなります', '閉じる運びです',
    '閉じることに相成ります', '閉じることと相成ります',
    '閉じる次第でございます', '閉じる次第にございます',
    '閉じる旨承知しました', '閉じてみる所存です',
    '閉じる所存でございます', '閉じるつもりでございます',
    '閉じる予定でございます', '閉じる心づもりでございます',
  ])('JA declaration %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // dict XXXVII recommendation nouns → close-tab
    '閉じるのが最良です', '閉じるのが最良の策です', '閉じるのが最上です',
    '閉じるのが最上の策です', '閉じるのが至上です', '閉じるのが極上です',
    '閉じるのが第一選択肢です', '閉じるのが第一候補です',
    '閉じるのが正解でしょう', '閉じるのが模範解答です',
    '閉じるのが標準解答です', '閉じるのが定番中の定番です',
    '閉じるのが大定番です', '閉じるのが本命中の本命です',
    '閉じるのが優先です', '閉じるのが最優先です',
  ])('dict %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // established pins kept
    ['閉じるのが正解', 'help'],           // 'のが正解' → help pin
    ['its done here', null],             // ambiguous: speaker-done vs tab-done
    ['do it then', null],                // ambiguous imperative, skipped
    ['close out this tab', 'close-tab-by-name'],  // 'close out/up X' → by-name pin family
    ['close out the tab', 'close-tab-by-name'],
  ])('pin %s', (p, expected) => {
    expect(key(mk(), p)).toBe(expected);
  });
});
