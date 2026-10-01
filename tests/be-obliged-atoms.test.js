'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('be-obliged atoms', () => {
  const vc = mk();
const cases = [
    // JA — てくれません residue
    ['閉じてくれませんだろうか','close-tab'],
    ['閉じてくれませんかねええ','close-tab'],
    ['閉じてくれませんでしょうかな','close-tab'],
    // JA — てもらえれば residue
    ['閉じてもらえれば幸いです','close-tab'],
    ['閉じてもらえればと','close-tab'],
    ['閉じてもらえればと思います','close-tab'],
    // JA — dict 要旨/趣旨 noun tails XLIII
    ['閉じるのが要旨だ','close-tab'],
    ['閉じるのが趣旨だ','close-tab'],
    ['閉じるのが主眼だ','close-tab'],
    ['閉じるのが本旨だ','close-tab'],
    ['閉じるのが旨趣だ','close-tab'],
    ['閉じるのが神髄ですね','close-tab'],
    // EN LXXXVI — "id be much|most|ever so obliged"
    ['id be much obliged if youd close it','close-tab'],
    ['id be ever so obliged if youd close it','close-tab'],
    ['id be most obliged if youd close it','close-tab'],
    ['id be deeply obliged if youd close it','close-tab'],
    ['id be so obliged if youd close it','close-tab'],
    ['id be truly obliged if youd close it','close-tab'],
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
