'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('assertive-report atoms (pass CIII)', () => {
  const vc = mk();
  const cases = [
    // JA — てくれ + dialect/casual residue
    ['閉じてくれなんだけど','close-tab'],
    ['閉じてくれないんだけど','close-tab'],
    ['閉じてくれないんですが','close-tab'],
    ['閉じてくれるわけ','close-tab'],
    ['閉じてくれること','close-tab'],
    ['閉じてくれんの','close-tab'],
    ['閉じてくれんのかな','close-tab'],
    ['閉じてくれてもいいんだけど','close-tab'],
    // JA — ていただく deep residue
    ['閉じていただきたく存じ上げております','close-tab'],
    ['閉じていただけますよう','close-tab'],
    ['閉じていただけませんでしょうか','close-tab'],
    ['閉じていただきたくお願い申し上げる次第です','close-tab'],
    ['閉じていただくようお願いします','close-tab'],
    ['閉じていただきますようお願いいたします','close-tab'],
    // JA — dict 推量/意志尾
    ['閉じるだろうね','close-tab'],
    ['閉じるであろう','close-tab'],
    ['閉じるものと思われます','close-tab'],
    ['閉じるものと考えられます','close-tab'],
    ['閉じるものと見受けます','close-tab'],
    ['閉じるものと判断します','close-tab'],
    ['閉じるものと判断いたします','close-tab'],
    // EN XXXII — softened assertion frames
    ['i feel like it should be closed','close-tab'],
    ['i feel it should be closed','close-tab'],
    ['i think it needs to be closed','close-tab'],
    ['i believe it ought to be closed','close-tab'],
    ['i figure it should get closed','close-tab'],
    ['i reckon it wants closing','close-tab'],
    ['i guess the tab has to go','close-tab'],
    ['close it, id be grateful','close-tab'],
    ['close it, id appreciate it','close-tab'],
    ['close it, i would appreciate that','close-tab'],
    ['close it, i would appreciate it','close-tab'],
    ['close it, youd be doing me a solid','close-tab'],
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
