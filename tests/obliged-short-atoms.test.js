'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('obliged-short atoms', () => {
  const vc = mk();
const cases = [
    // JA — てくださいますれば residue
    ['閉じてくださいますれば幸いです','close-tab'],
    ['閉じてくださいますれば助かります','close-tab'],
    ['閉じてくださいますればありがたいです','close-tab'],
    // JA — ていただきますと residue
    ['閉じていただきますと幸いです','close-tab'],
    ['閉じていただきますと助かります','close-tab'],
    ['閉じていただきますとありがたいです','close-tab'],
    // JA — dict 急所 residue XIX (信念/確信 family)
    ['閉じるのが急所と確信しています','close-tab'],
    ['閉じるのが勘所と確信しています','close-tab'],
    ['閉じるのが要諦と確信しています','close-tab'],
    ['閉じるのが眼目と確信しています','close-tab'],
    ['閉じるのが狙い目と確信しています','close-tab'],
    ['閉じるのが急所と信じています','close-tab'],
    // EN CIX — "id be much|so|deeply|truly|most|ever obliged to"
    ['id be much obliged to close it','close-tab'],
    ['id be so obliged to close it','close-tab'],
    ['id be deeply obliged to close it','close-tab'],
    ['id be truly obliged to close it','close-tab'],
    ['id be most obliged to close it','close-tab'],
    ['id be ever obliged to close it','close-tab'],
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
