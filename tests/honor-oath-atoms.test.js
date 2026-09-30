'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('honor-oath atoms', () => {
  const vc = mk();
const cases = [
    // JA — てくれ短縮 dialect residue
    ['閉じてくれい','close-tab'],
    ['閉じてくれの','close-tab'],
    ['閉じてくれど','close-tab'],
    ['閉じてくれし','close-tab'],
    // JA — てかい dialect question residue
    ['閉じてかいの','close-tab'],
    ['閉じてかいな','close-tab'],
    // JA — dict 決意/覚悟 noun tails XIV
    ['閉じるのが決意だ','close-tab'],
    ['閉じるのが覚悟だ','close-tab'],
    ['閉じるのが腹だ','close-tab'],
    ['閉じるのが肝心だ','close-tab'],
    ['閉じるのが要だ','close-tab'],
    ['閉じるのが核心だ','close-tab'],
    // EN LVII — "on my honor/begins"
    ['on my honor, close it','close-tab'],
    ['i give you my word, close it','close-tab'],
    ['scout s honor, close it','close-tab'],
    ['cross my heart and hope to die, close it','close-tab'],
    ['may god strike me down, close it','close-tab'],
    ['on my mothers grave, close it','close-tab'],
    ['as god is my witness, close it','close-tab'],
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
