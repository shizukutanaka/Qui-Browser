'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('done-deal atoms', () => {
  const vc = mk();
const cases = [
    // JA — てごらん/てご覧 benefactive-imperative residue
    ['閉じてごらん','close-tab'],
    ['閉じてごらんなさい','close-tab'],
    ['閉じてごらんよ','close-tab'],
    ['閉じてご覧になって','close-tab'],
    ['閉じてご覧いただければ','close-tab'],
    ['閉じてご覧になりますか','close-tab'],
    // JA — てこそ/てこそあれ emphatic
    ['閉じてこそいい','close-tab'],
    ['閉じてこそすっきりだ','close-tab'],
    ['閉じてこそ解決だ','close-tab'],
    // JA — dict 承認/賛同 noun tails V
    ['閉じるのが妥当だと考えます','close-tab'],
    ['閉じるのが賢明だと思います','close-tab'],
    ['閉じるのが正しい選択だ','close-tab'],
    ['閉じるのが理に適ってる','close-tab'],
    ['閉じるのが理屈だ','close-tab'],
    ['閉じるのが理にかなう','close-tab'],
    // EN XLVII — "be done with / done deal" frames
    ['lets be done with it and close it','close-tab'],
    ['id like to be done with it, close it','close-tab'],
    ['consider it done and close it','close-tab'],
    ['call it done and close it','close-tab'],
    ['mark it done and close it','close-tab'],
    ['write it off and close it','close-tab'],
    ['chalk it up and close it','close-tab'],
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
