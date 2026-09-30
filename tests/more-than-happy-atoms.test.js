'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('more-than-happy atoms', () => {
  const vc = mk();
const cases = [
    // JA — ていただいて residue
    ['閉じていただいても','close-tab'],
    ['閉じていただいてよろしいでしょうか','close-tab'],
    ['閉じていただいて構いませんか','close-tab'],
    // JA — てくださった residue
    ['閉じてくださったでしょうか','close-tab'],
    ['閉じてくださったかしら','close-tab'],
    ['閉じてくださったりしますか','close-tab'],
    // JA — dict 急所 residue XII (至上命令 family)
    ['閉じるのが急所に存じ上げます','close-tab'],
    ['閉じるのが勘所に存じ上げます','close-tab'],
    ['閉じるのが要諦に存じ上げます','close-tab'],
    ['閉じるのが眼目に存じ上げます','close-tab'],
    ['閉じるのが狙い目に存じ上げます','close-tab'],
    ['閉じるのが急所に考えます','close-tab'],
    // EN CII — "id be more than happy|delighted|pleased|glad|happy|willing to"
    ['id be more than happy to close it','close-tab'],
    ['id be more than delighted to close it','close-tab'],
    ['id be more than pleased to close it','close-tab'],
    ['id be more than glad to close it','close-tab'],
    ['id be more than willing to close it','close-tab'],
    ['id be more than ready to close it','close-tab'],
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
