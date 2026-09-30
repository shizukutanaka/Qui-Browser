'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('be-opposed atoms', () => {
  const vc = mk();
const cases = [
    // JA — てもらい residue II
    ['閉じてもらいましょう','close-tab'],
    ['閉じてもらいますわ','close-tab'],
    ['閉じてもらいたいです','close-tab'],
    // JA — ていただきたい residue II
    ['閉じていただきたいのですが','close-tab'],
    ['閉じていただきたく','close-tab'],
    ['閉じていただきたく存じます','close-tab'],
    // JA — dict 急所 residue III
    ['閉じるのが急所かも','close-tab'],
    ['閉じるのが急所だろう','close-tab'],
    ['閉じるのが要諦だね','close-tab'],
    ['閉じるのが勘所かな','close-tab'],
    ['閉じるのが眼目です','close-tab'],
    ['閉じるのが狙い目です','close-tab'],
    // EN XCIII — "would you mind|be opposed to"
    ['would you mind closing it','close-tab'],
    ['would you be opposed to closing it','close-tab'],
    ['would you be averse to closing it','close-tab'],
    ['would you be adverse to closing it','close-tab'],
    ['would you be reluctant to close it','close-tab'],
    ['would you mind terribly closing it','close-tab'],
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
