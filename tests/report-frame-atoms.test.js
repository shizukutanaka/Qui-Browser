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

describe('report-frame & residue atoms (LXXXV)', () => {
  const closeTab = [
    // JA benefactive XXIII
    '閉じてくれよな', '閉じてくれよわ', '閉じてくれんかい', '閉じてくれんけ', '閉じてくれんね',
    '閉じてもらおうかな', '閉じてもらおうかね', '閉じてもらえっかな', '閉じてもらえるかなあ',
    '閉じてもらいたいんだけれど', '閉じてもらいたいんだけどなあ',
    '閉じてほしいんだけれど', '閉じてほしいんだけどなあ', '閉じてほしいんだよなあ',
    '閉じてくださいませんかい', '閉じてくださいませんかなあ',
    '閉じていただけないでしょうかね', '閉じていただきたく思います',
    '閉じていただくわけにはいきませんか',
    // dict residue XV
    '閉じるってば', '閉じるってさ', '閉じるってよ', '閉じるとかさあ', '閉じるとかなんとか',
    '閉じるんではないか', '閉じるんじゃないかと', '閉じるんじゃないかなあ', '閉じるんじゃないだろうか',
    '閉じるんですかね', '閉じるんですけれど', '閉じるのでよろしいか', '閉じるのでよいか',
    '閉じるので構いませんか', '閉じるのでいいのですが', '閉じるのもいいかもね', '閉じるのもありかも',
    '閉じるべきと思います', '閉じるべきと考えます',
    // EN report/belief frames XIV
    'i think you should close it', 'i think you could close it',
    'i believe you should close it', 'i believe you could close it',
    'i feel like you should close it', 'i feel you should close it',
    'it seems like you could close it', 'seems like you could close it',
    'figure you could close it', 'figured you could close it',
    'reckon you could close it', 'reckon you can close it',
    'guessing you could close it', 'bet you could close it',
    'suspect you could close it', 'trust you can close it',
    'clearly you can close it',
    'you probably should close it', 'you probably ought to close it',
    'you might as well close it', 'you may as well close it',
    'might as well close it', 'may as well close it',
  ];
  test.each(closeTab.map((p) => [p]))('%s → close-tab', (p) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe('close-tab');
  });

  test.each([
    ['閉じるべきかと思う', 'help'],
    ['閉じるべきではないか', 'negate'],
    ['閉じるものかな', 'negate'],
    ['閉じるまい', 'negate'],
    ['閉じるっけ', 'describe-tab'],
  ])('%s → %s', (p, k) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe(k);
  });
});
