'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('wind-down atoms', () => {
  const vc = mk();
const cases = [
    // JA — てある/ておいた completion-benefactive residue
    ['閉じてあるべきだ','close-tab'],
    ['閉じてあるはずなのに','close-tab'],
    ['閉じておいたほうがいい','close-tab'],
    ['閉じておいたんだけどな','close-tab'],
    ['閉じておいたほうが','close-tab'],
    ['閉じてあると助かる','close-tab'],
    // JA — てから / てまで temporal sequence
    ['閉じてからでいい','close-tab'],
    ['閉じてからにして','close-tab'],
    ['閉じてまでしなくていい','negate'],
    ['閉じてからこそ','close-tab'],
    // JA — dict 段階/時機名詞尾IV
    ['閉じるのが順序だと考えます','close-tab'],
    ['閉じるのが時機だ','close-tab'],
    ['閉じるのが潮時だ','close-tab'],
    ['閉じるのが頃合いだ','close-tab'],
    ['閉じるのが佳境だ','close-tab'],
    ['閉じるのが正念場だ','close-tab'],
    // EN XLVI — "sign off / wind down / wrap" frames
    ['lets wrap this up and close it','close-tab'],
    ['time to wrap this up and close it','close-tab'],
    ['wind this down and close it','close-tab'],
    ['call it a day and close it','close-tab'],
    ['sign off and close it','close-tab'],
    ['shut it down for the night','close-tab'],
    ['put it to bed','close-tab'],
    ['turn out the lights on it','close-tab'],
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
