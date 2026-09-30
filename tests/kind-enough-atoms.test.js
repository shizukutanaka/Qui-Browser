'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('kind-enough atoms', () => {
  const vc = mk();
const cases = [
    // JA — てもらえれば residue
    ['閉じてもらえれば幸いです','close-tab'],
    ['閉じてもらえれば助かります','close-tab'],
    ['閉じてもらえればと思います','close-tab'],
    // JA — ていただけると residue
    ['閉じていただけると幸いです','close-tab'],
    ['閉じていただけると助かります','close-tab'],
    ['閉じていただけると思います','close-tab'],
    // JA — dict 急所 residue X (最優先/急務 family)
    ['閉じるのが急所と存じ上げます','close-tab'],
    ['閉じるのが勘所と存じ上げます','close-tab'],
    ['閉じるのが要諦と存じ上げます','close-tab'],
    ['閉じるのが眼目と存じ上げます','close-tab'],
    ['閉じるのが狙い目と存じ上げます','close-tab'],
    ['閉じるのが急所と心得ます','close-tab'],
    // EN C — "if you would be so good|kind enough as to"
    ['if you would be so good as to close it','close-tab'],
    ['if you would be so kind enough as to close it','close-tab'],
    ['if you would be good enough as to close it','close-tab'],
    ['if you would be kind enough as to close it','close-tab'],
    ['if you would be gracious enough as to close it','close-tab'],
    ['if you would be sweet enough as to close it','close-tab'],
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
