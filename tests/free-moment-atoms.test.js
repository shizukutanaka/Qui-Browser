'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('free-moment atoms', () => {
  const vc = mk();
const cases = [
    // JA — ておくんや residue (Kansai n-ya)
    ['閉じておくんや','close-tab'],
    ['閉じておくんやで','close-tab'],
    ['閉じておくんですから','close-tab'],
    // JA — ていただけ residue II
    ['閉じていただけますんで','close-tab'],
    ['閉じていただけりゃ','close-tab'],
    ['閉じていただけりゃあ','close-tab'],
    // JA — dict 段取/手筈 noun tails XXV
    ['閉じるのが手はずです','close-tab'],
    ['閉じるのが手筈だ','close-tab'],
    ['閉じるのが筋書きだ','close-tab'],
    ['閉じるのが手順書だ','close-tab'],
    ['閉じるのが決まりごとだ','close-tab'],
    ['閉じるのが決まりだ','close-tab'],
    // EN LXVIII — "when you get a moment / free second" II
    ['when you get a moment, close it','close-tab'],
    ['when you get a second, close it','close-tab'],
    ['when you get a minute, close it','close-tab'],
    ['when you get a chance, close it','close-tab'],
    ['when you get a free moment, close it','close-tab'],
    ['when you get a free second, close it','close-tab'],
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
