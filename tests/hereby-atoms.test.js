'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('hereby atoms', () => {
  const vc = mk();
const cases = [
    // JA — てくださいゃ/くださいね residue
    ['閉じてくださいましょうか','close-tab'],
    ['閉じてくださいませね','close-tab'],
    ['閉じてくださいなし','close-tab'],
    // JA — てほしくて residue
    ['閉じてほしくてね','close-tab'],
    ['閉じてほしくてな','close-tab'],
    ['閉じてほしくてならないのです','close-tab'],
    // JA — dict 理屈/理由 noun tails XXIII
    ['閉じるのが理だ','close-tab'],
    ['閉じるのが道理だ','close-tab'],
    ['閉じるのが理義だ','close-tab'],
    ['閉じるのが筋目だ','close-tab'],
    ['閉じるのが良識だ','close-tab'],
    ['閉じるのが判明だ','close-tab'],
    // EN LXVI — "herewith / hereby / thereupon" + formal
    ['herewith close it','close-tab'],
    ['hereby close it','close-tab'],
    ['i hereby instruct you to close it','close-tab'],
    ['i hereby direct you to close it','close-tab'],
    ['i direct you to close it','close-tab'],
    ['i instruct you to close it','close-tab'],
    ['i bid you close it','close-tab'],
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
