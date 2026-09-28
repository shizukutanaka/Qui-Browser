'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('could-so-adj atoms', () => {
  const vc = mk();
const cases = [
    // JA — ていただきましたら residue
    ['閉じていただきましたら幸いです','close-tab'],
    ['閉じていただきましたら助かります','close-tab'],
    ['閉じていただきましたらありがたいです','close-tab'],
    // JA — てもらったら residue
    ['閉じてもらったら幸いです','close-tab'],
    ['閉じてもらったら助かります','close-tab'],
    ['閉じてもらったらありがたいです','close-tab'],
    // JA — dict 急所 residue XXI (考察/分析 family)
    ['閉じるのが急所と考察します','close-tab'],
    ['閉じるのが勘所と考察します','close-tab'],
    ['閉じるのが要諦と考察します','close-tab'],
    ['閉じるのが眼目と考察します','close-tab'],
    ['閉じるのが狙い目と考察します','close-tab'],
    ['閉じるのが急所と分析します','close-tab'],
    // EN CXI — "could you be so kind|good|sweet|lovely|gracious|nice to"
    ['could you be so kind to close it','close-tab'],
    ['could you be so good to close it','close-tab'],
    ['could you be so sweet to close it','close-tab'],
    ['could you be so lovely to close it','close-tab'],
    ['could you be so gracious to close it','close-tab'],
    ['could you be so nice to close it','close-tab'],
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
