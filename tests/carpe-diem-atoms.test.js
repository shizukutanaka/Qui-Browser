'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('carpe-diem atoms', () => {
  const vc = mk();
const cases = [
    // JA — てな formal instruction residue
    ['閉じてなって','close-tab'],
    ['閉じてなってば','close-tab'],
    ['閉じてなさいまし','close-tab'],
    ['閉じてなさるがよい','close-tab'],
    // JA — てとく residue
    ['閉じてとくべき','close-tab'],
    ['閉じてといてある','close-tab'],
    // JA — dict 常套/定石 noun tails XV
    ['閉じるのが常套手段だ','close-tab'],
    ['閉じるのが定番だ','close-tab'],
    ['閉じるのがお決まりだ','close-tab'],
    ['閉じるのが王道だ','close-tab'],
    ['閉じるのが正攻法だ','close-tab'],
    ['閉じるのが基本だ','close-tab'],
    // EN LVIII — "if ever there was time" urgency
    ['if ever there was a time, close it','close-tab'],
    ['now if ever, close it','close-tab'],
    ['theres no time like the present, close it','close-tab'],
    ['time and tide wait for no man, close it','close-tab'],
    ['strike while the iron is hot, close it','close-tab'],
    ['carpe diem, close it','close-tab'],
    ['seize the day and close it','close-tab'],
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
