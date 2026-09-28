'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('dare-challenge atoms', () => {
  const vc = mk();
const cases = [
    // JA — てしまう/ておく 依頼前置詞残置 (ところを/折の)
    ['閉じるところを見たい','close-tab'],
    ['閉じるところをみていただきたい','close-tab'],
    ['閉じるところを拝見したい','close-tab'],
    ['閉じるところをご覧になりたい','close-tab'],
    ['閉じるところをご覧に入れたい','close-tab'],
    ['閉じる所存です','close-tab'],
    // JA — ていく/てくる方向残置
    ['閉じていくべきだ','close-tab'],
    ['閉じていく方向で','close-tab'],
    ['閉じていくしかない','close-tab'],
    ['閉じていくことにする','close-tab'],
    ['閉じてくるべき','close-tab'],
    ['閉じてくるんだ','close-tab'],
    // EN XLV — "dare/bet/wager" + "last thing" frames
    ['id dare say you should close it','close-tab'],
    ['i dare you to close it','close-tab'],
    ['bet you cant close it','close-tab'],
    ['wager you cant close it','close-tab'],
    ['the last thing before bed, close it','close-tab'],
    ['last order of business, close it','close-tab'],
    ['last thing we do, close it','close-tab'],
    ['final thing on the agenda is to close it','close-tab'],
    ['closing it is the last order of business','close-tab'],
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
