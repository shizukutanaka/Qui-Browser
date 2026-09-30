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

describe('request-frame & residue atoms (LXXXI)', () => {
  const closeTab = [
    // benefactive residue XIX
    '閉じてくれるのかな', '閉じてくれませんこと', '閉じてくれるはず', '閉じてくれるべき',
    '閉じてやってもらおうじゃないか', '閉じてもらおうかね', '閉じてもらうとするか',
    '閉じてもらうけん', '閉じてもらうばい', '閉じてもらうちゃ', '閉じてくれたる',
    '閉じてくださいますように', '閉じてくれてもいいじゃん',
    // dict judgment XI
    '閉じるのが順当', '閉じるのが適切か', '閉じるほうが無難だ', '閉じるほうが手っ取り早い',
    '閉じるしかないじゃん', '閉じるのも賢い', '閉じるのも吉', '閉じることに限る',
    '閉じると決まっている', '閉じるが道理', '閉じるが順序', '閉じるに決まってる', '閉じる一択',
    // imperative residue
    '閉じーや', '閉じておしまい', '閉じてしまえと',
    // volitional ね
    '閉じましょうね',
    // たら residue II
    '閉じたらどうかね', '閉じたらどうなの', '閉じたらいいと思うよ', '閉じたらいいと思うんだ',
    '閉じたらと思います',
    // negative-request forms (まい系 request, not refusal)
    '閉じてくださるまいか', '閉じるしかあるまい',
    // causative residue
    '閉じさせていただきたいんです', '閉じさせてくれんか',
    // EN modal-just / favor / imperative fillers
    'can you just close it', 'do yourself a favor and close it',
    'get on it close it', 'hop to it close it',
    // EN reporting frames
    'im asking you to close it', 'im telling you to close it',
    // EN passive-need frames
    'the tab wants closing', 'the tab could use closing', 'it could do with closing',
    'needs to be closed', 'has to be closed', 'should be closed', 'ought to be closed',
    // EN courtesy codas
    'close it please and thank you', 'close it for petes sake',
    'close it for goodness sake', 'close it for crying out loud',
  ];
  test.each(closeTab.map((p) => [p]))('%s → close-tab', (p) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe('close-tab');
  });

  // Pins: real refusals/questions unchanged
  test.each([
    ['閉じるまい', 'negate'],
    ['閉じるものかな', 'negate'],
    ['do you mind closing it', 'close-tab'],
    ['do you think you could close it', 'close-tab'],
    ['do they want it closed', null],
  ])('%s → %s', (p, k) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe(k);
  });
});
