'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('deference atoms', () => {
  const vc = mk();
const cases = [
    // JA — ておいたら/ておいて residue
    ['閉じておいたらどうですかね','close-tab'],
    ['閉じておいたらば','close-tab'],
    ['閉じておいてね','close-tab'],
    ['閉じておいといて','close-tab'],
    // JA — てやって residue
    ['閉じてやってよ','close-tab'],
    ['閉じてやっておいて','close-tab'],
    // JA — dict 手順/作法 noun tails XXII
    ['閉じるのがやりようだ','close-tab'],
    ['閉じるのが手段だ','close-tab'],
    ['閉じるのが方策だ','close-tab'],
    ['閉じるのがやり口だ','close-tab'],
    ['閉じるのが作法です','close-tab'],
    ['閉じるのが手立てだ','close-tab'],
    // EN LXV — "out of respect / deference / courtesy"
    ['out of respect for me, close it','close-tab'],
    ['out of deference to me, close it','close-tab'],
    ['out of courtesy to me, close it','close-tab'],
    ['as a courtesy to me, close it','close-tab'],
    ['in deference to my wishes, close it','close-tab'],
    ['in consideration of me, close it','close-tab'],
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
