'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('ever-so-happy atoms', () => {
  const vc = mk();
const cases = [
    // JA — てくださるよう residue
    ['閉じてくださるようお願いします','close-tab'],
    ['閉じてくださるようにお願いします','close-tab'],
    ['閉じてくださると嬉しく思います','close-tab'],
    // JA — てくださると residue III
    ['閉じてくださると幸甚です','close-tab'],
    ['閉じてくださると有難いです','close-tab'],
    ['閉じてくださると幸せです','close-tab'],
    // JA — dict 急所 residue XV (至要 family)
    ['閉じるのが急所と考え上げます','close-tab'],
    ['閉じるのが勘所と考え上げます','close-tab'],
    ['閉じるのが要諦と考え上げます','close-tab'],
    ['閉じるのが眼目と考え上げます','close-tab'],
    ['閉じるのが狙い目と考え上げます','close-tab'],
    ['閉じるのが急所と思い上げます','close-tab'],
    // EN CV — "id be ever so happy|glad|delighted|pleased|willing|ready to"
    ['id be ever so happy to close it','close-tab'],
    ['id be ever so glad to close it','close-tab'],
    ['id be ever so delighted to close it','close-tab'],
    ['id be ever so pleased to close it','close-tab'],
    ['id be ever so willing to close it','close-tab'],
    ['id be ever so ready to close it','close-tab'],
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
