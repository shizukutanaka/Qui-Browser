'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('quotative-irrealis atoms', () => {
  const vc = mk();
  const cases = [
    ['閉じてくれとは言えない','close-tab'],
    ['閉じてくれとしか言いようがない','close-tab'],
    ['閉じてくれと頼みたい','close-tab'],
    ['閉じてくれと願っている','close-tab'],
    ['閉じてくれそうですか','close-tab'],
    ['閉じてくれますのでは','close-tab'],
    ['閉じてくれようや','close-tab'],
    ['閉じるよう言ってる','close-tab'],
    ['閉じるよう言っておる','close-tab'],
    ['閉じるようにと','close-tab'],
    ['閉じるように頼んでる','close-tab'],
    ['閉じるようにお願いしてる','close-tab'],
    ['閉じるように言うてる','close-tab'],
    ['閉じるようにと言っている','close-tab'],
    ['閉じてもいいでしょうかね','close-tab'],
    ['閉じてもいいかなあ','close-tab'],
    ['閉じてもいいんかな','close-tab'],
    ['閉じてもいいことにして','close-tab'],
    ['閉じてもいいとするなら','close-tab'],
    ['is there any way you could close it','close-tab'],
    ['any way you could close it','close-tab'],
    ['any possibility you could close it','close-tab'],
    ['is there a chance you could close it','close-tab'],
    ['by any chance close it','close-tab'],
    ['in the event you can, close it','close-tab'],
    ['in case you can, close it','close-tab'],
    ['whenever possible, close it','close-tab'],
    ['if at all feasible, close it','close-tab'],
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
