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

describe('nominal/koto-residue & we-frame atoms (LXXXVII)', () => {
  const closeTab = [
    // て+受益 residue XXV
    '閉じてほしいんや', '閉じてほしいんだけどね', '閉じてほしいんだわ', '閉じてほしいのですが',
    '閉じてほしいところなんです', '閉じてほしいところですが', '閉じてほしいところではある',
    '閉じてほしいわけです', '閉じてもらいたいわけです', '閉じてもらいたいですが',
    '閉じてもらいたいんですけれど', '閉じてもらいたいものです',
    '閉じてもらう方向で', '閉じてもらうかなと', '閉じてもらうことで',
    '閉じてもらえますでしょうかね', '閉じていただけますことでしょうか',
    '閉じていただければ幸甚です', '閉じていただければ幸甚でございます',
    '閉じていただけましたら幸いに存じます',
    // dict residue XVII (こと/の/ん)
    '閉じることで', '閉じることにより', '閉じることとします', '閉じることにするよ',
    '閉じることにしますよ', '閉じることになります', '閉じることもあります',
    '閉じることもあるよ', '閉じることですね', '閉じることかと',
    '閉じるのですがね', '閉じるのですよね', '閉じるのも悪くないね',
    '閉じるのもありな気がする', '閉じるんでしょうか', '閉じるんでしょうね',
    '閉じるんでしょ', '閉じるんだろう', '閉じるんでしょう', '閉じるんだろうね',
    // EN we/suggest frames XVI
    'do you think you can close it', 'do you think we could close it',
    'supposing you could close it', 'say we close it', 'hows about we close it',
    'why do we not close it', 'lets go for closing it',
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
