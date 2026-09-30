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

describe('formal-command & residue atoms (LXXIX)', () => {
  const closeTab = [
    '閉じてくれんですか', '閉じてくれたまえ', '閉じてくれたまえよ',
    '閉じてもらってもいいですかね', '閉じてもらっていいですかね',
    '閉じなさいって', '閉じなさいってば', '閉じなってば',
    '閉じるものね', '閉じるものですね', '閉じるわけなんです',
    'why dontcha close it', "whyn't you close it",
    'close it if you could possibly', 'be an angel and close it',
    'closing it is the way to go', 'closing it would be the move',
    'the move is to close it', 'best move is closing it',
    'i command you to close it', 'i order you to close it',
    'i hereby request you close it', 'i hereby ask that you close it',
    'close it please sir', "close it if it's not too much trouble",
    "close it if it isn't too much to ask",
  ];
  test.each(closeTab.map((p) => [p]))('%s → close-tab', (p) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe('close-tab');
  });

  test.each([
    ['閉じるわけです', 'close-tab'],
    ['デカくして', 'volume-up'],
    ['小さめにして', 'volume-down'],
    ['読み上げ止めて', 'stop-reading'],
    ['どこ読んでる', 'reader-progress'],
  ])('%s → %s', (p, k) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe(k);
  });

  // Pins: negation requests stay negate; judgment questions stay help; 閉じな=関西命令→実行
  test.each([
    ['閉じないでほしい', 'negate'],
    ['閉じないでください', 'negate'],
    ['閉じないでおいて', 'negate'],
    ['閉じるものかな', 'negate'],
    ['閉じな', 'close-tab'],
    ['閉じるべきかな', 'help'],
    ['よろしく', 'help'],
  ])('%s → %s', (p, k) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe(k);
  });
});
