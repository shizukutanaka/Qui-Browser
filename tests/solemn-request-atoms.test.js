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

describe('solemn-request & dialect-particle atoms (XCII)', () => {
  const closeTab = [
    // JA 受益 tail XXX
    '閉じてくれんまいか', '閉じてくれんのかね', '閉じてくれよって',
    '閉じてくれりゃそれでいい', '閉じてもらうことか', '閉じてもらうんじゃ',
    '閉じてもらいたいけど', '閉じてもらいたいんだけどな',
    '閉じてもらいたいものだ', '閉じていただいてもよろしいですか',
    '閉じていただけませんことか', '閉じていただけますものか',
    '閉じていただけますと幸甚です', '閉じていただけると大変助かります',
    '閉じていただけると幸甚に存じます', '閉じていただけますなら',
    '閉じていただければ幸甚でございます', '閉じていただければ助かるのですが',
    '閉じていただければと', '閉じてほしいばかりに', '閉じてほしいばっかり',
    '閉じてほしいと願います', '閉じてほしいと切に願います',
    '閉じてほしいのみです', '閉じてほしいばかりなんです', '閉じてほしいわけです',
    // JA dict residue XXI
    '閉じることしかない', '閉じることしかないんだ', '閉じることもありだ',
    '閉じることで十分だ', '閉じることでいい', '閉じることにしようじゃないか',
    '閉じることに決めた', '閉じるのでいいと思う', '閉じるのをお願いしたい',
    '閉じるのお願い', '閉じるんやって', '閉じるんじゃって', '閉じるんぞ',
    '閉じるんけ', '閉じるんけん', '閉じるんよな', '閉じるんでな',
    '閉じるんやぞ', '閉じるんけー',
    // EN XXI
    'i hereby ask that you close it', 'i formally request that you close it',
    'i humbly request that you close it',
    'i respectfully request that you close it',
    'i earnestly ask that you close it',
    'i am appealing to you to close it', 'i petition you to close it',
    'i charge you to close it', 'i enjoin you to close it',
    'i enjoin you to please close it',
    'close it, would you be a love', 'close it when the mood strikes',
    'close it as the spirit moves you', 'close it, i owe you one',
    'close it, name your price', 'close it, you know you want to',
  ];
  test.each(closeTab.map((p) => [p]))('%s → close-tab', (p) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe('close-tab');
  });

  test.each([
    ['閉じてもらうもんか', 'negate'],
    ['閉じるべきかな', 'help'],
    ['閉じるものかな', 'negate'],
    ['閉じたはず', 'trouble'],
    ['閉じなくていい', 'negate'],
    ['閉じるっけ', 'describe-tab'],
    ['閉じられますか', 'help'],
  ])('%s → %s', (p, k) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe(k);
  });
});
