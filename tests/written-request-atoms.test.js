'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('written-request atoms (pass C)', () => {
  const vc = mk();
  const cases = [
    // JA — ては/てはいかが residue
    ['閉じてはいかがですか','close-tab'],
    ['閉じてはいかがかと','close-tab'],
    ['閉じてはどうでしょう','close-tab'],
    ['閉じてはどうかと思います','close-tab'],
    ['閉じては如何でしょうか','close-tab'],
    ['閉じては如何かと','close-tab'],
    // JA — てもらい + honorific deep
    ['閉じてもらいたく存じ上げます','close-tab'],
    ['閉じてもらえましたら','close-tab'],
    ['閉じてもらえましたら幸いです','close-tab'],
    ['閉じていただきたくお願いします','close-tab'],
    ['閉じていただきたく思っております','close-tab'],
    ['閉じていただけましたら幸甚に存じ上げます','close-tab'],
    // JA — くれる variant residue
    ['閉じてくれると嬉しいです','close-tab'],
    ['閉じてくれるとありがたいです','close-tab'],
    ['閉じてくれるのを願います','close-tab'],
    ['閉じてくれませんことでしょうか','close-tab'],
    ['閉じてくださいませんことでしょうか','close-tab'],
    ['閉じてくださいますようお願い致します','close-tab'],
    // JA — dict + ておく compound
    ['閉じるようにしておいて','close-tab'],
    ['閉じることにしておいて','close-tab'],
    // EN XXIX — formal written register
    ['i am writing to ask that you close it','close-tab'],
    ['i write to request that you close it','close-tab'],
    ['i am writing to request that you close it','close-tab'],
    ['per my request, close it','close-tab'],
    ['as per my request, close it','close-tab'],
    ['pursuant to my request, close it','close-tab'],
    ['kindly see to it that the tab is closed','close-tab'],
    ['close it, i would be much obliged','close-tab'],
    ['close it, i would be much appreciative','close-tab'],
    ['close it, much appreciated in advance','close-tab'],
    ['close it, thanks in advance','close-tab'],
    ['close it, thank you in advance','close-tab'],
    ['close it, in advance thank you','close-tab'],
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
