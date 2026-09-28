'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('so-sweet-as atoms', () => {
  const vc = mk();
const cases = [
    // JA — ていただけ residue
    ['閉じていただけますかしら','close-tab'],
    ['閉じていただけますかな','close-tab'],
    ['閉じていただけませんかね','close-tab'],
    // JA — ておく residue III
    ['閉じておく予定です','close-tab'],
    ['閉じておくつもりです','close-tab'],
    ['閉じておくことにする','close-tab'],
    // JA — dict 枢要/枢機 noun tails XLVI
    ['閉じるのが枢要だ','close-tab'],
    ['閉じるのが枢機だ','close-tab'],
    ['閉じるのが急所でしょう','close-tab'],
    ['閉じるのが要点ですね','close-tab'],
    ['閉じるのが急所ですよ','close-tab'],
    ['閉じるのが勘所です','close-tab'],
    // EN LXXXIX — "would you be so good|kind|sweet as to"
    ['would you be so good as to close it','close-tab'],
    ['would you be so sweet as to close it','close-tab'],
    ['would you be so lovely as to close it','close-tab'],
    ['would you be so gracious as to close it','close-tab'],
    ['would you be so kind as to close it','close-tab'],
    ['could you be so good as to close it','close-tab'],
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
