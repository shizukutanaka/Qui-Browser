'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('be-a-dear atoms', () => {
  const vc = mk();
const cases = [
    // JA — てもらえたなら residue
    ['閉じてもらえたなら幸いです','close-tab'],
    ['閉じてもらえたなら助かります','close-tab'],
    ['閉じてもらえたならありがたいです','close-tab'],
    // JA — ていただけたなら residue
    ['閉じていただけたなら幸いです','close-tab'],
    ['閉じていただけたなら助かります','close-tab'],
    ['閉じていただけたならありがたいです','close-tab'],
    // JA — dict 急所 residue XXIV (推奨/助言 family)
    ['閉じるのが急所と推奨します','close-tab'],
    ['閉じるのが勘所と推奨します','close-tab'],
    ['閉じるのが要諦と推奨します','close-tab'],
    ['閉じるのが眼目と推奨します','close-tab'],
    ['閉じるのが狙い目と推奨します','close-tab'],
    ['閉じるのが急所と助言します','close-tab'],
    // EN CXIV — "would you be a dear|angel|love|pal|chap|sport to"
    ['would you be a dear to close it','close-tab'],
    ['would you be an angel to close it','close-tab'],
    ['would you be a love to close it','close-tab'],
    ['would you be a pal to close it','close-tab'],
    ['would you be a sport to close it','close-tab'],
    ['would you be a darling to close it','close-tab'],
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
