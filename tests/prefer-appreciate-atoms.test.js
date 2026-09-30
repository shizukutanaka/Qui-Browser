'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('prefer-appreciate atoms', () => {
  const vc = mk();
const cases = [
    // JA — ていただけます residue III
    ['閉じていただけますね','close-tab'],
    ['閉じていただけますわ','close-tab'],
    ['閉じていただけますかね','close-tab'],
    // JA — てくださったら residue
    ['閉じてくださったら幸いです','close-tab'],
    ['閉じてくださったら助かります','close-tab'],
    ['閉じてくださったらと思います','close-tab'],
    // JA — dict 急所 residue VIII (帰結/結節 family)
    ['閉じるのが急所かと存じます','close-tab'],
    ['閉じるのが勘所かと存じます','close-tab'],
    ['閉じるのが要諦かと存じます','close-tab'],
    ['閉じるのが眼目かと存じます','close-tab'],
    ['閉じるのが狙い目かと存じます','close-tab'],
    ['閉じるのが急所であると考えます','close-tab'],
    // EN XCVIII — "i would prefer|appreciate if you"
    ['i would prefer if you closed it','close-tab'],
    ['i would appreciate if you closed it','close-tab'],
    ['i would prefer that you close it','close-tab'],
    ['i would appreciate that you close it','close-tab'],
    ['i would prefer it if youd close it','close-tab'],
    ['i would appreciate it if youd close it','close-tab'],
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
