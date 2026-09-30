'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('gratitude-debt atoms', () => {
  const vc = mk();
const cases = [
    // JA — てもらう 疑問形残置
    ['閉じてもらえるんでしょうか','close-tab'],
    ['閉じてもらえますでしょうかね','close-tab'],
    ['閉じてもらえぬものでしょうか','close-tab'],
    ['閉じてもらえますかいな','close-tab'],
    ['閉じてもらえますかしら','close-tab'],
    ['閉じてもらえんのかな','close-tab'],
    // JA — ておく 完了/準備報告
    ['閉じておくのがいいと思います','close-tab'],
    ['閉じておくに越したことはない','close-tab'],
    ['閉じておくべきかと思います','close-tab'],
    ['閉じておくしかないかも','close-tab'],
    ['閉じておきさえすれば','close-tab'],
    ['閉じておきゃあいい','close-tab'],
    // JA — dict 目的/理由名詞尾II
    ['閉じる目的です','close-tab'],
    ['閉じる理由です','close-tab'],
    ['閉じるためのものです','close-tab'],
    ['閉じるためなんです','close-tab'],
    ['閉じるという趣旨です','close-tab'],
    ['閉じるための指示です','close-tab'],
    // EN XLIII — "goodness/kindness" interjection + "much obliged" frames
    ['for goodness sake close it','close-tab'],
    ['for goodness sake, close it','close-tab'],
    ['for the love of god close it','close-tab'],
    ['for the love of pete close it','close-tab'],
    ['for heavens sake close it','close-tab'],
    ['for cryin out loud close it','close-tab'],
    ['id be ever so grateful if you closed it','close-tab'],
    ['id be eternally grateful if you closed it','close-tab'],
    ['much obliged if youd close it','close-tab'],
    ['id be forever in your debt if you closed it','close-tab'],
    ['id owe you big time if youd close it','close-tab'],
    ['you would earn my gratitude if youd close it','close-tab'],
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
