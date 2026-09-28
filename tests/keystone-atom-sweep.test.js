// Pass CCXV — keystone atom sweep: EN desire-states/do-the-thing;
// JA kure-masu II + youka II + noha-eval + chau residue.
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

describe('keystone atom sweep (CCXV)', () => {
  it.each([
    // EN desire states -> close-tab
    'i want it gone', 'i need it gone', 'i want it shut',
    'i want it closed', 'i need it shut', 'i want it away',
    'i want it off', 'i want it out', 'i want it shut already',
    'i need it gone already', 'i want it closed already',
  ])('desire %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN do-the-thing idioms -> close-tab
    'go for it close it', 'just do it close it', 'do it close it',
    'do the thing close it', 'make it happen close it',
    'get it done close it', 'do what needs doing close it',
    'make it so close it', 'you know what to do close it',
    'close it like you mean it',
  ])('do-thing %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA くれますか II residue -> close-tab
    '閉じてくれますかね', '閉じてくれますかねえ', '閉じてくれますんでしょうか',
    '閉じてもらえますかね', '閉じてもらえますんでしょうか',
    '閉じていただけますかね', '閉じていただけますんでしょうか',
    '閉じてもらえないかしら', '閉じてもらえませんかね',
    '閉じてもらえないものかね', '閉じていただけませんかね',
    '閉じていただけないものか',
  ])('JA kure-masu II %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA ようか volitional II -> close-tab
    '閉じようかなあ', '閉じようかなー', '閉じようかと思って',
    '閉じようかと思った', '閉じようかなと', '閉じちゃおうかな',
    '閉じちゃおうかと', '閉じようかしらね', '閉じようかしらん',
    '閉じようかのう', '閉じようかの', '閉じようかねえ',
  ])('JA youka II %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA のは evaluation -> close-tab
    '閉じてもらうのはどう', '閉じてもらうのは', '閉じてくれるのはどう',
    '閉じてくれるのは', '閉じるのはどうかな', '閉じるのはいかが',
    '閉じるのはまずい', '閉じるのはあり', '閉じるのはありかな',
    '閉じるのはまずいかな', '閉じるのはありだよね', '閉じるのはどうだろう',
  ])('JA noha %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA ちゃう residue -> close-tab
    '閉じちゃうよ', '閉じちゃうわ', '閉じちゃうね', '閉じちゃいます',
    '閉じちゃいますよ', '閉じちゃうかな', '閉じちゃうかも',
    '閉じちゃおうか', '閉じちゃったけどいいよね', '閉じちゃっていいかな',
    '閉じちゃっていいよな', '閉じちゃえばいい', '閉じちゃう方がいい',
  ])('JA chau %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // ambiguity pins kept
    ['閉じるのはだめかな', null],   // "closing it would be no good" — negate-ish
    ['閉じるのはだめ', null],       // same ambiguity
  ])('pin %s', (p, expected) => {
    expect(key(mk(), p)).toBe(expected);
  });
});
