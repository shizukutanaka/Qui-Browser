'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('do-us-both atoms', () => {
  const vc = mk();
const cases = [
    // JA — てしまえば/てしまったら residue
    ['閉じてしまえばいいよ','close-tab'],
    ['閉じてしまえば良いではないか','close-tab'],
    ['閉じてしまったらどうかな','close-tab'],
    ['閉じてしまったらどうですかね','close-tab'],
    // JA — てまえ residue
    ['閉じてまえ','close-tab'],
    ['閉じてまえよ','close-tab'],
    // JA — dict 作業/用 noun tails XXI
    ['閉じるのが済ませ物だ','close-tab'],
    ['閉じるのが仕事だ','close-tab'],
    ['閉じるのが用だ','close-tab'],
    ['閉じるのが用事だ','close-tab'],
    ['閉じるのが仕事です','close-tab'],
    ['閉じるのが頼みだ','close-tab'],
    // EN LXIV — "kindly do me the honor / favor"
    ['kindly do me the honor of closing it','close-tab'],
    ['kindly do me the favor of closing it','close-tab'],
    ['grant me the favor and close it','close-tab'],
    ['confer upon me the favor and close it','close-tab'],
    ['do yourself a favor and close it','close-tab'],
    ['do us both a favor and close it','close-tab'],
    ['do everyone a favor and close it','close-tab'],
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
