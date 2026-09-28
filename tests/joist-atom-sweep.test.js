// Pass CCIX — joist atom sweep: EN since/while tails + see-to-it delegation;
// JA opportunity nouns + てみる residue + だけでも + emphatic-not-done (trouble).
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

describe('joist atom sweep (CCIX)', () => {
  it.each([
    // EN since/while convenience tails -> close-tab
    'close it since youre there', 'close it since youre at it',
    'close it while youre at it', 'close it while youre there',
    'close it while youre in there', 'close it as you go',
    'close it on your way out', 'close it as you please',
    'close it at your leisure', 'close it in your own time',
    'close it at your earliest convenience',
  ])('convenience %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN suggestion frames -> close-tab
    'how about closing it', 'how about you close it',
    'how bout closing it', 'what about closing it',
    'what about you close it', 'why not close it',
  ])('suggestion %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN see-to-it delegation -> close-tab
    'see to it that it closes', 'see to it that the tab closes',
    'see that it closes', 'see that the tab closes',
    'make sure it closes', 'make sure the tab closes',
    'ensure it closes', 'be sure to close it', 'be sure it closes',
    'dont forget to close it', 'dont leave it open',
    'dont let it stay open',
  ])('delegation %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA opportunity/timing nouns -> close-tab
    '閉じる機会', '閉じる機会だ', '閉じる折り', '閉じる折に',
    '閉じる機が熟した', '閉じる潮時', '閉じる潮時だ', '閉じる潮時でした',
    '閉じる絶好の機会', '閉じる好機', '閉じる好機だ', '閉じる恰好の機会',
  ])('JA opportunity %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA てみる residue + だけでも + せめて -> close-tab
    '閉じてみる', '閉じてみよう', '閉じてみたら', '閉じてみたらいい',
    '閉じてみろ', '閉じてごらん', '閉じてごらんなさい', '閉じてみなさい',
    '閉じてみると', '閉じてみれば', '閉じてみたほうがいい', '閉じてみな',
    '閉じるだけでも', '閉じるだけでもいい', '閉じるせめて', 'せめて閉じて',
    '閉じるなんかして', '閉じるたびに忘れてた',
  ])('JA misc %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA emphatic not-done reports -> trouble
    '閉じてすらいない', '閉じてさえいない', '閉じてもいない',
    '閉じてすらない', '閉じてはいない', '閉じてはない',
    '閉じてなんていない',
  ])('JA not-done %s -> trouble', (p) => {
    expect(key(mk(), p)).toBe('trouble');
  });

  it.each([
    // ambiguous exclamatory / habitual forms stay null
    ['閉じるなんて', null], ['閉じるなんか', null],
    ['閉じたなんて', null], ['閉じたなんか', null],
    ['閉じるなんてして', null], ['閉じるなんてもの', null],
    ['閉じるなんてこと', null], ['閉じるなんて話', null],
    ['閉じるなんてしちゃって', null],
    ['閉じる度に', null], ['閉じるたびに', null], ['閉じるたび', null],
    ['閉じた覚えもない', null],
  ])('ambiguous %s stays null', (p, expected) => {
    expect(key(mk(), p)).toBe(expected);
  });
});
