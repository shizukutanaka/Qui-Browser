'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('word-is-command atoms', () => {
  const vc = mk();
const cases = [
    // JA — てやる強意志 dialect residue
    ['閉じてやるわい','close-tab'],
    ['閉じてやるんじゃ','close-tab'],
    ['閉じてやっちゃうわ','close-tab'],
    ['閉じてやりましょう','close-tab'],
    // JA — てかまわない/てもかまわない permission
    ['閉じてかまわない','close-tab'],
    ['閉じてかまいません','close-tab'],
    ['閉じてかまわないよ','close-tab'],
    // JA — dict 任務/役目 noun tails IX
    ['閉じるのが任務だ','close-tab'],
    ['閉じるのが役目だ','close-tab'],
    ['閉じるのが役割だ','close-tab'],
    ['閉じるのが役目です','close-tab'],
    ['閉じるのが責務だ','close-tab'],
    ['閉じるのが務めだ','close-tab'],
    // EN LII — "say when / word is bond" + "fire away" frames
    ['say when and close it','close-tab'],
    ['say the magic word and close it','close-tab'],
    ['your word is my command, close it','close-tab'],
    ['fire away and close it','close-tab'],
    ['go right ahead and close it','close-tab'],
    ['have at it and close it','close-tab'],
    ['knock yourself out and close it','close-tab'],
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
