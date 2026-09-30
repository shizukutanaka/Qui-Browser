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

describe('keigo-coda & residue atoms (LXXXIV)', () => {
  const closeTab = [
    // keigo/benefactive XXII
    '閉じてくださいましょう', '閉じてくださいませんこと', '閉じてくださいませか',
    '閉じてくださいますかねえ', '閉じてくれませんかなあ', '閉じてくれませんことね',
    '閉じてもらえませんこと', '閉じてもらえますかなあ', '閉じてもらえませんかねえ',
    '閉じていただけませんかね', '閉じていただけませんかな', '閉じていただけますかなあ',
    '閉じていただけませんこと', '閉じていただきたいんですが', '閉じていただきたく存じます',
    '閉じていただきたいです', '閉じていただけますと幸いでございます',
    '閉じていただけますと大変幸いです',
    // dict residue XIV
    '閉じるんだよねえ', '閉じるんだからね', '閉じるのだよ', '閉じるのですよ',
    '閉じるのですが', '閉じるんですがね', '閉じるものですわ', '閉じるものねえ',
    '閉じるものだから', '閉じるものかしら', '閉じるものと思う', '閉じるものと存じます',
    '閉じるべきところです', '閉じるべきなのでは',
    // volitional residue
    '閉じようかね', '閉じようかなと', '閉じようか',
    '閉じましょうよ', '閉じましょうねえ', '閉じましょ',
    // EN frames XIII
    'i would appreciate you closing it',
    'i would appreciate if you could close it',
    'i appreciate it if you close it',
    'i would be thankful if you could close it',
    'i would be obliged if you could close it',
    'i beseech you to close it', 'i entreat you to close it',
    'i implore you to close it', 'i beg of you to close it',
    'pray tell close it', 'there is a thought close it',
    'as a favor close it', 'as a courtesy close it', 'as a kindness close it',
    'do us a favor close it',
  ];
  test.each(closeTab.map((p) => [p]))('%s → close-tab', (p) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe('close-tab');
  });

  test.each([
    ['閉じるべきではないか', 'negate'],
    ['閉じるものかな', 'negate'],
    ['閉じるまい', 'negate'],
    ['閉じるっけ', 'describe-tab'],
  ])('%s → %s', (p, k) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe(k);
  });
});
