'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('be-a-pal atoms', () => {
  const vc = mk();
const cases = [
    // JA — てもいいか residue II
    ['閉じてもいいかなあ','close-tab'],
    ['閉じてもいいかしらね','close-tab'],
    ['閉じてもいいかなって','close-tab'],
    // JA — てほしいかな residue
    ['閉じてほしいかなあ','close-tab'],
    ['閉じてほしいかしら','close-tab'],
    ['閉じてほしいかも','close-tab'],
    // JA — dict 流儀/やりがい noun tails XXX
    ['閉じるのが流儀だ','close-tab'],
    ['閉じるのが流儀です','close-tab'],
    ['閉じるのがやり甲斐だ','close-tab'],
    ['閉じるのが仕方だ','close-tab'],
    ['閉じるのが遣り方だ','close-tab'],
    ['閉じるのが進め方だ','close-tab'],
    // EN LXXIII — "if youd be so kind/good" II
    ['if youd be so kind as to close it','close-tab'],
    ['if youd be so good as to close it','close-tab'],
    ['if youd be a dear and close it','close-tab'],
    ['if youd be an angel and close it','close-tab'],
    ['if youd be a love and close it','close-tab'],
    ['if youd be a pal and close it','close-tab'],
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
