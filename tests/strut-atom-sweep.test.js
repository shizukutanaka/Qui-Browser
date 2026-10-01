// Pass CCXI — strut atom sweep: EN suggestions/duration II;
// JA te-oku residue + tamae/dialect + choudai + te-yo/てよき.
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

describe('strut atom sweep (CCXI)', () => {
  it.each([
    // EN what-if/why-dont suggestions -> close-tab
    'what if you close it', 'what if we close it', 'why dont we close it',
    'why dont we just close it', 'why not just close it',
    'should we close it', 'shall we close it', 'shouldnt we close it',
    'dont you think we should close it',
    'dont you think you should close it',
  ])('suggestion %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN duration II -> close-tab
    'its been open too long', 'its been open long enough',
    'its been up too long', 'its been up long enough',
    'its been sitting there', 'its been sitting open',
    'its been ages', 'its been ages open', 'its been open for ages',
    'its been around too long', 'its overstayed its welcome',
    'its time it closed',
  ])('duration %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA ておく residue -> close-tab
    '閉じておいても', '閉じておいてもいい', '閉じておいたら',
    '閉じておけば', '閉じておけばいい', '閉じておきたい',
    '閉じておくと', '閉じておくなら', '閉じておこうと思う',
    '閉じておこうかな', '閉じておくつもり', '閉じておくわ',
    '閉じておくわよ', '閉じておくんだ', '閉じておくんだよ',
  ])('JA te-oku %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA たまえ/方言 imperatives -> close-tab
    '閉じたまえ', '閉じたまへ', '閉じたまえよ', '閉じたまえぞ',
    '閉じたまえな', '閉じやがれ', '閉じやがった', '閉じやす',
    '閉じやすぞ', '閉じやんす', '閉じんさい', '閉じんしゃい',
    '閉じんちゃい', '閉じんせ',
  ])('JA tamae %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA ちょうだい residue -> close-tab
    '閉じてちょうだい', '閉じてちょうだいな', '閉じてちょうだいよ',
    '閉じてちょうだいね', '閉じてちょうだいませ', '閉じてちょうだいまし',
    '閉じてちょーだい', '閉じてちょいちょい',
  ])('JA choudai %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA てよ/てよろしい/てよき -> close-tab
    '閉じてよねえ', '閉じてよなあ', '閉じてよー', '閉じてよーね',
    '閉じてよろしい', '閉じてよろしいか', '閉じてよろしいでしょうか',
    '閉じてよろしいかしら', '閉じてよろしいですか', '閉じてよき',
    '閉じてよきこと', '閉じてよきかな', '閉じてよきな',
  ])('JA te-yo %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // established pins kept
    ['should i close it', 'help'],   // interrogative -> help (established)
    ['shall i close it', 'help'],
    ['ought i close it', null],      // archaic interrogative stays null
  ])('pin %s', (p, expected) => {
    expect(key(mk(), p)).toBe(expected);
  });
});
