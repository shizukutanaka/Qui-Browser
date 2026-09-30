'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('be-a-peach atoms', () => {
  const vc = mk();
const cases = [
    // JA — ておくのだ residue
    ['閉じておくんだよ','close-tab'],
    ['閉じておくのです','close-tab'],
    ['閉じておくというのが','close-tab'],
    // JA — てくれるか residue II
    ['閉じてくれるんじゃないか','close-tab'],
    ['閉じてくれるんじゃないの','close-tab'],
    ['閉じてくれるとか言わなかった','close-tab'],
    // JA — dict 結果/処理 noun tails XX
    ['閉じるのが措置だ','close-tab'],
    ['閉じるのが処置だ','close-tab'],
    ['閉じるのが処分だ','close-tab'],
    ['閉じるのが対処だ','close-tab'],
    ['閉じるのが処置です','close-tab'],
    ['閉じるのが処方だ','close-tab'],
    // EN LXIII — "be a darling / love / dear / lamb" vocative-beg II
    ['be a darling and close it','close-tab'],
    ['be a love and close it','close-tab'],
    ['be a dear and close it','close-tab'],
    ['be a lamb and close it','close-tab'],
    ['be an angel and close it','close-tab'],
    ['be a peach and close it','close-tab'],
    ['be a sport and close it','close-tab'],
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
