'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('not-mind atoms', () => {
  const vc = mk();
const cases = [
    // JA — ていただきたい residue
    ['閉じていただきたいです','close-tab'],
    ['閉じていただきたいのです','close-tab'],
    ['閉じていただきたく存じます','close-tab'],
    // JA — てくださいましたら residue II
    ['閉じてくださいましたら嬉しいです','close-tab'],
    ['閉じてくださいましたら助かります','close-tab'],
    ['閉じてくださいましたらと存じます','close-tab'],
    // JA — dict 急所 residue IX (何より/第一 family)
    ['閉じるのが急所なわけです','close-tab'],
    ['閉じるのが勘所なわけです','close-tab'],
    ['閉じるのが要諦なわけです','close-tab'],
    ['閉じるのが眼目なわけです','close-tab'],
    ['閉じるのが狙い目なわけです','close-tab'],
    ['閉じるのが急所というわけです','close-tab'],
    // EN XCIX — "i would not mind|object if you"
    ['i would not mind if you closed it','close-tab'],
    ['i would not object if you closed it','close-tab'],
    ['i would not mind it if youd close it','close-tab'],
    ['i would not object to you closing it','close-tab'],
    ['i would not be opposed to you closing it','close-tab'],
    ['i would not be averse to you closing it','close-tab'],
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
