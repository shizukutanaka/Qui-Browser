'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('welcome-frame atoms', () => {
  const vc = mk();
const cases = [
    // JA — てしまい結果報告尾 (regret-neutral completion)
    ['閉じてしまったようです','close-tab'],
    ['閉じてしまったみたいです','close-tab'],
    ['閉じてしまったところです','close-tab'],
    ['閉じてしまいますから','close-tab'],
    // JA — てはじめて/てはじめた inception
    ['閉じてはじめていい','close-tab'],
    ['閉じてはじめてすっきり','close-tab'],
    // JA — dict 手順/順序 operational tails VII
    ['閉じるのが手順として正しい','close-tab'],
    ['閉じるのがプロセスだ','close-tab'],
    ['閉じるのがワークフローだ','close-tab'],
    ['閉じるのがステップだ','close-tab'],
    ['閉じるのが工程だ','close-tab'],
    ['閉じるのが標準だ','close-tab'],
    // EN L — "im ready/willing" + "if you please" formal residue
    ['im ready for you to close it','close-tab'],
    ['im willing for you to close it','close-tab'],
    ['im happy for you to close it','close-tab'],
    ['im prepared for you to close it','close-tab'],
    ['id welcome you closing it','close-tab'],
    ['id welcome it if youd close it','close-tab'],
    ['id appreciate it ever so much if youd close it','close-tab'],
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
