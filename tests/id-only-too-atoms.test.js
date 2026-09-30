'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('id-only-too atoms', () => {
  const vc = mk();
const cases = [
    // JA — ていただけば residue II
    ['閉じていただけば幸いです','close-tab'],
    ['閉じていただけば助かります','close-tab'],
    ['閉じていただけばと存じます','close-tab'],
    // JA — ていただくと residue II
    ['閉じていただくと助かります','close-tab'],
    ['閉じていただくとありがたいです','close-tab'],
    ['閉じていただくと嬉しいです','close-tab'],
    // JA — dict 急所 residue XIV (至上の命題 family)
    ['閉じるのが急所かと思い上げます','close-tab'],
    ['閉じるのが勘所かと思い上げます','close-tab'],
    ['閉じるのが要諦かと思い上げます','close-tab'],
    ['閉じるのが眼目かと思い上げます','close-tab'],
    ['閉じるのが狙い目かと思い上げます','close-tab'],
    ['閉じるのが急所かと存じ上げる次第です','close-tab'],
    // EN CIV — "id be only too|more than happy|glad|delighted|pleased|willing|happy to"
    ['id be only too happy to close it','close-tab'],
    ['id be only too glad to close it','close-tab'],
    ['id be only too delighted to close it','close-tab'],
    ['id be only too pleased to close it','close-tab'],
    ['id be only too willing to close it','close-tab'],
    ['id be only too ready to close it','close-tab'],
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
