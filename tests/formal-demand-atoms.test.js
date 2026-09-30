'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('formal-demand atoms (pass XCVIII)', () => {
  const vc = mk();
  const cases = [
    // JA — dict XXVII: べき+連体/必然 + こと-demand residue
    ['閉じるべきであります','close-tab'],
    ['閉じるべきでありましょう','close-tab'],
    ['閉じるべきと考えております','close-tab'],
    ['閉じるべきと心得ます','close-tab'],
    ['閉じるべきと心得ております','close-tab'],
    ['閉じるべきものと心得ております','close-tab'],
    ['閉じることを要請いたします','close-tab'],
    ['閉じることを要求いたします','close-tab'],
    ['閉じることを依頼いたします','close-tab'],
    ['閉じることを希望いたします','close-tab'],
    ['閉じることを期待しております','close-tab'],
    ['閉じることを願い出ます','close-tab'],
    ['閉じることをお願い申し上げる','close-tab'],
    ['閉じることをお願い致したく','close-tab'],
    ['閉じることが必須であります','close-tab'],
    ['閉じることが要件です','close-tab'],
    // JA — てなさる/てくださいませ residue + 関西尾
    ['閉じてなさいませ','close-tab'],
    ['閉じてくださいませよ','close-tab'],
    ['閉じてくださいますよう','close-tab'],
    ['閉じてくれはる','close-tab'],
    ['閉じてくれはりますか','close-tab'],
    ['閉じてもらえると','close-tab'],
    ['閉じてもらえるとありがたいんです','close-tab'],
    ['閉じてもらいたいものですね','close-tab'],
    // EN XXVII — gerund-object + passive 'have it' frames
    ['i need this closed','close-tab'],
    ['i need that closed','close-tab'],
    ['i need the tab closed','close-tab'],
    ['i want this closed','close-tab'],
    ['i want this gone','close-tab'],
    ['i want it gone','close-tab'],
    ['i want it shut','close-tab'],
    ['i want it closed','close-tab'],
    ['i want it closed now','close-tab'],
    ['get it closed','close-tab'],
    ['get that closed','close-tab'],
    ['close it, i owe ya','close-tab'],
    ['close it, and i owe you','close-tab'],
    ['close it, youll be doing me a favor','close-tab'],
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
