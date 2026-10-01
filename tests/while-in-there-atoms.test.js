'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('while-in-there atoms', () => {
  const vc = mk();
const cases = [
    // JA — てちゃって/てじゃって residue
    ['閉じちゃってね','close-tab'],
    ['閉じちゃってよ','close-tab'],
    ['閉じじゃって','close-tab'],
    ['閉じじゃってよ','close-tab'],
    // JA — てくれぞ/てくれわ dialect
    ['閉じてくれぞ','close-tab'],
    ['閉じてくれわ','close-tab'],
    ['閉じてくれが','close-tab'],
    // JA — dict 心がけ/心得 noun tails XXVI
    ['閉じるのが心がけだ','close-tab'],
    ['閉じるのが心掛けだ','close-tab'],
    ['閉じるのが心得です','close-tab'],
    ['閉じるのが心持ちだ','close-tab'],
    ['閉じるのが気構えだ','close-tab'],
    ['閉じるのが覚悟です','close-tab'],
    // EN LXIX — "while youre at it / since youre there"
    ['while youre at it, close it','close-tab'],
    ['while youre at it close it','close-tab'],
    ['while youre in there, close it','close-tab'],
    ['since youre at it, close it','close-tab'],
    ['since youre in there, close it','close-tab'],
    ['as long as youre at it, close it','close-tab'],
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
