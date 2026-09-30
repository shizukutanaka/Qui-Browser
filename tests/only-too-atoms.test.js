'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('only-too atoms', () => {
  const vc = mk();
const cases = [
    // JA — てくだされば residue II
    ['閉じてくださればありがたいです','close-tab'],
    ['閉じてくだされば幸いでございます','close-tab'],
    ['閉じてくだされば嬉しく存じます','close-tab'],
    // JA — てもらう residue V
    ['閉じてもらうのが一番です','close-tab'],
    ['閉じてもらうのが良いです','close-tab'],
    ['閉じてもらう方がいいです','close-tab'],
    // JA — dict 急所 residue XIII (何と言っても family)
    ['閉じるのが急所と言います','close-tab'],
    ['閉じるのが勘所と言います','close-tab'],
    ['閉じるのが要諦と言います','close-tab'],
    ['閉じるのが眼目と言います','close-tab'],
    ['閉じるのが狙い目と言います','close-tab'],
    ['閉じるのが急所と言えます','close-tab'],
    // EN CIII — "i would be only too happy|glad|delighted|pleased|willing|happy to"
    ['i would be only too happy to close it','close-tab'],
    ['i would be only too glad to close it','close-tab'],
    ['i would be only too delighted to close it','close-tab'],
    ['i would be only too pleased to close it','close-tab'],
    ['i would be only too willing to close it','close-tab'],
    ['i would be only too ready to close it','close-tab'],
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
