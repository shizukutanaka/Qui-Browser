'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('for-pitys-sake atoms', () => {
  const vc = mk();
const cases = [
    // JA — ておけば residue
    ['閉じておけばよかった','close-tab'],
    ['閉じておけばよい','close-tab'],
    ['閉じておけば大丈夫','close-tab'],
    ['閉じておけば安心','close-tab'],
    // JA — てある状態 report residue
    ['閉じてあるはずです','close-tab'],
    ['閉じてあるべきだった','close-tab'],
    ['閉じてあるところです','close-tab'],
    // JA — dict 残り/末 noun tails XIX
    ['閉じるのが結論だ','close-tab'],
    ['閉じるのが答えだ','close-tab'],
    ['閉じるのが解答だ','close-tab'],
    ['閉じるのが解だ','close-tab'],
    ['閉じるのが至極だ','close-tab'],
    ['閉じるのが真髄だ','close-tab'],
    // EN LXII — "for the love of" exasperation II
    ['for the love of mike, close it','close-tab'],
    ['for gods sake close it','close-tab'],
    ['for christs sake close it','close-tab'],
    ['for heavens sake close it','close-tab'],
    ['for pitys sake close it','close-tab'],
    ['for goodness sake close it','close-tab'],
    ['for the love of god close it','close-tab'],
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
