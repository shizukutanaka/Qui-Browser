'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('humble-imperative atoms', () => {
  const vc = mk();
const cases = [
    // JA — お〜します humble-statement residue
    ['お閉じしたいんです','close-tab'],
    ['お閉じいたしますね','close-tab'],
    ['お閉じ申し上げます','close-tab'],
    ['お閉じ願います','close-tab'],
    ['お閉じお願いします','close-tab'],
    ['お閉じさせていただきます','close-tab'],
    // JA — ておき/ておけ command residue
    ['閉じておけよ','close-tab'],
    ['閉じておけって','close-tab'],
    ['閉じておけばいいじゃん','close-tab'],
    ['閉じておくんだったら','close-tab'],
    ['閉じておくのであれば','close-tab'],
    ['閉じておくがよろしい','close-tab'],
    // JA — dict 見解/立場尾
    ['閉じるのが見解だ','close-tab'],
    ['閉じるのが立場だ','close-tab'],
    ['閉じるという見解で','close-tab'],
    ['閉じるべきとの見解','close-tab'],
    ['閉じるのが私の意見','close-tab'],
    ['閉じるべきという意見','close-tab'],
    // EN XLI — "first thing / soon as / at first opportunity" time frames
    ['first thing you do, close it','close-tab'],
    ['the first thing you do is close it','close-tab'],
    ['at your first opportunity, close it','close-tab'],
    ['at the first opportunity, close it','close-tab'],
    ['at the earliest opportunity, close it','close-tab'],
    ['the moment you can, close it','close-tab'],
    ['the instant you can, close it','close-tab'],
    ['the second you get a chance, close it','close-tab'],
    ['the minute you have a moment, close it','close-tab'],
    ['when you have a free moment, close it','close-tab'],
    ['next chance you get, close it','close-tab'],
    ['when the opportunity arises, close it','close-tab'],
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
