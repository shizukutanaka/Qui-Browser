'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const calls = [];
  const tm = {
    activeTabId: 't1',
    tabs: [{ id: 't1', title: 'Example', url: 'https://ex' }],
    getActiveTab() { return this.tabs[0]; },
    closeAllTabs() { calls.push('closeAllTabs'); return 1; },
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  const said = [];
  vc.speak = (m) => said.push(m);
  return { vc, tm, calls, said };
}

function key(vc, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

describe('politeness residue atoms (LXXVIII)', () => {
  const closeTab = [
    '閉じてくれないかしら', '閉じてもらいましょうよ', '閉じてくれればそれでいい',
    '閉じてやるぞ', '閉じるのが一番だよ', '閉じるのが得策だ', '閉じるのが良い選択だ',
    '閉じることでいい', '閉じるならOK', '閉じちゃいなさいよ', '閉じちゃうのも悪くない',
    '閉じちゃってもかまわない', '閉じとくといい', '閉じとかないと',
    '閉じたらよろしいでしょうか', '閉じたらいいですよ', '閉じてくれうるか',
    "if you don't mind closing it", 'would you terribly mind closing it',
    "i'd be much obliged if you closed it", 'i would hate to ask but close it',
    'not to impose but close it', 'sorry to bother but close it',
    'pardon me but close it', 'forgive me for asking but close it',
    "i'll thank you to close it", "i'd thank you to close it",
    'it would do no harm to close it', "there's no harm in closing it",
    'closing it is an option', 'one option is to close it',
    'close it thank you kindly', 'close it would you mind awfully',
  ];
  test.each(closeTab.map((p) => [p]))('%s → close-tab', (p) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe('close-tab');
  });

  test.each([
    ['読んどかないと', 'read-aloud'],
    ['タブ畳んで', 'close-tab'],
    ['声をもっと小さく', 'volume-down'],
    ['最高ですね', 'ack'],
  ])('%s → %s', (p, k) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe(k);
  });

  // Pins: judgment questions still go to help; negations still negate
  test.each([
    ['閉じるのが正解かな', 'help'],
    ['閉じるべきかな', 'help'],
    ['閉じるものかな', 'negate'],
    ['閉じなくていい', 'negate'],
    ['閉じてもらえますか', 'close-tab'],
  ])('%s → %s', (p, k) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe(k);
  });
});
