'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('overdue-report atoms', () => {
  const vc = mk();
const cases = [
    // JA — てしまえ/てしまう 強い命令・勧告残置
    ['閉じてしまえって','close-tab'],
    ['閉じてしまえば','close-tab'],
    ['閉じてしまえや','close-tab'],
    ['閉じてしまえってば','close-tab'],
    ['閉じてしまわんか','close-tab'],
    ['閉じてしまおうぜ','close-tab'],
    ['閉じてしまおうか','close-tab'],
    // JA — てみろ/てみな imperative trial
    ['閉じてみろよ','close-tab'],
    ['閉じてみろって','close-tab'],
    ['閉じてみなって','close-tab'],
    ['閉じてみなさいって','close-tab'],
    ['閉じてみてもいいんじゃない','close-tab'],
    // JA — dict 習慣/方針宣言尾III
    ['閉じるのが我が家の方針','close-tab'],
    ['閉じるのがうちのやり方','close-tab'],
    ['閉じるのがこの家のルール','close-tab'],
    ['閉じるのが鉄則だ','close-tab'],
    ['閉じるのが心得だ','close-tab'],
    ['閉じるのが信条だ','close-tab'],
    // EN XLIV — "past due / overdue" + "high time" variants
    ['it is overdue to close it','close-tab'],
    ['the tab is overdue for closing','close-tab'],
    ['closing is past due','close-tab'],
    ['closing it is long overdue','close-tab'],
    ['it is long past time to close it','close-tab'],
    ['it was time to close it ages ago','close-tab'],
    ['ages ago you should have closed it','close-tab'],
    ['shoulda closed it long ago','close-tab'],
    ['shoulda closed it already','close-tab'],
    ['oughta close it already','close-tab'],
    ['gonna hafta close it','close-tab'],
    ['youre gonna hafta close it','close-tab'],
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
