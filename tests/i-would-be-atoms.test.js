'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('i-would-be atoms', () => {
  const vc = mk();
const cases = [
    // JA — てもらいます residue
    ['閉じてもらいますか','close-tab'],
    ['閉じてもらいましょう','close-tab'],
    ['閉じてもらいますね','close-tab'],
    // JA — てくる residue LXX
    ['閉じてくるのがよい','close-tab'],
    ['閉じてくるしかない','close-tab'],
    ['閉じてくるんです','close-tab'],
    // JA — dict 極意/神髄 noun tails XLI
    ['閉じるのが極意だ','close-tab'],
    ['閉じるのが神髄だ','close-tab'],
    ['閉じるのが肝要だ','close-tab'],
    ['閉じるのが要諦だ','close-tab'],
    ['閉じるのが骨子だ','close-tab'],
    ['閉じるのが神髄です','close-tab'],
    // EN LXXXIV — "i would be most grateful/obliged"
    ['i would be most grateful if youd close it','close-tab'],
    ['i would be most obliged if youd close it','close-tab'],
    ['i would be eternally grateful if youd close it','close-tab'],
    ['i would be forever grateful if youd close it','close-tab'],
    ['i would be deeply grateful if youd close it','close-tab'],
    ['i would be truly grateful if youd close it','close-tab'],
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
