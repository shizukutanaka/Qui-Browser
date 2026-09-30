'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('trouble-you atoms', () => {
  const vc = mk();
const cases = [
    // JA — ていただければ residue II
    ['閉じていただければありがたい','close-tab'],
    ['閉じていただければ幸いです','close-tab'],
    ['閉じていただければ助かります','close-tab'],
    // JA — てみる residue LXVII
    ['閉じてみたほうがいいかも','close-tab'],
    ['閉じてみるのがいいかも','close-tab'],
    ['閉じてみるのもいいかも','close-tab'],
    // JA — dict 信念/信条 noun tails XXXV
    ['閉じるのが信念だ','close-tab'],
    ['閉じるのが信条です','close-tab'],
    ['閉じるのが主義だ','close-tab'],
    ['閉じるのが宗旨だ','close-tab'],
    ['閉じるのが所信だ','close-tab'],
    ['閉じるのが譲れない線だ','close-tab'],
    // EN LXXVIII — "if you wouldnt mind / could i trouble you" II
    ['if you wouldnt mind closing it','close-tab'],
    ['if you wouldnt mind could you close it','close-tab'],
    ['could i trouble you to close it','close-tab'],
    ['could i trouble you for a close','close-tab'],
    ['may i trouble you to close it','close-tab'],
    ['might i trouble you to close it','close-tab'],
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
