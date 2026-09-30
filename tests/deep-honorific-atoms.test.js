'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('deep-honorific atoms', () => {
  const vc = mk();
  const cases = [
    ['閉じていただけましたら','close-tab'],
    ['閉じていただけましたら幸いです','close-tab'],
    ['閉じていただければと','close-tab'],
    ['閉じていただけましたなら','close-tab'],
    ['閉じていただけぬものか','close-tab'],
    ['閉じていただきますよう','close-tab'],
    ['閉じていただきたく存じ上げます','close-tab'],
    ['閉じてもらえるならば','close-tab'],
    ['閉じてもらえるのでしたら','close-tab'],
    ['閉じてもらえることが一番','close-tab'],
    ['閉じてもらえるわけですが','close-tab'],
    ['閉じてもらっております','close-tab'],
    ['閉じてもらうことになります','close-tab'],
    ['閉じることを切望する','close-tab'],
    ['閉じることを所望いたします','close-tab'],
    ['閉じることを請い願う','close-tab'],
    ['閉じるべく頼む','close-tab'],
    ['閉じるべくお願い申し上げる','close-tab'],
    ['閉じるようにと切に','close-tab'],
    ['out of the kindness of your heart, close it','close-tab'],
    ['as an act of kindness, close it','close-tab'],
    ['as an act of mercy, close it','close-tab'],
    ['as a personal favor to me, close it','close-tab'],
    ['as a favor to me, close it','close-tab'],
    ['oblige me and close it','close-tab'],
    ['indulge me and close it','close-tab'],
    ['humor me and close it','close-tab'],
    ['oblige me by closing it','close-tab'],
    ['indulge me by closing it','close-tab'],
    ['be an obliging soul and close it','close-tab'],
    ['kindly oblige me and close it','close-tab'],
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
