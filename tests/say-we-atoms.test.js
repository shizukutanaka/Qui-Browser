'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('say-we atoms', () => {
  const vc = mk();
const cases = [
    // JA — ていただきたい residue II
    ['閉じていただきたいのです','close-tab'],
    ['閉じていただきたく','close-tab'],
    ['閉じていただきたいもので','close-tab'],
    // JA — ておく residue LXVII+
    ['閉じておくに限ります','close-tab'],
    ['閉じておくのが得になる','close-tab'],
    ['閉じておくべきですか','close-tab'],
    // JA — dict 元/源流 noun tails XXXVII
    ['閉じるのが源流だ','close-tab'],
    ['閉じるのが本筋だ','close-tab'],
    ['閉じるのが本筋です','close-tab'],
    ['閉じるのが本道だ','close-tab'],
    ['閉じるのが正道だ','close-tab'],
    ['閉じるのが真っ当だ','close-tab'],
    // EN LXXX — "what say we / shall we say"
    ['what say we close it','close-tab'],
    ['shall we say we close it','close-tab'],
    ['how say you close it','close-tab'],
    ['say we close it','close-tab'],
    ['whaddya say we close it','close-tab'],
    ['what do ya say we close it','close-tab'],
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
