'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('id-be-grateful atoms', () => {
  const vc = mk();
const cases = [
    // JA — ていただけますか residue II
    ['閉じていただけますかね','close-tab'],
    ['閉じていただけますでしょう','close-tab'],
    ['閉じていただけますよう','close-tab'],
    // JA — てしまう residue LXVIII
    ['閉じてしまうのが良い','close-tab'],
    ['閉じてしまうのが最善','close-tab'],
    ['閉じてしまうのが得策','close-tab'],
    // JA — dict 恒例/習わし noun tails XXXVI
    ['閉じるのが恒例だ','close-tab'],
    ['閉じるのが習わしだ','close-tab'],
    ['閉じるのが慣習です','close-tab'],
    ['閉じるのがしきたりだ','close-tab'],
    ['閉じるのがお約束だ','close-tab'],
    ['閉じるのが仕来りだ','close-tab'],
    // EN LXXIX — "id be grateful/thankful/appreciative if youd"
    ['id be grateful if youd close it','close-tab'],
    ['id be thankful if youd close it','close-tab'],
    ['id be appreciative if youd close it','close-tab'],
    ['id be so grateful if youd close it','close-tab'],
    ['id be mighty grateful if youd close it','close-tab'],
    ['id be real grateful if youd close it','close-tab'],
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
