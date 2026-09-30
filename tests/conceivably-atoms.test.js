'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('conceivably atoms', () => {
  const vc = mk();
const cases = [
    // JA — ていただければ residue
    ['閉じていただければ幸いです','close-tab'],
    ['閉じていただければと','close-tab'],
    ['閉じていただければ助かります','close-tab'],
    // JA — てくださいます residue
    ['閉じてくださいますかしら','close-tab'],
    ['閉じてくださいませんでしょうか','close-tab'],
    ['閉じてくださいますでしょうか','close-tab'],
    // JA — dict 急所 residue IV (のが○○だと思います family)
    ['閉じるのが急所だと思います','close-tab'],
    ['閉じるのが急所と存じます','close-tab'],
    ['閉じるのが勘所と考えます','close-tab'],
    ['閉じるのが要諦と思う','close-tab'],
    ['閉じるのが眼目かと','close-tab'],
    ['閉じるのが狙い目かと','close-tab'],
    // EN XCIV — "could you possibly|perhaps|maybe"
    ['could you possibly close it','close-tab'],
    ['could you perhaps close it','close-tab'],
    ['could you maybe close it','close-tab'],
    ['could you conceivably close it','close-tab'],
    ['might you possibly close it','close-tab'],
    ['would you perhaps close it','close-tab'],
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
