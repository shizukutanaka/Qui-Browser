'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('capability-courtesy atoms', () => {
  const vc = mk();
const cases = [
    // JA — てもらう 代行/託付残置
    ['閉じてもらう手はずになっている','close-tab'],
    ['閉じてもらう算段だ','close-tab'],
    ['閉じてもらう段取りです','close-tab'],
    ['閉じてもらいたい旨','close-tab'],
    ['閉じてもらいたい所存','close-tab'],
    ['閉じてもらいたくお願いする','close-tab'],
    ['閉じてもらいたく申し上げます','close-tab'],
    // JA — てくる directional residue
    ['閉じてきてくれ','close-tab'],
    ['閉じてきてください','close-tab'],
    ['閉じてきてほしい','close-tab'],
    ['閉じてきてもらえますか','close-tab'],
    ['閉じてきてもらいたい','close-tab'],
    ['閉じてきなさい','close-tab'],
    // JA — dict 意図/計画名詞尾
    ['閉じる意向です','close-tab'],
    ['閉じる意図です','close-tab'],
    ['閉じる方針です','close-tab'],
    ['閉じる旨連絡','close-tab'],
    ['閉じるという方針で','close-tab'],
    ['閉じるつもりで進める','close-tab'],
    // EN XL — "mind" inversions + "good/kind enough" residue
    ['if you would be so good, close it','close-tab'],
    ['if youd be so good, close it','close-tab'],
    ['if you could be so good, close it','close-tab'],
    ['if you could see it in your heart, close it','close-tab'],
    ['if it is within your power, close it','close-tab'],
    ['if it lies within your power, close it','close-tab'],
    ['if it is no trouble at all, close it','close-tab'],
    ['if there is no inconvenience, close it','close-tab'],
    ['if it presents no difficulty, close it','close-tab'],
    ['if that is manageable, close it','close-tab'],
    ['if that works for you, close it','close-tab'],
    ['if that suits you, close it','close-tab'],
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
