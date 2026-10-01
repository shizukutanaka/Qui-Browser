'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('be-inclined atoms', () => {
  const vc = mk();
const cases = [
    // JA — てくれませんか residue III
    ['閉じてくれませんかねぇぇ','close-tab'],
    ['閉じてくれませんこと','close-tab'],
    ['閉じてくれませんものか','close-tab'],
    // JA — てもらえません residue
    ['閉じてもらえませんでしょうか','close-tab'],
    ['閉じてもらえないものですか','close-tab'],
    ['閉じてもらえませんこと','close-tab'],
    // JA — dict 急所 residue II
    ['閉じるのが急所ですか','close-tab'],
    ['閉じるのが核心だね','close-tab'],
    ['閉じるのが肝心です','close-tab'],
    ['閉じるのが急所かな','close-tab'],
    ['閉じるのが要諦でしょう','close-tab'],
    ['閉じるのが勘所だね','close-tab'],
    // EN XCII — "would you care to|be inclined to"
    ['would you care to close it','close-tab'],
    ['would you be inclined to close it','close-tab'],
    ['would you be willing to close it','close-tab'],
    ['would you be amenable to closing it','close-tab'],
    ['would you be disposed to close it','close-tab'],
    ['might you be inclined to close it','close-tab'],
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
