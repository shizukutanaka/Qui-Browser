'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('done-with-it atoms', () => {
  const vc = mk();
const cases = [
    // JA — てほしい願望方言 residue
    ['閉じてほしいわー','close-tab'],
    ['閉じてほしいんか','close-tab'],
    ['閉じてほしいと願います','close-tab'],
    ['閉じてほしいと思っています','close-tab'],
    // JA — ておこう residue
    ['閉じておこうと思います','close-tab'],
    ['閉じておこうと思う','close-tab'],
    ['閉じておこうね','close-tab'],
    ['閉じておこうかな','close-tab'],
    // JA — dict 結果/成り行き noun tails X
    ['閉じるのが成り行きだ','close-tab'],
    ['閉じるのが結末だ','close-tab'],
    ['閉じるのが帰結だ','close-tab'],
    ['閉じるのが終わりだ','close-tab'],
    ['閉じるのが締めだ','close-tab'],
    ['閉じるのが仕舞いだ','close-tab'],
    // EN LIII — "be done" resolution frames
    ['be done with it, close it','close-tab'],
    ['lets be through with it and close it','close-tab'],
    ['i am through with it, close it','close-tab'],
    ['enough of that, close it','close-tab'],
    ['enough already, close it','close-tab'],
    ['that does it, close it','close-tab'],
    ['that settles it, close it','close-tab'],
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
