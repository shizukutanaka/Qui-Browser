'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const calls = [];
  const tm = {
    activeTabId: 't1',
    tabs: [{ id: 't1', title: 'Example', url: 'https://ex' }],
    getActiveTab() { return this.tabs[0]; },
    closeAllTabs() { calls.push('closeAllTabs'); return 1; },
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  const said = [];
  vc.speak = (m) => said.push(m);
  return { vc, tm, calls, said };
}

function key(vc, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

describe('command-frame & residue atoms (LXXX)', () => {
  const closeTab = [
    '閉じてくれんのか', '閉じてもらうよ', '閉じてもらっときたい',
    '閉じてくださいなよ', '閉じてくだされよ', '閉じてやってもらおうか',
    '閉じるのも一手だ', '閉じるのも選択肢の一つだ', '閉じるべきところだ',
    '閉じるほうが楽だ', '閉じるほうが楽', '閉じたほうが早くない',
    '閉じていいんちゃう', '閉じてええんとちゃう', '閉じてこそ',
    'さえ閉じればいい', '閉じさせてもらうよ', '閉じさせてくれますように',
    'お閉じなさいませ', 'なあ、閉じて',
    'am i asking too much to close it', 'too much to ask you to close it',
    'would it be asking too much to close it',
    'just this once close it', 'close it just this once', 'one time close it',
    'see to closing it', 'see that it gets closed', 'see to it that you close it',
    'ensure it gets closed', 'make sure it closes', 'make sure you close it',
    'youre gonna close it', 'you shall close it',
    'the tab needs closing', 'it should get closed', 'this wants closing',
  ];
  test.each(closeTab.map((p) => [p]))('%s → close-tab', (p) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe('close-tab');
  });

  test.each([
    ['閉じてばかりだと', 'trouble'],
    ['閉じてばかり', 'trouble'],
    ['まだ開いてる?', 'describe-tab'],
    ['なあ聞いて', 'say-again'],
  ])('%s → %s', (p, k) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe(k);
  });

  // Pins: judgment/capability questions stay help; negations stay negate
  test.each([
    ['閉じるべきかな', 'help'],
    ['is it possible to close it', 'help'],
    ['can it be closed', 'help'],
    ['閉じるものかな', 'negate'],
    ['dont close it', 'negate'],
  ])('%s → %s', (p, k) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe(k);
  });
});
