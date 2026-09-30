'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('imperative-nasai atoms (pass CIV)', () => {
  const vc = mk();
  const cases = [
    // JA — なさい/なよ imperative residue
    ['閉じなさってください','close-tab'],
    ['閉じなされ','close-tab'],
    ['閉じなされて','close-tab'],
    ['閉じなさいますように','close-tab'],
    ['閉じなさるよう','close-tab'],
    ['閉じなさいな','close-tab'],
    ['閉じなさいって言って','close-tab'],
    // JA — てしまえ/ちまえ imperative residue
    ['閉じてしまいなよ','close-tab'],
    ['閉じてしまえよ','close-tab'],
    ['閉じてしまえばいいじゃん','close-tab'],
    ['閉じちまえ','close-tab'],
    ['閉じちまいな','close-tab'],
    ['閉じてしまいなさい','close-tab'],
    // JA — dict 様態/提案尾
    ['閉じるのもいいかもしれん','close-tab'],
    ['閉じるのもいいんでは','close-tab'],
    ['閉じるのも一手か','close-tab'],
    ['閉じるのも悪くない気がする','close-tab'],
    ['閉じるのも十分ありだ','close-tab'],
    ['閉じるのが良いように思う','close-tab'],
    ['閉じるのがいい気がしてきた','close-tab'],
    // EN XXXIII — self-addressed/observational frames
    ['note to self, close it','close-tab'],
    ['remind me to close it','defer'],
    ['someone close it','close-tab'],
    ['would someone close it','close-tab'],
    ['somebody shut it','close-tab'],
    ['lets close it up','close-tab'],
    ['shut it away','close-tab'],
    ['close it off','close-tab'],
    ['close it away','close-tab'],
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
