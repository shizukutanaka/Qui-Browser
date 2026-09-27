'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('potential-demand atoms (pass XCIX)', () => {
  const vc = mk();
  const cases = [
    // JA — dict XXVIII: られる/れる短縮依頼 + 残置
    ['閉じられとく','close-tab'],
    ['閉じられといた','close-tab'],
    ['閉じられること','close-tab'],
    ['閉じられると','close-tab'],
    ['閉じられるように','close-tab'],
    ['閉じられることができますか','help'],
    ['閉じられると嬉しい','close-tab'],
    ['閉じられたい','close-tab'],
    ['閉じられたく','close-tab'],
    ['閉じられたく思います','close-tab'],
    // JA — てもろて/もらい dialect benefactive
    ['閉じてもろて','close-tab'],
    ['閉じてもろたら','close-tab'],
    ['閉じてもろうて','close-tab'],
    ['閉じてもらえるの','close-tab'],
    ['閉じてもらえるんで','close-tab'],
    ['閉じてもらえるんでしたら','close-tab'],
    ['閉じてもらうんです','close-tab'],
    ['閉じてもらうんですが','close-tab'],
    ['閉じてもらえたらと','close-tab'],
    // JA — てくだされ/たまえ残置
    ['閉じてくだされば','close-tab'],
    ['閉じてくだされよ','close-tab'],
    ['閉じてくだされ','close-tab'],
    ['閉じたまいよ','close-tab'],
    ['閉じたまえか','close-tab'],
    // EN XXVIII — "the ask" + gerund phrase swaps
    ['closing it would help','close-tab'],
    ['getting it closed would help','close-tab'],
    ['having it closed would be nice','close-tab'],
    ['closing it is the goal','close-tab'],
    ['the ask is that you close it','close-tab'],
    ['all i ask is that you close it','close-tab'],
    ['all im asking is that you close it','close-tab'],
    ['all i want is for you to close it','close-tab'],
    ['the thing is i need it closed','close-tab'],
    ['close it, that would be swell','close-tab'],
    ['close it, thatd be great','close-tab'],
    ['close it, would be appreciated','close-tab'],
    ['close it, if at all possible','close-tab'],
    ['close it, if humanly possible','close-tab'],
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
