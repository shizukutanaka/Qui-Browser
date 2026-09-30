'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('wed-be-grateful atoms', () => {
  const vc = mk();
const cases = [
    // JA — てほしいもの residue II
    ['閉じてほしいものね','close-tab'],
    ['閉じてほしいものかな','close-tab'],
    ['閉じてほしいものです','close-tab'],
    // JA — てくる residue LXIX
    ['閉じてくるのがいい','close-tab'],
    ['閉じてくるべきだ','close-tab'],
    ['閉じてくる方向だ','close-tab'],
    // JA — dict 頂/絶好 noun tails XXXIX
    ['閉じるのが絶好だ','close-tab'],
    ['閉じるのが恰好だ','close-tab'],
    ['閉じるのが好機だ','close-tab'],
    ['閉じるのが機会だ','close-tab'],
    ['閉じるのが潮時です','close-tab'],
    ['閉じるのが旬だ','close-tab'],
    // EN LXXXII — "wed be grateful/appreciative"
    ['wed be grateful if youd close it','close-tab'],
    ['wed appreciate it if youd close it','close-tab'],
    ['we would be grateful if youd close it','close-tab'],
    ['we would appreciate it if youd close it','close-tab'],
    ['wed be most grateful if youd close it','close-tab'],
    ['wed be ever so grateful if youd close it','close-tab'],
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
