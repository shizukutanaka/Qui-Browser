'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('obligation-report atoms (pass XCVI)', () => {
  const vc = mk();
  const cases = [
    // JA 受益 XXXIV — てしまえ/しまい + 依頼残置
    ['閉じてしまってくれ','close-tab'],
    ['閉じてしまってください','close-tab'],
    ['閉じてしまいなさい','close-tab'],
    ['閉じてしまえと','close-tab'],
    ['閉じてしまえばいい','close-tab'],
    ['閉じてしまったほうがいい','close-tab'],
    ['閉じちまってくれ','close-tab'],
    ['閉じちまって','close-tab'],
    // JA dict XXV — 然るべき/要するに frames
    ['閉じるべきでは','negate'],
    ['閉じるべきかと','close-tab'],
    ['閉じるべきである','close-tab'],
    ['閉じるべきですよね','close-tab'],
    ['閉じるべきだと思う','close-tab'],
    ['閉じるべきだと思います','close-tab'],
    ['閉じるべきなんです','close-tab'],
    ['閉じるべきなんですが','close-tab'],
    ['要するに閉じて','close-tab'],
    ['結局閉じて','close-tab'],
    ['要は閉じて','close-tab'],
    ['つまるところ閉じて','close-tab'],
    // JA dict XXV cont — ことになる/しよう frames
    ['閉じることにしましょう','close-tab'],
    ['閉じることにしませんか','close-tab'],
    ['閉じることにしたい','close-tab'],
    ['閉じることにしていく','close-tab'],
    ['閉じることと致します','close-tab'],
    ['閉じることといたします','close-tab'],
    ['閉じることに致したい','close-tab'],
    ['閉じるものと存じ上げます','close-tab'],
    ['閉じるものと見ました','close-tab'],
    ['閉じるものと思いました','close-tab'],
    // EN XXV — gerund passive + preface frames
    ['how about you close it','close-tab'],
    ['what if you closed it','close-tab'],
    ['what do you say we close it','close-tab'],
    ['what if you went ahead and closed it','close-tab'],
    ['how come you havent closed it','close-tab'],
    ['why havent you closed it yet','close-tab'],
    ['why is it still open','describe-tab'],
    ['is it still open','describe-tab'],
    ['its still open','describe-tab'],
    ['it hasnt been closed yet','describe-tab'],
    ['it remains open','describe-tab'],
    ['its yet to be closed','describe-tab'],
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
