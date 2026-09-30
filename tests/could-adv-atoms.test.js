'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('could-adv atoms', () => {
  const vc = mk();
const cases = [
    // JA — てもらえますか residue
    ['閉じてもらえますか','close-tab'],
    ['閉じてもらえますかね','close-tab'],
    ['閉じてもらえますでしょうか','close-tab'],
    // JA — ていただけますか residue
    ['閉じていただけますか','close-tab'],
    ['閉じていただけますかね','close-tab'],
    ['閉じていただけますでしょうか','close-tab'],
    // JA — dict 急所 residue XXVII (所見/所感 family)
    ['閉じるのが急所という所見です','close-tab'],
    ['閉じるのが勘所という所見です','close-tab'],
    ['閉じるのが要諦という所見です','close-tab'],
    ['閉じるのが眼目という所見です','close-tab'],
    ['閉じるのが狙い目という所見です','close-tab'],
    ['閉じるのが急所という所感です','close-tab'],
    // EN CXVII — "you could|can probably|conceivably|possibly" → already green? probe family
    ['you could probably close it','close-tab'],
    ['you could conceivably close it','close-tab'],
    ['you could potentially close it','close-tab'],
    ['you could certainly close it','close-tab'],
    ['you could surely close it','close-tab'],
    ['you could maybe close it','close-tab'],
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
