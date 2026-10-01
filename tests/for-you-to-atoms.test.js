'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('for-you-to atoms', () => {
  const vc = mk();
const cases = [
    // JA — ていただけません residue II
    ['閉じていただけませんかねぇ','close-tab'],
    ['閉じていただけませんこと','close-tab'],
    ['閉じていただけませんものですか','close-tab'],
    // JA — ておき residue IV
    ['閉じておきたいのです','close-tab'],
    ['閉じておきたいんです','close-tab'],
    ['閉じておきたいところです','close-tab'],
    // JA — dict 急所 residue VII (真打/大物 family)
    ['閉じるのが急所だと思う','close-tab'],
    ['閉じるのが勘所だと思う','close-tab'],
    ['閉じるのが要諦だと思う','close-tab'],
    ['閉じるのが眼目だと思う','close-tab'],
    ['閉じるのが狙い目だと思う','close-tab'],
    ['閉じるのが急所だと思うんです','close-tab'],
    // EN XCVII — "i would hate|love|like for you to"
    ['i would hate for you to close it','negate'],
    ['i would love for you to close it','close-tab'],
    ['i would like for you to close it','close-tab'],
    ['i would hate for it to stay open','close-tab'],
    ['i would love for it to be closed','close-tab'],
    ['i would like for it to be closed','close-tab'],
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
