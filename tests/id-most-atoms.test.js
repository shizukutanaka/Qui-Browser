'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('id-most atoms', () => {
  const vc = mk();
const cases = [
    // JA — てくださいますよう residue
    ['閉じてくださいますようお願いします','close-tab'],
    ['閉じてくださいますようにお願いします','close-tab'],
    ['閉じてくださいますと助かります','close-tab'],
    // JA — てもらい residue IV
    ['閉じてもらい幸いです','close-tab'],
    ['閉じてもらい助かります','close-tab'],
    ['閉じてもらいと幸甚です','close-tab'],
    // JA — dict 急所 residue XVII (いえます/思われます family)
    ['閉じるのが急所と思われます','close-tab'],
    ['閉じるのが勘所と思われます','close-tab'],
    ['閉じるのが要諦と思われます','close-tab'],
    ['閉じるのが眼目と思われます','close-tab'],
    ['閉じるのが狙い目と思われます','close-tab'],
    ['閉じるのが急所と見受けられます','close-tab'],
    // EN CVII — "id be most happy|glad|delighted|pleased|willing|ready to"
    ['id be most happy to close it','close-tab'],
    ['id be most glad to close it','close-tab'],
    ['id be most delighted to close it','close-tab'],
    ['id be most pleased to close it','close-tab'],
    ['id be most willing to close it','close-tab'],
    ['id be most ready to close it','close-tab'],
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
