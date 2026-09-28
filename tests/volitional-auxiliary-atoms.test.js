'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('volitional-auxiliary atoms', () => {
  const vc = mk();
  const cases = [
    ['閉じてくれるかなあ','close-tab'],
    ['閉じてくれるかしらね','close-tab'],
    ['閉じてくれるのを望む','close-tab'],
    ['閉じてくれるといいんだが','close-tab'],
    ['閉じてくれればそれで足りる','close-tab'],
    ['閉じてくれたのならば','close-tab'],
    ['閉じてくれようとは','close-tab'],
    ['閉じておいてもらえば','close-tab'],
    ['閉じておいてもらいたいんだけど','close-tab'],
    ['閉じておいてもらいたいものだ','close-tab'],
    ['閉じておかせてくれ','close-tab'],
    ['閉じておかせていただきます','close-tab'],
    ['閉じておきたいと願っております','close-tab'],
    ['閉じるのでしたらば','close-tab'],
    ['閉じるとすれば幸い','close-tab'],
    ['閉じるようであれば助かる','close-tab'],
    ['閉じるとお願いする','close-tab'],
    ['閉じると期待する','close-tab'],
    ['閉じるという条件で','close-tab'],
    ['im assuming you can close it','close-tab'],
    ['im hoping you can close it','close-tab'],
    ['im counting on you to close it','close-tab'],
    ['im relying on you to close it','close-tab'],
    ['im betting you can close it','close-tab'],
    ['id wager you could close it','close-tab'],
    ['ill assume youll close it','close-tab'],
    ['correct me if im wrong but close it','close-tab'],
    ['if im not mistaken, close it','close-tab'],
    ['god willing, close it','close-tab'],
    ['heaven willing, close it','close-tab'],
    ['luck willing, close it','close-tab'],
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
