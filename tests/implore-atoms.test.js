'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('implore atoms', () => {
  const vc = mk();
const cases = [
    // JA — てようがない/てようが促動 residue
    ['閉じるようがないんですが','trouble'],
    ['閉じておくようがないと','close-tab'],
    // JA — てもらい敬語 residue
    ['閉じてもらいなさい','close-tab'],
    ['閉じてもらいます','close-tab'],
    ['閉じてもらうがよい','close-tab'],
    ['閉じてもらえたら幸い','close-tab'],
    // JA — dict 始末/決着 noun tails XIII
    ['閉じるのが始末だ','close-tab'],
    ['閉じるのが決着だ','close-tab'],
    ['閉じるのが落ちだ','close-tab'],
    ['閉じるのが収まりだ','close-tab'],
    ['閉じるのが一段落だ','close-tab'],
    ['閉じるのが仕納めだ','close-tab'],
    // EN LVI — "pretty please intensifiers"
    ['pretty please with sugar on top, close it','close-tab'],
    ['pretty pretty please, close it','close-tab'],
    ['i implore you, close it','close-tab'],
    ['i beseech thee, close it','close-tab'],
    ['i entreat you to close it','close-tab'],
    ['i importune you to close it','close-tab'],
    ['i supplicate you to close it','close-tab'],
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
