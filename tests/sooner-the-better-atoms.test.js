'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('sooner-the-better atoms', () => {
  const vc = mk();
const cases = [
    // JA — ておくしか residue
    ['閉じておくしかないんだ','close-tab'],
    ['閉じておくしかないです','close-tab'],
    ['閉じておくしかないんですが','close-tab'],
    // JA — てあげる benefactive II
    ['閉じてあげるのがいい','close-tab'],
    ['閉じてあげるのが筋だ','close-tab'],
    ['閉じてあげるのが妥当だ','close-tab'],
    // JA — dict 選択/岐路 noun tails XXVII
    ['閉じるのが選択肢だ','close-tab'],
    ['閉じるのが岐路だ','close-tab'],
    ['閉じるのが分かれ目だ','close-tab'],
    ['閉じるのが分岐点だ','close-tab'],
    ['閉じるのが選択だ','close-tab'],
    ['閉じるのが選びだ','close-tab'],
    // EN LXX — "the sooner the better / no time to lose"
    ['the sooner the better, close it','close-tab'],
    ['sooner the better, close it','close-tab'],
    ['no time to lose, close it','close-tab'],
    ['theres no time to lose, close it','close-tab'],
    ['not a moment too soon, close it','close-tab'],
    ['quick as you can, close it','close-tab'],
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
