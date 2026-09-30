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

describe('dialect-request & residue atoms (LXXXII)', () => {
  const closeTab = [
    // benefactive/dialect residue XX
    '閉じてくれんけん', '閉じてくれんさい', '閉じてもらおか', '閉じてもらいましょ',
    '閉じておくんなまし',
    // dict judgment XII
    '閉じるのが常道', '閉じるが吉', '閉じるんだから', '閉じるので', '閉じるのでー',
    '閉じるがいいさ', '閉じることを所望', '閉じることを希望',
    // bare ては + てみる residue + ちゃってよ
    '閉じては', '閉じてみよ', '閉じてみようよ', '閉じちゃってよ',
    // volitional proposals
    '閉じようよ', '閉じようぞ', '閉じようかい',
    // EN ya/favor/fillers
    'can ya close it', 'could ya close it', 'will ya close it',
    'be a pal and close it', 'be a friend and close it',
    'pop it closed', 'slide it closed',
    'close it when you get a sec', 'close it before anything else',
    'close it first thing', 'close it that second',
    'it needs a closing', 'the tab requires closing',
    'the tab is still open close it',
  ];
  test.each(closeTab.map((p) => [p]))('%s → close-tab', (p) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe('close-tab');
  });

  // Pins: recollection/prohibition/negation routes preserved
  test.each([
    ['閉じるっけ', 'describe-tab'],
    ['閉じるべきでは', 'negate'],
    ['閉じるまい', 'negate'],
    ['閉じるものかな', 'negate'],
    ['do you mind closing it', 'close-tab'],
  ])('%s → %s', (p, k) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe(k);
  });
});
