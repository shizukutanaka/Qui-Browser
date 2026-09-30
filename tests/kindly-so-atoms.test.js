'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('kindly-so atoms', () => {
  const vc = mk();
const cases = [
    // JA — てもらえば residue
    ['閉じてもらえば幸いです','close-tab'],
    ['閉じてもらえば助かります','close-tab'],
    ['閉じてもらえばありがたいです','close-tab'],
    // JA — ていただけば residue
    ['閉じていただけば幸いです','close-tab'],
    ['閉じていただけば助かります','close-tab'],
    ['閉じていただけばありがたいです','close-tab'],
    // JA — dict 急所 residue XXII (断定/断言 family)
    ['閉じるのが急所と断定します','close-tab'],
    ['閉じるのが勘所と断定します','close-tab'],
    ['閉じるのが要諦と断定します','close-tab'],
    ['閉じるのが眼目と断定します','close-tab'],
    ['閉じるのが狙い目と断定します','close-tab'],
    ['閉じるのが急所と断言します','close-tab'],
    // EN CXII — "would you kindly|please be so kind to"
    ['would you kindly be so kind to close it','close-tab'],
    ['would you please be so kind to close it','close-tab'],
    ['could you please be so kind to close it','close-tab'],
    ['would you please be so good to close it','close-tab'],
    ['could you please be so good to close it','close-tab'],
    ['would you kindly be so good to close it','close-tab'],
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
