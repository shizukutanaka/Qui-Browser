// Pass CCIV — cornice atom sweep: EN you-imperative vocatives + request-
// outcome frames; JA ば-residue + forgot/left-open reports + unmet-expectation
// はず II + exasperation particles (ったく/ったら/もう/本当).
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

describe('cornice atom sweep (CCIV)', () => {
  it.each([
    // EN you-imperative frames -> close-tab
    'you close it', 'you go close it', 'you go ahead and close it',
    'you just close it', 'close it you', 'close it you please',
    'youd close it', 'you can close it', 'you will close it',
    'you shall close it', 'you need to close it', 'you gotta close it',
    'you should close it', 'you might close it', 'you could close it',
    'you would close it', 'you best close it', 'you better close it',
    'you better just close it',
  ])('you-imperative %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN request-outcome frames -> close-tab
    'what i want is to close it', 'what i need is to close it',
    'all i want is it closed', 'all i need is it closed',
    'all im asking is it closed', 'all im asking is you close it',
    'im asking you to close it', 'im telling you to close it',
    'im begging you to close it', 'im begging for it closed',
    'im asking nicely close it', 'im asking nicely for you to close it',
  ])('request-outcome %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA ば-residue -> close-tab
    '閉じれば', '閉じればいい', '閉じればいいよ', '閉じればいいんだけど',
    '閉じればいいんです', '閉じればいいのに', '閉じればよい',
    '閉じればよいぞ', '閉じればよいのに', '閉じれば済む',
    '閉じれば済むのに', '閉じれば解決', '閉じればいいじゃない',
    '閉じればよろしい', '閉じればよろしいのに', '閉じればいいはず',
    '閉じればいい筈', '閉じばいい', '閉じゃいい', '閉じりゃいい',
    '閉じたらいいのでは', '閉じちゃえばいい',
  ])('JA ba-residue %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA forgot/left-open reports IV -> close-tab
    '閉じ忘れてる', '閉じ忘れてた', '閉じるの忘れてたよ',
    '閉じ忘れてたわ',
  ])('JA forgot %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA left-open state reports -> describe-tab
    '閉じっぱなしにしてた', '閉じっぱなしだったよ', '閉じ忘れたまま',
    '開きっぱなしにしてた', '開いたまんま', '開いたまんまだった',
  ])('JA state %s -> describe-tab', (p) => {
    expect(key(mk(), p)).toBe('describe-tab');
  });

  it.each([
    // JA unmet-expectation はず II -> trouble
    '閉じられるはずだった', '閉じられるはずなのに', '閉じられるはず',
    '閉じるはずだったんだけど', '閉じるはずだったんだ',
    '閉じるはずのに', '閉じれてるはずだった', '閉じてるはずだった',
    '閉じてるはずのに', '閉じてたはず', '閉じてたはずだった',
    '閉じてたはずなのに',
  ])('JA hazu %s -> trouble', (p) => {
    expect(key(mk(), p)).toBe('trouble');
  });

  it.each([
    // JA exasperation particles -> close-tab
    '閉じてよ本当', '閉じてよまったく', '閉じてよったく',
    '閉じてよもう', '閉じてくださいよ本当', '閉じてよったら',
    '閉じなさいよったら', '閉じろよったら', '閉じれよったら',
    '閉じてほしいよもう',
  ])('JA exasperation %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });
});
