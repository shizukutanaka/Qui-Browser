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

describe('coda-request & residue atoms (LXXXIII)', () => {
  const closeTab = [
    // benefactive residue XXI
    '閉じてくれませんな', '閉じてくれませんよ', '閉じてくれますかなあ',
    '閉じてもらうわよ', '閉じてもらうの', '閉じてもらうがな',
    '閉じてくださいねえ', '閉じてくださいよね', '閉じてくださいなあ', '閉じてくださいませよ',
    '閉じていいんだよ', '閉じていいわけ', '閉じていいんよ', '閉じていいのさ',
    '閉じてよかったかな', '閉じてくれるの', '閉じてくれるが',
    // dict residue XIII
    '閉じるもん', '閉じるもんだ', '閉じるもんね', '閉じるんだからさ',
    '閉じるんだわ', '閉じるんですよね', '閉じるしかないわ', '閉じるとかさ',
    // imperative residue
    '閉じよって', '閉じい',
    // EN residue
    'mind closing it real quick', 'we should close it', 'we could close it',
    'i suggest closing it', 'i suggest you close it',
    'closing it works', 'closing it works for me',
    'close it for me plz',
  ];
  test.each(closeTab.map((p) => [p]))('%s → close-tab', (p) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe('close-tab');
  });

  // Pins
  test.each([
    ['閉じるまい', 'negate'],
    ['閉じるものかな', 'negate'],
    ['閉じるべきでは', 'negate'],
    ['閉じるっけ', 'describe-tab'],
  ])('%s → %s', (p, k) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe(k);
  });
});
