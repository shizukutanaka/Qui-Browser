'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('ever-so atoms', () => {
  const vc = mk();
const cases = [
    // JA — ておかれます residue (honorific)
    ['閉じておかれますか','close-tab'],
    ['閉じておかれますかしら','close-tab'],
    ['閉じておかれませんか','close-tab'],
    // JA — てくださる residue
    ['閉じてくださると幸いです','close-tab'],
    ['閉じてくださると助かります','close-tab'],
    ['閉じてくだされば幸いです','close-tab'],
    // JA — dict 急所 residue V (べき/べし family)
    ['閉じるのが急所べきだ','close-tab'],
    ['閉じるのが急所べしだ','close-tab'],
    ['閉じるのが勘所べきです','close-tab'],
    ['閉じるのが要諦べきだ','close-tab'],
    ['閉じるのが眼目べきだ','close-tab'],
    ['閉じるのが狙い目べきだ','close-tab'],
    // EN XCV — "i would be ever so grateful|appreciative"
    ['i would be ever so grateful if youd close it','close-tab'],
    ['i would be ever so appreciative if youd close it','close-tab'],
    ['i would be ever so thankful if youd close it','close-tab'],
    ['i would be ever so obliged if youd close it','close-tab'],
    ['i would be ever so glad if youd close it','close-tab'],
    ['i would be ever so happy if youd close it','close-tab'],
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
