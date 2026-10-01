'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('most-happy atoms', () => {
  const vc = mk();
const cases = [
    // JA — てくださるなら residue
    ['閉じてくださるなら幸いです','close-tab'],
    ['閉じてくださるなら助かります','close-tab'],
    ['閉じてくださるならありがたいです','close-tab'],
    // JA — てくれたら residue IV
    ['閉じてくれたら一番です','close-tab'],
    ['閉じてくれたら最高です','close-tab'],
    ['閉じてくれたら嬉しいです','close-tab'],
    // JA — dict 急所 residue XVI (思考系強化)
    ['閉じるのが急所かと心得ております','close-tab'],
    ['閉じるのが勘所かと心得ております','close-tab'],
    ['閉じるのが要諦かと心得ております','close-tab'],
    ['閉じるのが眼目かと心得ております','close-tab'],
    ['閉じるのが狙い目かと心得ております','close-tab'],
    ['閉じるのが急所に存じます','close-tab'],
    // EN CVI — "id be only too happy|glad|delighted|pleased|willing|ready|prepared to"
    ['i would be most happy to close it','close-tab'],
    ['i would be most glad to close it','close-tab'],
    ['i would be most delighted to close it','close-tab'],
    ['i would be most pleased to close it','close-tab'],
    ['i would be most willing to close it','close-tab'],
    ['i would be most ready to close it','close-tab'],
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
