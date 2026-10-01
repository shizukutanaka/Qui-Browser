'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('housekeeping atoms', () => {
  const vc = mk();
const cases = [
    // JA — てあげる自発 + ておく報告残置
    ['閉じてあげるから','close-tab'],
    ['閉じてあげましょう','close-tab'],
    ['閉じておきましたよ','close-tab'],
    ['閉じておきましたから','close-tab'],
    ['閉じておいたので','close-tab'],
    ['閉じておいたから','close-tab'],
    // JA — てまで/てなり重複確認 + てゆけ dialect
    ['閉じてゆけばいい','close-tab'],
    ['閉じてゆくべき','close-tab'],
    ['閉じてゆくのがいい','close-tab'],
    // JA — dict 割合/程度 noun tails VI
    ['閉じるのが相当だ','close-tab'],
    ['閉じるのが度合いだ','close-tab'],
    ['閉じるのが程度だ','close-tab'],
    ['閉じるのが丁度いい','close-tab'],
    ['閉じるのがちょうどいい頃合','close-tab'],
    // EN XLIX — "by way of / as a matter of" + "out with" frames
    ['by way of tidying up, close it','close-tab'],
    ['as a matter of housekeeping, close it','close-tab'],
    ['in the interest of tidiness, close it','close-tab'],
    ['for the sake of cleanliness, close it','close-tab'],
    ['out with it, close it','close-tab'],
    ['speak the word and close it','close-tab'],
    ['say the word and close it','close-tab'],
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
