// Pass CCXIII — truss atom sweep: EN nested-conditional/sooner idioms;
// JA nari/tara IV/nantoka/cho residue (truss = 束ねる).
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

describe('truss atom sweep (CCXIII)', () => {
  it.each([
    // EN nested-conditional convenience -> close-tab
    'close it if at all possible', 'close it if possible',
    'close it if you can', 'close it when possible', 'close it when able',
    'close it when you get a second', 'close it when you get a moment',
    'close it when you get a chance', 'close it when you have time',
    'close it when you have a sec', 'close it at your convenience',
    'close it at the earliest convenience',
  ])('conditional %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN sooner-idioms -> close-tab
    'the sooner you close it the better',
    'the quicker you close it the better',
    'sooner rather than later close it',
    'no time like the present close it',
    'theres no time like now close it',
    'strike while the iron is hot close it',
  ])('sooner %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA なり/とともに/ついで residue -> close-tab
    '閉じるなり', '閉じるなりと', '閉じるなりとも',
    '閉じるなりなんなりと', '閉じたなり', '閉じるとともに',
    '閉じるとともにね', '閉じると同時に', '閉じると同時にお願い',
    '閉じるついでに', '閉じるついで',
  ])('JA nari %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA たら suggestions IV -> close-tab
    '閉じたらどう', '閉じたらどうか', '閉じたらどうよ', '閉じたらどうだ',
    '閉じたらいいんじゃ', '閉じたらええやん', '閉じたらええ',
    '閉じたらええよ', '閉じたらいいではないか', '閉じたらいいではない',
    '閉じたらよろしいのでは', '閉じたらいかが', '閉じたらどうかね',
    '閉じたらどうかのう', '閉じたらもういい',
  ])('JA tara IV %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA なんとか determiner -> close-tab
    '閉じるのはなんとか', '閉じるのはなんとかして', '閉じるのはなんとかなる',
    '閉じることはなんとか', '閉じることはなんとかなる',
    '閉じなんとかして', '閉じるのをなんとかして', '閉じるの何とかして',
    '閉じなんとしても', '閉じるぞなんとか', 'なんとか閉じて',
    'なんとしても閉じて', 'なんとかして閉じて',
  ])('JA nantoka %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA ちょう/ちょ casual-tails -> close-tab
    '閉じてちょう', '閉じてちょ', '閉じてちょい', '閉じてちょっと',
    '閉じちょう', '閉じちょ', '閉じちょい', '閉じちょっと',
    '閉じてちょっとお願い', '閉じてちょっとね', '閉じちょって',
    '閉じてちょくれ',
  ])('JA cho %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // deliberation pin kept
    ['閉じるかなりか', 'help'],
  ])('pin %s', (p, expected) => {
    expect(key(mk(), p)).toBe(expected);
  });
});
