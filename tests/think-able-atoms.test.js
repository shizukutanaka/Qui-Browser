'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('think-able atoms', () => {
  const vc = mk();
const cases = [
    // JA — てもらえないかな residue
    ['閉じてもらえないかな','close-tab'],
    ['閉じてもらえないかしら','close-tab'],
    ['閉じてもらえないものか','close-tab'],
    // JA — ていただけないかな residue
    ['閉じていただけないかな','close-tab'],
    ['閉じていただけないかしら','close-tab'],
    ['閉じていただけないものか','close-tab'],
    // JA — dict 急所 residue XXV (進言/建言 family)
    ['閉じるのが急所と進言します','close-tab'],
    ['閉じるのが勘所と進言します','close-tab'],
    ['閉じるのが要諦と進言します','close-tab'],
    ['閉じるのが眼目と進言します','close-tab'],
    ['閉じるのが狙い目と進言します','close-tab'],
    ['閉じるのが急所と建言します','close-tab'],
    // EN CXV — "do you think you could|would be able to|might be able to"
    ['do you think you could close it','close-tab'],
    ['do you think you would be able to close it','close-tab'],
    ['do you think you might be able to close it','close-tab'],
    ['do you suppose you could close it','close-tab'],
    ['do you imagine you could close it','help'],
    ['do you dream you could close it','help'],
    ['do you guess you could close it','help'],
    ['do you believe you could close it','help'],
    ['do you figure you could close it','close-tab'],
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
