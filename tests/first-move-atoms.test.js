'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('first-move atoms', () => {
  const vc = mk();
const cases = [
    // JA — ておくよう direction residue
    ['閉じておくよう進める','close-tab'],
    ['閉じておく方向で','close-tab'],
    ['閉じておく形で','close-tab'],
    // JA — てはいかが residue
    ['閉じてはいかがか','close-tab'],
    ['閉じてはいかがなものか','close-tab'],
    ['閉じてはどうかしらね','close-tab'],
    // JA — dict 初手/一手 noun tails XVIII
    ['閉じるのが初手だ','close-tab'],
    ['閉じるのが一の手だ','close-tab'],
    ['閉じるのが先手だ','close-tab'],
    ['閉じるのが第一歩だ','close-tab'],
    ['閉じるのが入口だ','close-tab'],
    ['閉じるのが取っ掛かりだ','close-tab'],
    // EN LXI — "do me the favor of" gerund variants
    ['do me the favor of closing it','close-tab'],
    ['do us the service of closing it','close-tab'],
    ['do me the courtesy of closing it','close-tab'],
    ['give me the pleasure of it being closed','close-tab'],
    ['treat me to a closed tab','close-tab'],
    ['bless me by closing it','close-tab'],
    ['grace me by closing it','close-tab'],
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
