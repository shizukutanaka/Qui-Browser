'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('wonder-if atoms', () => {
  const vc = mk();
const cases = [
    // JA — ていただけません residue
    ['閉じていただけませんでしょうか','close-tab'],
    ['閉じていただけませんかなあ','close-tab'],
    ['閉じていただけますかねえ','close-tab'],
    // JA — てちゃい residue
    ['閉じてちゃいな','close-tab'],
    ['閉じてちゃいなよ','close-tab'],
    ['閉じてちゃおうかな','close-tab'],
    // JA — dict 礎/基礎 noun tails XLVIII
    ['閉じるのが礎だ','close-tab'],
    ['閉じるのが基礎だ','close-tab'],
    ['閉じるのが根本だ','close-tab'],
    ['閉じるのが基底だ','close-tab'],
    ['閉じるのが大黒柱だ','close-tab'],
    ['閉じるのが急所なり','close-tab'],
    // EN XCI — "i wonder if you would|could mind"
    ['i wonder if you would mind closing it','close-tab'],
    ['i wonder if you could mind closing it','close-tab'],
    ['i was wondering if you could close it','close-tab'],
    ['i had been wondering if you could close it','close-tab'],
    ['i wonder if you would be so kind as to close it','close-tab'],
    ['i am wondering if you could close it','close-tab'],
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
