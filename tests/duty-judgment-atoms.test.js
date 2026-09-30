'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('duty-judgment atoms', () => {
  const vc = mk();
const cases = [
    // JA — てしまう 完結/後悔残置
    ['閉じてしまったほうがいいかと','close-tab'],
    ['閉じてしまったほうがよさそう','close-tab'],
    ['閉じてしまうのがいいかもしれん','close-tab'],
    ['閉じてしまうのも手か','close-tab'],
    ['閉じてしまうことを勧める','close-tab'],
    ['閉じてしまうことにしようか','close-tab'],
    ['閉じてしまうことにしている','close-tab'],
    ['閉じてしまうべきかと存じます','close-tab'],
    // JA — てみる 試行残置
    ['閉じてみるのが良いのでは','close-tab'],
    ['閉じてみるという手もある','close-tab'],
    ['閉じてみることも視野','close-tab'],
    ['閉じてみるべきでは','negate'],
    ['閉じてみるしかないじゃん','close-tab'],
    ['閉じてみたらいいんちゃう','close-tab'],
    // JA — dict 慣習/当然尾
    ['閉じるのが当然だ','close-tab'],
    ['閉じるのが常識だ','close-tab'],
    ['閉じるのが当たり前だ','close-tab'],
    ['閉じるのが自然だ','close-tab'],
    ['閉じるのが礼儀だ','close-tab'],
    ['閉じるのがお作法だ','close-tab'],
    // EN XXXVIII — "duty/business/job" nominal frames
    ['your job is to close it','close-tab'],
    ['your duty is to close it','close-tab'],
    ['your task is to close it','close-tab'],
    ['your mission is to close it','close-tab'],
    ['it is your job to close it','close-tab'],
    ['it falls to you to close it','close-tab'],
    ['the responsibility is yours to close it','close-tab'],
    ['someone has to close it','close-tab'],
    ['somebody has got to close it','close-tab'],
    ['it is high time you closed it','close-tab'],
    ['it is about time you closed it','close-tab'],
    ['it is past time you closed it','close-tab'],
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
