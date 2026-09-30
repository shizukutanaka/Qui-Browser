'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('i-would-urge atoms', () => {
  const vc = mk();
const cases = [
    // JA — てみる residue II
    ['閉じてみるとするか','close-tab'],
    ['閉じてみようと思う','close-tab'],
    ['閉じてみるとしよう','close-tab'],
    // JA — てくれませんか residue II
    ['閉じてくれませんかしら','close-tab'],
    ['閉じてくれませんかねぇ','close-tab'],
    ['閉じてくれんですか','close-tab'],
    // JA — dict 骨髄/精髄 noun tails XLV
    ['閉じるのが骨髄だ','close-tab'],
    ['閉じるのが精髄だ','close-tab'],
    ['閉じるのが真髄だ','close-tab'],
    ['閉じるのが核心です','close-tab'],
    ['閉じるのが要諦です','close-tab'],
    ['閉じるのが急所ですね','close-tab'],
    // EN LXXXVIII — "i would ask|beg of you"
    ['i would ask of you that you close it','close-tab'],
    ['i would beg of you to close it','close-tab'],
    ['i would ask that you close it','close-tab'],
    ['i would request that you close it','close-tab'],
    ['i would urge you to close it','close-tab'],
    ['i would entreat you to close it','close-tab'],
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
