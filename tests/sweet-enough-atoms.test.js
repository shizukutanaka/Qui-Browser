'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('sweet-enough atoms', () => {
  const vc = mk();
const cases = [
    // JA — てもらいたい residue II
    ['閉じてもらいたい次第です','close-tab'],
    ['閉じてもらいたい気持ちです','close-tab'],
    ['閉じてもらいたい所存でございます','close-tab'],
    // JA — ておく residue LXVI
    ['閉じておくのが吉だ','close-tab'],
    ['閉じておくのが得だ','close-tab'],
    ['閉じておくのが上策だ','close-tab'],
    // JA — dict 気遣い/配慮 noun tails XXXIV
    ['閉じるのが気遣いだ','close-tab'],
    ['閉じるのが配慮だ','close-tab'],
    ['閉じるのが心配りだ','close-tab'],
    ['閉じるのが思いやりだ','close-tab'],
    ['閉じるのが優しさだ','close-tab'],
    ['閉じるのが親切だ','close-tab'],
    // EN LXXVII — "would you be so kind as to / gracious enough to" II
    ['would you be so kind as to close it','close-tab'],
    ['would you be gracious enough to close it','close-tab'],
    ['would you be good enough to close it','close-tab'],
    ['would you be sweet enough to close it','close-tab'],
    ['would you be nice enough to close it','close-tab'],
    ['would you be lovely enough to close it','close-tab'],
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
