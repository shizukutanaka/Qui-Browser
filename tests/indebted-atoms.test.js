'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('indebted atoms', () => {
  const vc = mk();
const cases = [
    // JA — てくださいます residue II
    ['閉じてくださいますと幸いです','close-tab'],
    ['閉じてくださいますと助かります','close-tab'],
    ['閉じてくださいますとありがたい','close-tab'],
    // JA — ておく residue LXX
    ['閉じておくわけです','close-tab'],
    ['閉じておくものです','close-tab'],
    ['閉じておくのがよろしい','close-tab'],
    // JA — dict 節操/気概 noun tails XL
    ['閉じるのが節操だ','close-tab'],
    ['閉じるのが気概だ','close-tab'],
    ['閉じるのが意気だ','close-tab'],
    ['閉じるのが誇りだ','close-tab'],
    ['閉じるのが矜恃だ','close-tab'],
    ['閉じるのが矜持だ','close-tab'],
    // EN LXXXIII — "id be indebted/obliged forever"
    ['id be indebted to you if youd close it','close-tab'],
    ['id be forever indebted if youd close it','close-tab'],
    ['id be eternally grateful if youd close it','close-tab'],
    ['id be infinitely grateful if youd close it','close-tab'],
    ['id be beyond grateful if youd close it','close-tab'],
    ['id be undyingly grateful if youd close it','close-tab'],
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
