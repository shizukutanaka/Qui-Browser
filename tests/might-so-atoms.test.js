'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('might-so atoms', () => {
  const vc = mk();
const cases = [
    // JA — てもらえませんか residue
    ['閉じてもらえませんか','close-tab'],
    ['閉じてもらえませんかね','close-tab'],
    ['閉じてもらえませんこと','close-tab'],
    // JA — ていただけませんか residue
    ['閉じていただけませんか','close-tab'],
    ['閉じていただけませんかね','close-tab'],
    ['閉じていただけませんこと','close-tab'],
    // JA — dict 急所 residue XXIII (主張/提言 family)
    ['閉じるのが急所と主張します','close-tab'],
    ['閉じるのが勘所と主張します','close-tab'],
    ['閉じるのが要諦と主張します','close-tab'],
    ['閉じるのが眼目と主張します','close-tab'],
    ['閉じるのが狙い目と主張します','close-tab'],
    ['閉じるのが急所と提言します','close-tab'],
    // EN CXIII — "might|may you be so kind|good to"
    ['might you be so kind to close it','close-tab'],
    ['may you be so kind to close it','close-tab'],
    ['might you be so good to close it','close-tab'],
    ['may you be so good to close it','close-tab'],
    ['might you be so sweet to close it','close-tab'],
    ['may you be so gracious to close it','close-tab'],
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
