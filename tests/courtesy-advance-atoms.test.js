'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('courtesy-advance atoms (pass CI)', () => {
  const vc = mk();
  const cases = [
    // JA — ちょうだい/頂戴 residue
    ['閉じてちょうだいな','close-tab'],
    ['閉じてちょうだいね','close-tab'],
    ['閉じてちょうだいなさい','close-tab'],
    ['閉じて頂戴な','close-tab'],
    ['閉じてちょうだいませ','close-tab'],
    ['閉じてちょうだいできますか','close-tab'],
    ['閉じてくださいまして','close-tab'],
    ['閉じてくださいましてね','close-tab'],
    // JA — ておき residue
    ['閉じておきたいんですが','close-tab'],
    ['閉じておきたいところです','close-tab'],
    ['閉じておきたいものです','close-tab'],
    ['閉じておいてもらいます','close-tab'],
    ['閉じておいてもらえますかね','close-tab'],
    ['閉じておいていただきたいんです','close-tab'],
    ['閉じておけばよかった','close-tab'],
    // JA — dict 理由/背景尾
    ['閉じるというわけです','close-tab'],
    ['閉じるという次第です','close-tab'],
    ['閉じる次第であります','close-tab'],
    ['閉じるという具合です','close-tab'],
    ['閉じるのが目的です','close-tab'],
    ['閉じるのが狙いです','close-tab'],
    ['閉じるのが目標です','close-tab'],
    // EN XXX — could you kindly + doubly-hedged
    ['would you be so kind as to close it','close-tab'],
    ['would you be so good as to close it','close-tab'],
    ['would you be kind enough to close it','close-tab'],
    ['would you be good enough to close it','close-tab'],
    ['i would ask that you close it','close-tab'],
    ['i would ask of you to close it','close-tab'],
    ['may i ask a favor of you, close it','close-tab'],
    ['close it, for my sake','close-tab'],
    ['close it, for old times sake','close-tab'],
    ['close it, do me the honor','close-tab'],
    ['close it, do me the courtesy','close-tab'],
    ['close it, you would be doing me a kindness','close-tab'],
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
