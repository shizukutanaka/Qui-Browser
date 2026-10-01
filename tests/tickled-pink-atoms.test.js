'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('tickled-pink atoms', () => {
  const vc = mk();
const cases = [
    // JA — てほしい residue II
    ['閉じてほしいですか','close-tab'],
    ['閉じてほしいかどうか','close-tab'],
    ['閉じてほしいと言って','close-tab'],
    // JA — ておく residue LXV
    ['閉じておくのを忘れた','close-tab'],
    ['閉じておくと良かった','close-tab'],
    ['閉じておくんだったわ','close-tab'],
    // JA — dict 礼式/敬意 noun tails XXXII
    ['閉じるのが礼式だ','close-tab'],
    ['閉じるのが敬意だ','close-tab'],
    ['閉じるのが敬意です','close-tab'],
    ['閉じるのが義理だ','close-tab'],
    ['閉じるのが道義だ','close-tab'],
    ['閉じるのが礼儀です','close-tab'],
    // EN LXXV — "id be obliged/honored/thrilled if youd" III
    ['id be obliged if youd close it','close-tab'],
    ['id be honored if youd close it','close-tab'],
    ['id be thrilled if youd close it','close-tab'],
    ['id be delighted if youd close it','close-tab'],
    ['id be chuffed if youd close it','close-tab'],
    ['id be tickled pink if youd close it','close-tab'],
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
