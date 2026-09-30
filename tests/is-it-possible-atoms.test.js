'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('is-it-possible atoms', () => {
  const vc = mk();
const cases = [
    // JA — てくれませんか residue II
    ['閉じてくれませんこと','close-tab'],
    ['閉じてくれませんかねえ','close-tab'],
    ['閉じてくれませんの','close-tab'],
    // JA — てしまい residue
    ['閉じてしまいましょう','close-tab'],
    ['閉じてしまいなさい','close-tab'],
    ['閉じてしまいますか','close-tab'],
    // JA — dict 便宜/利益 noun tails XXXIII
    ['閉じるのが利益だ','close-tab'],
    ['閉じるのが便宜だ','close-tab'],
    ['閉じるのが便益だ','close-tab'],
    ['閉じるのが徳だ','close-tab'],
    ['閉じるのが得策だ','close-tab'],
    ['閉じるのが好都合だ','close-tab'],
    // EN LXXVI — "could you possibly / would it be possible"
    ['could you possibly close it','close-tab'],
    ['would it be possible to close it','close-tab'],
    ['would it be possible for you to close it','close-tab'],
    ['is it possible to close it','help'],
    ['is there any way you could close it','close-tab'],
    ['might it be possible to close it','close-tab'],
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
