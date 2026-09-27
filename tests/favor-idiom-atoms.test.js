'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('favor-idiom atoms (pass CII)', () => {
  const vc = mk();
  const cases = [
    // JA — てはどう/いかが residue II
    ['閉じてはどうですかね','close-tab'],
    ['閉じては如何ですか','close-tab'],
    ['閉じてはどうかしら','close-tab'],
    ['閉じてはどうぞ','close-tab'],
    ['閉じてはいかがかと存じます','close-tab'],
    // JA — てあげる/てやる residue
    ['閉じてあげるわよ','close-tab'],
    ['閉じてあげるからね','close-tab'],
    ['閉じてあげますよ','close-tab'],
    ['閉じてあげてもいい','close-tab'],
    ['閉じてあげようか','close-tab'],
    ['閉じてあげるので','close-tab'],
    ['閉じてやるわ','close-tab'],
    ['閉じてやるんで','close-tab'],
    ['閉じてやろうか','close-tab'],
    ['閉じてやっから','close-tab'],
    // JA — dict 仮定/条件尾
    ['閉じるならよろしい','close-tab'],
    ['閉じるなら大丈夫です','close-tab'],
    ['閉じるなら構いません','close-tab'],
    ['閉じるならば結構です','close-tab'],
    ['閉じるのでしたら結構です','close-tab'],
    ['閉じるのであれば幸いです','close-tab'],
    // EN XXXI — if-only / just + favor blends
    ['if you could be so kind as to close it','close-tab'],
    ['if you could do me the favor of closing it','close-tab'],
    ['if you could see your way to closing it','close-tab'],
    ['if you could see your way clear to close it','close-tab'],
    ['i would take it kindly if you closed it','close-tab'],
    ['i would take it as a favor if you closed it','close-tab'],
    ['you would do well to close it','close-tab'],
    ['it behooves you to close it','close-tab'],
    ['close it, for my benefit','close-tab'],
    ['close it, as a kindness to me','close-tab'],
    ['close it, as a gesture of goodwill','close-tab'],
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
