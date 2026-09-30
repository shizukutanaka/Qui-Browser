'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('so-adj-to atoms', () => {
  const vc = mk();
const cases = [
    // JA — てもらえたら residue
    ['閉じてもらえたら幸いです','close-tab'],
    ['閉じてもらえたら助かります','close-tab'],
    ['閉じてもらえたらありがたいです','close-tab'],
    // JA — てもらえると residue
    ['閉じてもらえると幸いです','close-tab'],
    ['閉じてもらえると助かります','close-tab'],
    ['閉じてもらえるとありがたいです','close-tab'],
    // JA — dict 急所 residue XX (認識/理解 family)
    ['閉じるのが急所と認識しています','close-tab'],
    ['閉じるのが勘所と認識しています','close-tab'],
    ['閉じるのが要諦と認識しています','close-tab'],
    ['閉じるのが眼目と認識しています','close-tab'],
    ['閉じるのが狙い目と認識しています','close-tab'],
    ['閉じるのが急所と理解しています','close-tab'],
    // EN CX — "would you be so kind|good|sweet|lovely|gracious|nice to"
    ['would you be so kind to close it','close-tab'],
    ['would you be so good to close it','close-tab'],
    ['would you be so sweet to close it','close-tab'],
    ['would you be so lovely to close it','close-tab'],
    ['would you be so gracious to close it','close-tab'],
    ['would you be so nice to close it','close-tab'],
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
