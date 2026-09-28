'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('plug-pull atoms', () => {
  const vc = mk();
const cases = [
    // JA — てね exclamatory co-request
    ['閉じてねって','close-tab'],
    ['閉じてねー','close-tab'],
    ['閉じてよねって','close-tab'],
    // JA — てくれ exaggerated-longer variants
    ['閉じてくれよう','close-tab'],
    ['閉じてくれましょう','close-tab'],
    ['閉じてくれませんこと','close-tab'],
    // JA — dict 助言/忠告 noun tails VIII
    ['閉じるのが助言だ','close-tab'],
    ['閉じるのが忠告だ','close-tab'],
    ['閉じるのが進言だ','close-tab'],
    ['閉じるのが提言だ','close-tab'],
    ['閉じるのが指針だ','close-tab'],
    ['閉じるのが戒めだ','close-tab'],
    // EN LI — "verse/chorus" + "give it a rest" frames
    ['give it a rest and close it','close-tab'],
    ['give it a rest, close it','close-tab'],
    ['call it quits and close it','close-tab'],
    ['lets call it quits and close it','close-tab'],
    ['pull the plug on it','close-tab'],
    ['pull the plug and close it','close-tab'],
    ['shut the book on it','close-tab'],
    ['close the book on it','close-tab'],
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
