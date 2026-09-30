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

describe('teoku/miru-residue & plan-frame atoms (LXXXVI)', () => {
  const closeTab = [
    // てみる/しまう/おく residue
    '閉じてみぃ', '閉じてみい', '閉じてみな', '閉じてみようや', '閉じてみるわい',
    '閉じてしまいな', '閉じてしまうがよい',
    '閉じておくがよい', '閉じておくんじゃ', '閉じておくのがいい', '閉じておいたほうが',
    '閉じておけばよい', '閉じておけばいい',
    // とく/ちゃ residue
    '閉じときな', '閉じときんしゃい', '閉じとけば', '閉じとけばいい',
    '閉じちゃいな', '閉じちゃうといい', '閉じちゃうべき', '閉じちゃうがよろしい',
    // dict residue XVI
    '閉じるものだな', '閉じるものですが', '閉じるんだってさ',
    '閉じるのわよ', '閉じるのわさ', '閉じるんすよ', '閉じるんすね',
    '閉じるんすけど', '閉じるんすが', '閉じるがいいと思う', '閉じるがよいと思う',
    '閉じるがよろしいかと', '閉じるがいいのでは',
    '閉じるわけね', '閉じるわけさ',
    // EN plan/goal frames XV
    'here is a thought close it', 'heres an idea close it', 'heres a thought close it',
    'heres what you do close it', 'what if we close it', 'imagine we close it',
    'picture it closed', 'envision it closed',
    'the goal is to close it', 'the aim is to close it', 'the objective is to close it',
    'mission close it', 'objective close it', 'goal close it',
    'step one close it', 'first step close it',
    'your job is to close it', 'your task is to close it', 'task close it',
    'the ask is close it', 'the request is close it', 'the ask here is close it',
  ];
  test.each(closeTab.map((p) => [p]))('%s → close-tab', (p) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe('close-tab');
  });

  test.each([
    ['閉じるところです', 'describe-tab'],
    ['閉じるところかな', 'describe-tab'],
    ['閉じるっけ', 'describe-tab'],
    ['閉じるべきではないか', 'negate'],
    ['閉じるものかな', 'negate'],
    ['閉じるまい', 'negate'],
  ])('%s → %s', (p, k) => {
    const { vc } = mk();
    expect(key(vc, p)).toBe(k);
  });
});
