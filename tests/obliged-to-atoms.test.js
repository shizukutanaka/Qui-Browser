'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('obliged-to atoms', () => {
  const vc = mk();
const cases = [
    // JA — ていただいては residue
    ['閉じていただいてはいかがでしょう','close-tab'],
    ['閉じていただいてはどうでしょう','close-tab'],
    ['閉じていただいてはいかがですか','close-tab'],
    // JA — てもらうと residue VI
    ['閉じてもらうと助かります','close-tab'],
    ['閉じてもらうとありがたいです','close-tab'],
    ['閉じてもらうと嬉しいです','close-tab'],
    // JA — dict 急所 residue XVIII (見解/観測 family)
    ['閉じるのが急所という見解です','close-tab'],
    ['閉じるのが勘所という見解です','close-tab'],
    ['閉じるのが要諦という見解です','close-tab'],
    ['閉じるのが眼目という見解です','close-tab'],
    ['閉じるのが狙い目という見解です','close-tab'],
    ['閉じるのが急所と判断します','close-tab'],
    // EN CVIII — "i would be much|so|real|deeply|truly obliged to"
    ['i would be much obliged to close it','close-tab'],
    ['i would be so obliged to close it','close-tab'],
    ['i would be deeply obliged to close it','close-tab'],
    ['i would be truly obliged to close it','close-tab'],
    ['i would be most obliged to close it','close-tab'],
    ['i would be ever obliged to close it','close-tab'],
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
