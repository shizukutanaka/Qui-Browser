'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('would-obliged atoms', () => {
  const vc = mk();
const cases = [
    // JA — ていただきます residue II
    ['閉じていただきますね','close-tab'],
    ['閉じていただきますわ','close-tab'],
    ['閉じていただきまして','close-tab'],
    // JA — てくださいませ residue
    ['閉じてくださいませね','close-tab'],
    ['閉じてくださいませませ','close-tab'],
    ['閉じてくださいましたら','close-tab'],
    // JA — dict 急所 residue VI (ごとき/べからず family)
    ['閉じるのが急所ごときだ','close-tab'],
    ['閉じるのが急所級だ','close-tab'],
    ['閉じるのが勘所級だ','close-tab'],
    ['閉じるのが要諦級だ','close-tab'],
    ['閉じるのが眼目級だ','close-tab'],
    ['閉じるのが狙い目級だ','close-tab'],
    // EN XCVI — "i would be much|so|real obliged"
    ['i would be much obliged if youd close it','close-tab'],
    ['i would be so obliged if youd close it','close-tab'],
    ['i would be real obliged if youd close it','close-tab'],
    ['i would be deeply obliged if youd close it','close-tab'],
    ['i would be truly obliged if youd close it','close-tab'],
    ['i would be most obliged if youd close it','close-tab'],
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
