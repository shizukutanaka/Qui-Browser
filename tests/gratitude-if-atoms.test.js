'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('gratitude-if atoms', () => {
  const vc = mk();
const cases = [
    // JA — てみるわ/てみたら residue
    ['閉じてみるわよ','close-tab'],
    ['閉じてみるわね','close-tab'],
    ['閉じてみたらどうかね','close-tab'],
    ['閉じてみたらどうかなあ','close-tab'],
    // JA — てもろうて residue (Kansai double-te)
    ['閉じてもろうて','close-tab'],
    ['閉じてもろうてええか','close-tab'],
    ['閉じてもろてええ','close-tab'],
    // JA — dict 話/件 noun tails XXIV
    ['閉じるのが件だ','close-tab'],
    ['閉じるのが件です','close-tab'],
    ['閉じるのが件につき','close-tab'],
    ['閉じるのが話だ','close-tab'],
    ['閉じるのが話です','close-tab'],
    ['閉じるのがお話だ','close-tab'],
    // EN LXVII — "i'd be much obliged / in your debt" II
    ['id be much obliged if youd close it','close-tab'],
    ['id be in your debt if youd close it','close-tab'],
    ['youd have my gratitude if youd close it','close-tab'],
    ['id thank you kindly if youd close it','close-tab'],
    ['id be most grateful if youd close it','close-tab'],
    ['id take it kindly if youd close it','close-tab'],
    // pins
    ['閉じるべきかな','help'],
    ['閉じるものかな','negate'],
    ['閉じたはず','trouble'],
    ['閉じるっけ','describe-tab'],
    ['閉じなくていい','negate'],
    ['閉じるところです','describe-tab'],
  ];
  it.each(cases)('%s -> %s', (p, want) => {
    vc.lastCommand = null;
    vc.processCommand(p, 0.9);
    expect(vc.lastCommand ? vc.lastCommand.key : 'null').toBe(want);
  });
});
