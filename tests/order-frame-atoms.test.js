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

describe('order-frame & dialect residue atoms (LXXXIX)', () => {
  const closeTab = [
    // benefactive XXVII
    '閉じてくれようか', '閉じてくれるさ', '閉じてくれるっしょ',
    '閉じてもらうべく', '閉じてもらうもんだ', '閉じてもらいって',
    '閉じてもらうでな', '閉じてもらうさ', '閉じてもらうだけで',
    '閉じてもらうのみ', '閉じてもらうのみで',
    '閉じてくれさえすりゃ', '閉じてくれさえあれば',
    '閉じておいていただきます', '閉じておいていただけますか',
    '閉じておいてもらいます', '閉じておいてもらえます',
    // imperative stem residue
    '閉じぃ', '閉じーい', '閉じなさんし', '閉じなさいまし',
    // dict XIX
    '閉じるしかね', '閉じるしかあるまいか', '閉じるに限るよ',
    '閉じるにこしたことはない', '閉じるのがよろしいでしょう',
    '閉じるのがよろしいかと思う', '閉じるのがよろしいかと思います',
    '閉じるのでしょうね', '閉じるのであればよい', '閉じるのも手だろう',
    '閉じるってばさ', '閉じると言ったはず', '閉じると言ったよね',
    '閉じるべきだって', '閉じるべきところかと', '閉じるべきものだ',
    '閉じるだけの話だ', '閉じるだけのことだ',
    // EN XVIII
    'i call upon you to close it',
    'gratify me by closing it', 'accommodate me by closing it',
    'would it kill ya to close it',
    'close it or whatever', 'close it or something',
  ];
  test.each(closeTab.map((p) => [p]))('%s → close-tab', (p) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe('close-tab');
  });

  test.each([
    ['閉じるべきかな', 'help'],
    ['閉じるものかな', 'negate'],
    ['閉じるまい', 'negate'],
    ['閉じたはず', 'trouble'],
    ['閉じるっけ', 'describe-tab'],
  ])('%s → %s', (p, k) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe(k);
  });
});
