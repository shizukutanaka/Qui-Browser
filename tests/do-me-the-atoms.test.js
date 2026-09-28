'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('do-me-the atoms', () => {
  const vc = mk();
const cases = [
    // JA — ておき residue
    ['閉じておきたい','close-tab'],
    ['閉じておきます','close-tab'],
    ['閉じておきましょう','close-tab'],
    // JA — てくれ residue LXXI
    ['閉じてくれたまえ','close-tab'],
    ['閉じてくれたまえよ','close-tab'],
    ['閉じてくれませんかなあ','close-tab'],
    // JA — dict 勘所/急所 noun tails XLII
    ['閉じるのが勘所だ','close-tab'],
    ['閉じるのが急所だ','close-tab'],
    ['閉じるのが急所です','close-tab'],
    ['閉じるのが急務です','close-tab'],
    ['閉じるのが眼目だ','close-tab'],
    ['閉じるのが狙い目だ','close-tab'],
    // EN LXXXV — "could you do me the courtesy/kindness of"
    ['could you do me the courtesy of closing it','close-tab'],
    ['could you do me the kindness of closing it','close-tab'],
    ['would you do me the courtesy of closing it','close-tab'],
    ['would you do me the honor of closing it','close-tab'],
    ['would you do me the favor of closing it','close-tab'],
    ['might you do me the kindness of closing it','close-tab'],
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
