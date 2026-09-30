'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('down-on-knees atoms', () => {
  const vc = mk();
const cases = [
    // JA — てもらえると residue
    ['閉じてもらえると助かる','close-tab'],
    ['閉じてもらえると嬉しい','close-tab'],
    ['閉じてもらえるとありがたい','close-tab'],
    // JA — てくれれば residue II
    ['閉じてくれればと','close-tab'],
    ['閉じてくれればと思う','close-tab'],
    ['閉じてくれればと願う','close-tab'],
    // JA — dict 余計/不足 noun tails XXVIII
    ['閉じるのが要領だ','close-tab'],
    ['閉じるのが手際だ','close-tab'],
    ['閉じるのが簡潔だ','close-tab'],
    ['閉じるのが簡明だ','close-tab'],
    ['閉じるのが手っ取り早い','close-tab'],
    ['閉じるのが早い','close-tab'],
    // EN LXXI — "i'm begging / pleading / imploring" II
    ['im begging you, close it','close-tab'],
    ['im pleading with you, close it','close-tab'],
    ['im imploring you, close it','close-tab'],
    ['im entreating you, close it','close-tab'],
    ['im beseaching you, close it','close-tab'],
    ['im down on my knees, close it','close-tab'],
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
