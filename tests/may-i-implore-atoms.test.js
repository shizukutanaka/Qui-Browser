'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('may-i-implore atoms', () => {
  const vc = mk();
const cases = [
    // JA — ていただき residue
    ['閉じていただきたい','close-tab'],
    ['閉じていただきます','close-tab'],
    ['閉じていただきたいです','close-tab'],
    // JA — てくれ residual II
    ['閉じてくれんかの','close-tab'],
    ['閉じてくれんじゃないか','close-tab'],
    ['閉じてくれぬか','close-tab'],
    // JA — dict 大本/本元 noun tails XLVII
    ['閉じるのが大本だ','close-tab'],
    ['閉じるのが本元だ','close-tab'],
    ['閉じるのが根幹です','close-tab'],
    ['閉じるのが本筋ですね','close-tab'],
    ['閉じるのが基盤だ','close-tab'],
    ['閉じるのが土台だ','close-tab'],
    // EN XC — "may i ask|trouble|implore you"
    ['may i ask you to close it','close-tab'],
    ['may i trouble you to close it','close-tab'],
    ['may i implore you to close it','close-tab'],
    ['may i request you to close it','close-tab'],
    ['might i ask you to close it','close-tab'],
    ['might i trouble you to close it','close-tab'],
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
