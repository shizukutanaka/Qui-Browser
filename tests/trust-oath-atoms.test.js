'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('trust-oath atoms', () => {
  const vc = mk();
const cases = [
    // JA — てよろしい formal instruction residue
    ['閉じてよろしい','close-tab'],
    ['閉じてよろしいです','close-tab'],
    ['閉じてよろしいか','close-tab'],
    ['閉じてよろしいぞ','close-tab'],
    // JA — てねば dialect imperative residue
    ['閉じてねばならん','close-tab'],
    ['閉じてねばいかん','close-tab'],
    // JA — dict 急務/要務 noun tails XII
    ['閉じるのが急務だ','close-tab'],
    ['閉じるのが要務だ','close-tab'],
    ['閉じるのが喫緊だ','close-tab'],
    ['閉じるのが先決だ','close-tab'],
    ['閉じるのが焦眉だ','close-tab'],
    ['閉じるのが火急だ','close-tab'],
    // EN LV — "word to the wise" + "trust me" frames
    ['word to the wise, close it','close-tab'],
    ['trust me on this, close it','close-tab'],
    ['take my word for it, close it','close-tab'],
    ['believe you me, close it','close-tab'],
    ['mark my words and close it','close-tab'],
    ['cross my heart, close it','close-tab'],
    ['swear to god, close it','close-tab'],
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
