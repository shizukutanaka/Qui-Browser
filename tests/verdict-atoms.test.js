'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('verdict atoms', () => {
  const vc = mk();
const cases = [
    // JA — ておく confirmed-decision residue
    ['閉じておく算段だ','close-tab'],
    ['閉じておく手だ','close-tab'],
    ['閉じておく方向だ','close-tab'],
    ['閉じておくが吉','close-tab'],
    // JA — てみろ dialect residue
    ['閉じてみろう','close-tab'],
    ['閉じてみい','close-tab'],
    ['閉じてみなされ','close-tab'],
    // JA — dict 秘策/奥の手 noun tails XVII
    ['閉じるのが秘策だ','close-tab'],
    ['閉じるのが奥の手だ','close-tab'],
    ['閉じるのが切り札だ','close-tab'],
    ['閉じるのがとっておきだ','close-tab'],
    ['閉じるのが虎の子だ','close-tab'],
    ['閉じるのが隠し玉だ','close-tab'],
    // EN LX — "mums the word / final answer" closing frames
    ['final answer: close it','close-tab'],
    ['thats my final answer, close it','close-tab'],
    ['the verdict is in, close it','close-tab'],
    ['case closed, close it','close-tab'],
    ['decision made, close it','close-tab'],
    ['mums the word, close it','close-tab'],
    ['say no more, close it','close-tab'],
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
