'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('probably-so atoms', () => {
  const vc = mk();
const cases = [
    // JA — てもらえるかな residue
    ['閉じてもらえるかな','close-tab'],
    ['閉じてもらえるかしら','close-tab'],
    ['閉じてもらえるだろうか','close-tab'],
    // JA — ていただけるかな residue
    ['閉じていただけるかな','close-tab'],
    ['閉じていただけるかしら','close-tab'],
    ['閉じていただけるだろうか','close-tab'],
    // JA — dict 急所 residue XXVI (提案/提唱 family)
    ['閉じるのが急所と提案します','close-tab'],
    ['閉じるのが勘所と提案します','close-tab'],
    ['閉じるのが要諦と提案します','close-tab'],
    ['閉じるのが眼目と提案します','close-tab'],
    ['閉じるのが狙い目と提案します','close-tab'],
    ['閉じるのが急所と提唱します','close-tab'],
    // EN CXVI — "do you think you could possibly|perhaps|conceivably"
    ['do you think you could possibly close it','close-tab'],
    ['do you think you could perhaps close it','close-tab'],
    ['do you think you could conceivably close it','close-tab'],
    ['do you think you could maybe close it','close-tab'],
    ['do you think you could probably close it','close-tab'],
    ['do you think you could potentially close it','close-tab'],
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
