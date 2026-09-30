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

describe('manner-frame & condition atoms (LXXXVIII)', () => {
  const closeTab = [
    // benefactive XXVI
    '閉じてくれよかった', '閉じてくれちゃったら', '閉じてくれちゃうか', '閉じてくれちゃおう',
    '閉じてもらいとう', '閉じてもらうとか', '閉じてもらうに限る', '閉じてもらうべきかな',
    '閉じてもらうしかない', '閉じてもらうほかない',
    '閉じていただくに限る', '閉じていただくべきかと',
    '閉じていただく以外ない', '閉じていただくほかない',
    '閉じてもよろしいかと', '閉じてもいいかと', '閉じてもいいかと思う',
    '閉じてもいいんではないかと', '閉じてもいいかと存じます',
    // dict residue XVIII (まま/ついで/がてら/際/ように)
    '閉じるままにして', '閉じるままで', '閉じるついでに', '閉じるがてら',
    '閉じるながらに', '閉じるとともに', '閉じると同時に', '閉じるのと一緒に',
    '閉じる際に', '閉じる際には', '閉じる時点で', '閉じる段階で',
    '閉じるようにできる', '閉じるようにやって', '閉じるようにしといて',
    '閉じるようになさって', '閉じるようになって', '閉じるようにしてもらって',
    // EN order/condition XVII
    'i hereby order you to close it', 'i demand you close it',
    'i require you to close it', 'im requiring you to close it',
    'im ordering you to close it', 'as long as you are at it close it',
    'if you would be so good close it',
    'provided you close it', 'providing you close it', 'assuming you can close it',
    'on the condition that you close it', 'so long as you close it',
    'in exchange for closing it', 'in return for closing it',
    'for the sake of it close it',
  ];
  test.each(closeTab.map((p) => [p]))('%s → close-tab', (p) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe('close-tab');
  });

  test.each([
    ['閉じるべきかな', 'help'],
    ['閉じるべきですかね', 'help'],
    ['閉じるべきではないか', 'negate'],
    ['閉じるものかな', 'negate'],
    ['閉じるまい', 'negate'],
    ['閉じるっけ', 'describe-tab'],
  ])('%s → %s', (p, k) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe(k);
  });
});
