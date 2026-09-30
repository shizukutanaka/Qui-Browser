'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('thank-you-kindly atoms', () => {
  const vc = mk();
const cases = [
    // JA — ていただく residue (Kansai/itadaku chain)
    ['閉じていただくという形で','close-tab'],
    ['閉じていただくのがいいかと','close-tab'],
    ['閉じていただくようお願いする','close-tab'],
    // JA — ておくのも手 residue
    ['閉じておくのも手かも','close-tab'],
    ['閉じておくのもありかと','close-tab'],
    ['閉じておくのもいいかもしれん','close-tab'],
    // JA — dict 必須/必要 noun tails XXIX
    ['閉じるのが必須だ','close-tab'],
    ['閉じるのが必須です','close-tab'],
    ['閉じるのが必要だ','close-tab'],
    ['閉じるのが必要です','close-tab'],
    ['閉じるのが必然だ','close-tab'],
    ['閉じるのが不可欠だ','close-tab'],
    // EN LXXII — "i'll thank you / thank you kindly"
    ['ill thank you to close it','close-tab'],
    ['ill thank you kindly if you close it','close-tab'],
    ['id thank you to close it','close-tab'],
    ['thank you kindly for closing it','close-tab'],
    ['thanks kindly for closing it','close-tab'],
    ['thanking you in advance for closing it','close-tab'],
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
