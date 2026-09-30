// Pass CCXIV — arch atom sweep: EN harm/resolve frames;
// JA mae/made/beki/sase-itadaku residue + shimatta-cause reports.
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

describe('arch atom sweep (CCXIV)', () => {
  it.each([
    // EN harm frames -> close-tab
    'would it kill you to close it', 'it wouldnt kill you to close it',
    'whats the harm in closing it', 'what harm is there in closing it',
    'what harm would it do to close it', 'no harm no foul close it',
    'harm to close it', 'no harm in closing it',
    'its not gonna hurt to close it',
  ])('harm %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN resolve frames -> close-tab
    'close it one way or another', 'one way or another it closes',
    'come hell or high water close it', 'close it come hell or high water',
    'by hook or by crook close it', 'whatever it takes close it',
    'whatever you have to do close it', 'close it whatever it takes',
  ])('resolve %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA まえ dialect imperative -> close-tab
    '閉じてまえ', '閉じまえ', '閉じてまえば', '閉じてまえよ',
    '閉じてまえな', '閉じてまえの', '閉じてまえそう', '閉じてまえそうだ',
    '閉じてまえそうよ',
  ])('JA mae %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA まで idiom ("all thats left is to") -> close-tab
    '閉じるまでだ', '閉じるまでだよ', '閉じるまでのことだ',
    '閉じるまでです', '閉じるまでね', '閉じちゃうまでだ',
  ])('JA made %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA べき residue -> close-tab
    '閉じるべし', '閉じるべきだな', '閉じるべきね', '閉じるべきじゃ',
    '閉じるべきこと', '閉じるべきことか', '閉じるべきことです',
    '閉じるべき場面', '閉じるべきタイミングだ', '閉じるべきタイミングか',
    '閉じるべきなんだ', '閉じるべきなんだよ', '閉じるべきなんです',
  ])('JA beki %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA させていただく declarations -> close-tab
    '閉じさせていただきます', '閉じさせて頂きます',
    '閉じさせていただく', '閉じさせていただき', '閉じさせていただきたい',
    '閉じさせてもらいます', '閉じさせていただきますね',
    '閉じさせていただきますが', '閉じさせていただければ',
    '閉じさせていただけたら',
  ])('JA sase-itadaku %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA しまった-cause accident reports -> reopen-tab
    '閉じてしまいましたので', '閉じてしまいましたから',
    '閉じてしまったので', '閉じてしまったから', '閉じちゃいましたので',
    '閉じちゃったから', '閉じちゃいましたから', '閉じちゃったんで',
    '閉じてしまいましたんで',
  ])('JA shimatta-cause %s -> reopen-tab', (p) => {
    expect(key(mk(), p)).toBe('reopen-tab');
  });
});
