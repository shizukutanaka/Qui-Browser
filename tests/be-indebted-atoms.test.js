'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('be-indebted atoms', () => {
  const vc = mk();
const cases = [
    // JA — てもらえます residue
    ['閉じてもらえますかね','close-tab'],
    ['閉じてもらえませんかしら','close-tab'],
    ['閉じてもらえると助かる','close-tab'],
    // JA — ておき residue II
    ['閉じておきたいと思って','close-tab'],
    ['閉じておこうかと','close-tab'],
    ['閉じておいてもらえますか','close-tab'],
    // JA — dict 心髄/真骨頂 noun tails XLIV
    ['閉じるのが心髄だ','close-tab'],
    ['閉じるのが真骨頂だ','close-tab'],
    ['閉じるのが真髄です','close-tab'],
    ['閉じるのが奥義だ','close-tab'],
    ['閉じるのが秘訣だ','close-tab'],
    ['閉じるのが勘どころだ','close-tab'],
    // EN LXXXVII — "id be eternally|infinitely indebted|grateful"
    ['id be eternally indebted if youd close it','close-tab'],
    ['id be infinitely indebted if youd close it','close-tab'],
    ['id be forever indebted if youd close it','close-tab'],
    ['id be deeply indebted if youd close it','close-tab'],
    ['id be beyond grateful if youd close it','close-tab'],
    ['id be endlessly grateful if youd close it','close-tab'],
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
