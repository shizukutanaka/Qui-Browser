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

describe('passive-request & obligation atoms (XCI)', () => {
  const closeTab = [
    // passive/potential indirect requests (閉じられ〜 = "can you close")
    '閉じられてもいい', '閉じられては',
    '閉じられないでしょうか', '閉じられないかな',
    '閉じられないかしら', '閉じられるはずです', '閉じられると思います',
    '閉じられると思うんですが',
    // ほしい敬語 + 構わ/よろしければ residue
    '閉じてほしく存じます', '閉じてほしく思います', '閉じてほしいのですが',
    '閉じてほしいんですけど', '閉じてほしいと存じます', '閉じてほしいところですが',
    '閉じて構わなければ', '閉じて構わないなら', '閉じて良ければ',
    '閉じてよろしければ', '閉じてよろしければ幸い',
    // obligation residue (ねば/なければならない/ませんね)
    '閉じなければならないのでは', '閉じなければならないでしょう',
    '閉じなきゃいけませんね', '閉じねばならぬ', '閉じねばなりません',
    '閉じませんね',
    // EN XX
    'i shall require you to close it', 'i must ask that you close it',
    'i must request that you close it', 'i would request that you close it',
    'i am requesting that you close it', 'i am begging you please close it',
    'i am pleading with you to close it', 'i plead with you to close it',
    'i appeal to you to close it', 'do you care to close it',
    'close it whenever convenient', 'close it in your own time',
  ];
  test.each(closeTab.map((p) => [p]))('%s → close-tab', (p) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe('close-tab');
  });

  // '閉じなくていい' = "you don't have to close" → dismissal (negate)
  const negate = [
    '閉じなくていい', '閉じなくていいの', '閉じなくていいんだ',
    '閉じなくてもいいかな', '閉じなくていいんじゃない', '閉じなくてもいいんです',
  ];
  test.each(negate.map((p) => [p]))('%s → negate', (p) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe('negate');
  });

  test.each([
    ['閉じるべきかな', 'help'],
    ['閉じるものかな', 'negate'],
    ['閉じたはず', 'trouble'],
    ['閉じられないんだけど', 'trouble'],
    ['閉じるっけ', 'describe-tab'],
    ['戻れますか', 'back-status'],
    ['閉じられますか', 'help'],
    ['閉じられますかね', 'help'],
    ['閉じられますでしょうか', 'help'],
    ['読まないで', 'stop-reading'],
  ])('%s → %s', (p, k) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe(k);
  });
});
