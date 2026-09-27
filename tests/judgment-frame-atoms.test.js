'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = {
    activeTabId: 't1',
    tabs: [{ id: 't1', title: 'Example', url: 'https://ex' }],
    getActiveTab() { return this.tabs[0]; },
    closeAllTabs() { return 1; },
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return { vc };
}

function key(vc, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

describe('judgment-frame & insist atoms (XC)', () => {
  const closeTab = [
    // benefactive XXVIII
    '閉じてくれはります', '閉じてくれよなあ', '閉じてくれなあ',
    '閉じてくれよー', '閉じてくれー', '閉じてもろうて',
    // dict XX (こと-/ほうが-評価系)
    '閉じることにしておきましょう', '閉じることにいたします', '閉じることと存じます',
    '閉じることも考えもの', '閉じることも悪くない', '閉じることも一考',
    '閉じることは必須', '閉じることがベター', '閉じることがベスト',
    '閉じることが肝要', '閉じることが先決',
    '閉じるほうが筋', '閉じるほうが道理', '閉じるほうが本筋',
    '閉じるほうが順当だ', '閉じるほうが妥当だ', '閉じるほうが正しい',
    '閉じるほうが正解', '閉じるほうが正解だ', '閉じるほうがよいかと',
    '閉じるほうがよいかと思う', '閉じるほうがよいと思われる',
    '閉じるほうが賢明かと思います',
    // EN XIX
    'i must insist you close it', 'i insist you close it',
    'i urge you to close it', 'i implore you please close it',
    'i petition you to close it', 'i am asking that you close it',
    'may i have you close it', 'might i have you close it',
    'could i have you close it',
    'oblige me and close it', 'gratify me and close it',
    'close it pretty please with a cherry on top',
    'close it if you would be so kind as to',
    'close it whenever it suits you', 'close it at whatever point works',
    'close it on your own time',
  ];
  test.each(closeTab.map((p) => [p]))('%s → close-tab', (p) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe('close-tab');
  });

  test.each([
    ['閉じるべきかな', 'help'],
    ['閉じるものかな', 'negate'],
    ['閉じたはず', 'trouble'],
    ['閉じるっけ', 'describe-tab'],
    ['could i close it', 'help'],
  ])('%s → %s', (p, k) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe(k);
  });
});
