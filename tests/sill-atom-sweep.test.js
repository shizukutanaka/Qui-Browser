// Pass CCVIII — sill atom sweep: EN immediacy adverbs + mock-polite;
// JA shimai residue + しかない/仕方 + kure III + quotative rebukes.
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

describe('sill atom sweep (CCVIII)', () => {
  it.each([
    // EN immediacy adverbs -> close-tab
    'close it as soon as you can', 'close it the moment you can',
    'close it asap please', 'close it immediately', 'close it promptly',
    'close it directly', 'close it shortly', 'close it straightaway',
    'close it forthwith', 'close it presently', 'close it this instant',
    'close it this second', 'close it this minute',
  ])('immediacy %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN mock-polite / sarcasm -> close-tab
    'would it kill you to close it', 'does it hurt to close it',
    'is it that difficult to close it', 'is it so hard to close it',
    'could you maybe just close it', 'could you perhaps close it',
    'might you close it', 'would you possibly close it',
    'could you conceivably close it', 'pretty please close it',
    'please pretty please close it', 'sugar on top close it',
  ])('mock-polite %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA てしまえ residue -> close-tab
    '閉じてしまえば', '閉じてしまうわ', '閉じてしまうわよ',
    '閉じてしまうわね', '閉じてしまえよ', '閉じてしまえぞ',
    '閉じてしまえな', '閉じてしまおう', '閉じてしまおうか',
    '閉じてしまいたい', '閉じてしまうのだ', '閉じてしまうんだ',
  ])('JA shimai %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA しかない/ほかない/仕方 family -> close-tab
    '閉じるしかない', '閉じるしかないよ', '閉じるしかないわ',
    '閉じるしかないじゃないか', '閉じるほかない',
    '閉じるほかないだろう', '閉じるほかないよ', '閉じるほかしかない',
    '閉じるより仕方がない', '閉じるより仕方ない',
    '閉じるほか仕方がない', '閉じるに越したことはない',
    '閉じるに限る', '閉じるにかぎる',
  ])('JA inevitability %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA てくれ III residue -> close-tab
    '閉じてくださいませ', '閉じてくださいまし', '閉じてくださいな',
    '閉じてくださいましね', '閉じてくれないでしょうか',
    '閉じてくれませんでしょうか', '閉じてもらえないでしょうか',
    '閉じてくれへんかな', '閉じてくれまへんか', '閉じてくれませんこと',
    '閉じてくれんかの', '閉じてくれんかね', '閉じてくれるかいな',
  ])('JA kure %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA quotative rebukes -> close-tab
    '閉じろと言っただろう', '閉じろって言っただろう',
    '閉じろといったでしょ', '閉じろといったのに',
    '閉じろと言いましたよ', '閉じろと言っているでしょう',
    '閉じろと何度も言った', '閉じろと再三言った',
    '閉じろって何回も言った',
  ])('JA rebuke %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });
});
