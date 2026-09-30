'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('appreciate-it atoms', () => {
  const vc = mk();
const cases = [
    // JA — てほしいです residue II
    ['閉じてほしいですわ','close-tab'],
    ['閉じてほしいのですが','close-tab'],
    ['閉じてほしい次第で','close-tab'],
    // JA — ておけ residue
    ['閉じておけば大丈夫です','close-tab'],
    ['閉じておけば間違いない','close-tab'],
    ['閉じておけば正解だ','close-tab'],
    // JA — dict 流儀/格 noun tails XXXVIII
    ['閉じるのが格だ','close-tab'],
    ['閉じるのが格式だ','close-tab'],
    ['閉じるのが体だ','close-tab'],
    ['閉じるのが体面だ','close-tab'],
    ['閉じるのが面目だ','close-tab'],
    ['閉じるのが意地だ','close-tab'],
    // EN LXXXI — "id appreciate it if you would/could" II
    ['id appreciate it if youd close it','close-tab'],
    ['id appreciate it if you would close it','close-tab'],
    ['id appreciate it if you could close it','close-tab'],
    ['id really appreciate it if youd close it','close-tab'],
    ['id truly appreciate it if youd close it','close-tab'],
    ['id surely appreciate it if youd close it','close-tab'],
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
