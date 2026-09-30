'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('humor-me atoms', () => {
  const vc = mk();
const cases = [
    // JA — てある必要性 residue
    ['閉じてあるべきだ','close-tab'],
    ['閉じてあるのがいい','close-tab'],
    ['閉じてあるといい','close-tab'],
    // JA — てなに/なに-form residue
    ['閉じてもらうもん','close-tab'],
    ['閉じてもらうわけ','close-tab'],
    ['閉じてもらうのが筋','close-tab'],
    // JA — dict 合図/契機 noun tails XI
    ['閉じるのが合図だ','close-tab'],
    ['閉じるのが契機だ','close-tab'],
    ['閉じるのがきっかけだ','close-tab'],
    ['閉じるのが節目だ','close-tab'],
    ['閉じるのが境目だ','close-tab'],
    ['閉じるのが区切りだ','close-tab'],
    // EN LIV — "pretend/imagine hypotheticals"
    ['pretend i said close it','close-tab'],
    ['imagine i asked you to close it','close-tab'],
    ['humor me and close it','close-tab'],
    ['indulge me, close it','close-tab'],
    ['bear with me and close it','close-tab'],
    ['do me proud and close it','close-tab'],
    ['make my day and close it','close-tab'],
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
