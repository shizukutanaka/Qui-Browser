'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('have-it-done atoms', () => {
  const vc = mk();
const cases = [
    // JA — てよそ/てさえ concessive-conditional residue
    ['閉じてさえすればいい','close-tab'],
    ['閉じてさえくれれば','close-tab'],
    ['閉じてすらくれれば','close-tab'],
    ['閉じてすらいただければ','close-tab'],
    // JA — てばかり/てならない habitual
    ['閉じてばかりではだめ','negate'],
    ['閉じてならない','close-tab'],
    ['閉じてならないでしょう','close-tab'],
    ['閉じてなりません','close-tab'],
    // JA — dict 感嘆/評価尾VI
    ['閉じるのが爽快だ','close-tab'],
    ['閉じるのがすっきりだ','close-tab'],
    ['閉じるのが心地よい','close-tab'],
    ['閉じるのが清々しい','close-tab'],
    ['閉じるのが気分いい','close-tab'],
    ['閉じるのがさっぱりだ','close-tab'],
    // EN XLVIII — "now/lets see" + "lets have" frames
    ['now lets have it closed','close-tab'],
    ['lets have it closed','close-tab'],
    ['lets have it shut','close-tab'],
    ['lets have it gone','close-tab'],
    ['id have it closed','close-tab'],
    ['we should have it shut','close-tab'],
    ['i want it closed','close-tab'],
    ['i need it gone','close-tab'],
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
