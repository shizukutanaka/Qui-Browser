'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('frontrunner atoms', () => {
  const vc = mk();
const cases = [
    // JA — てみる residue
    ['閉じてみればどう','close-tab'],
    ['閉じてみるといいよ','close-tab'],
    ['閉じてみるのが吉','close-tab'],
    ['閉じてみるべし','close-tab'],
    // JA — てくれん dialect residue
    ['閉じてくれんか','close-tab'],
    ['閉じてくれんな','close-tab'],
    ['閉じてくれんよ','close-tab'],
    // JA — dict 本命/大本命 noun tails XVI
    ['閉じるのが本命だ','close-tab'],
    ['閉じるのが大本命だ','close-tab'],
    ['閉じるのが本命視だ','close-tab'],
    ['閉じるのが第一候補だ','close-tab'],
    ['閉じるのが本命筋だ','close-tab'],
    ['閉じるのが最有力だ','close-tab'],
    // EN LIX — "why not/what say" suggestion frames
    ['why dont we close it','close-tab'],
    ['why not close it','close-tab'],
    ['what say you close it','close-tab'],
    ['what do you say we close it','close-tab'],
    ['how about we close it','close-tab'],
    ['hows about you close it','close-tab'],
    ['what say we close it','close-tab'],
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
