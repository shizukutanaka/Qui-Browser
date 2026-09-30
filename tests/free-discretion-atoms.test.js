'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('free-discretion atoms', () => {
  const vc = mk();
const cases = [
    // JA — てくださいね residue II
    ['閉じてくださいねえ','close-tab'],
    ['閉じてくださいなあ','close-tab'],
    ['閉じてくださいよお','close-tab'],
    // JA — てしまおう residue
    ['閉じてしまおうか','close-tab'],
    ['閉じてしまおうぞ','close-tab'],
    ['閉じてしまおうね','close-tab'],
    // JA — dict 自由裁量 noun tails XXXI
    ['閉じるのが任意だ','close-tab'],
    ['閉じるのが随意だ','close-tab'],
    ['閉じるのが裁量だ','close-tab'],
    ['閉じるのが自由だ','close-tab'],
    ['閉じるのがお任せだ','close-tab'],
    ['閉じるのが一任だ','close-tab'],
    // EN LXXIV — "if you could find it in yourself / bring yourself to"
    ['if you could find it in yourself to close it','close-tab'],
    ['if you could bring yourself to close it','close-tab'],
    ['if you could manage to close it','close-tab'],
    ['if you could see fit to close it','close-tab'],
    ['if youd be kind enough to close it','close-tab'],
    ['if youd be good enough to close it','close-tab'],
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
