'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('would-be-happy atoms', () => {
  const vc = mk();
const cases = [
    // JA — ていただく residue
    ['閉じていただくと幸いです','close-tab'],
    ['閉じていただくと助かります','close-tab'],
    ['閉じていただく形で','close-tab'],
    // JA — てくださり residue
    ['閉じてくださり幸いです','close-tab'],
    ['閉じてくださり助かります','close-tab'],
    ['閉じてくださりと幸甚です','close-tab'],
    // JA — dict 急所 residue XI (至上/何より family)
    ['閉じるのが急所と考えております','close-tab'],
    ['閉じるのが勘所と考えております','close-tab'],
    ['閉じるのが要諦と考えております','close-tab'],
    ['閉じるのが眼目と考えております','close-tab'],
    ['閉じるのが狙い目と考えております','close-tab'],
    ['閉じるのが急所と心得ております','close-tab'],
    // EN CI — "i would be happy|delighted|pleased|glad|willing|ready to"
    ['i would be happy to close it','close-tab'],
    ['i would be delighted to close it','close-tab'],
    ['i would be pleased to close it','close-tab'],
    ['i would be glad to close it','close-tab'],
    ['i would be willing to close it','close-tab'],
    ['i would be ready to close it','close-tab'],
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
