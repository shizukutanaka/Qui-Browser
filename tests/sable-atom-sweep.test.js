import { VoiceCommands } from '../src/vr/input/VoiceCommands.js';

const mk = () => {
  const vc = new VoiceCommands({ enabled: true });
  const tm = {
    activeTabId: 't1',
    tabs: [
      { id: 't1', currentTitle: 'A', currentUrl: 'https://a' },
      { id: 't2', currentTitle: 'B', currentUrl: 'https://b' },
      { id: 't3', currentTitle: 'C', currentUrl: 'https://c' },
    ],
    getActiveTab() { return this.tabs.find((t) => t.id === this.activeTabId); },
    closeAllTabs() { return 3; },
    closeTab() {},
    pinTab() {},
    closeOtherTabs() {},
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
};

const key = (vc, p) => {
  vc.lastCommand = null;
  vc.processCommand(p, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
};

describe('sable atom sweep — pass CCXXX', () => {
  it.each([
    // EN kill-verbs + urgency + declaratives
    'terminate the tab', 'terminate it', 'exterminate it',
    'liquidate the tab', 'delete the tab', 'delete it',
    'erase it', 'erase the tab', 'wipe it', 'wipe the tab',
    'wipe it out', 'wipe out the tab', 'expunge it',
    'obliterate it', 'annihilate it', 'decimate it',
    'demolish it', 'destroy it', 'destroy the tab',
    'dispatch the tab', 'dispatch it', 'retire the tab',
    'retire it', 'put it out to pasture', 'pension it off',
    'send it to the farm', '86 it', 'eighty six it',
    '86 the tab', 'eighty six the tab',
    'end the tab', 'end it', 'end that tab',
    'put an end to it', 'put an end to the tab',
    'it ends now', 'this ends now', 'the tab ends now',
    'it ends here', 'this ends here',
    'get the lead out', 'move it', 'get moving',
    'jump to it', 'hop to it', 'snap snap',
    'strike while the iron is hot', 'strike while hot',
    'the earlier the better', 'earlier the better',
    'the faster the better', 'faster the better',
    'tab has gotta go', 'the tab gotta go', 'this gotta go',
    'it gotta go',
    'youre closing it', 'you will be closing it',
    'youll be closing it', 'you are closing it',
    'the tab gets closed', 'the tab is getting closed',
    'it gets closed', 'tabs get closed',
    'its curtains for the tab', 'curtains for that tab',
    'read it its last rites', 'last rites', 'funeral for the tab',
    'the fat lady sings', 'its all over for the tab',
    'all over but the shouting', 'hows about closing it',
    'hows about you close it', 'what say you close it',
    'say youll close it', 'close it before you forget',
    'while you remember', 'while its fresh',
    'close it for me pretty please',
    '閉じたってば', '閉じたってばよ',
  ])('EN %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    'all of em gotta go', 'every last one', 'every single one',
    'each and every one',
  ])('EN %s -> close-all-tabs', (p) => {
    expect(key(mk(), p)).toBe('close-all-tabs');
  });

  it.each([
    // JA dialect/te-oku/moraou + insistence reports
    '閉じまっせ', '閉じまっしょ', '閉じますわよ', '閉じますんや',
    '閉じてぞ', '閉じてえ', '閉じてえよ', '閉じてえな',
    '閉じてくれんと', '閉じてくれんのか', '閉じてくれんかね',
    '閉じてもらってええ', '閉じてもらってもいい',
    '閉じてよこせ', '閉じてよこしなさい', '閉じて寄越せ',
    '閉じてもらおうか', '閉じてもらおうかな', '閉じてもらおうぜ',
    '閉じてもらおう', '閉じてくれよう', '閉じてくれようか',
    '閉じてみたい', '閉じてみたいんだ', '閉じてみたいな',
    '閉じてなんぼ', '閉じるなんぼ',
    '閉じるだろ', '閉じるだろう', '閉じるんでしょ',
    '閉じるんでしょう', '閉じるんだろ', '閉じるんだろうね',
    '閉じるっつってんだろ', '閉じるって言ってんだろ',
    '閉じるつってんの',
    '閉じなって', '閉じなってよ', '閉じといてね',
    '閉じといて', '閉じといてよ', '閉じといてくれ', '閉じといてちょ',
  ])('JA %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA progressive questions -> describe-tab
    '閉じてんのか', '閉じてもんね',
  ])('JA %s -> describe-tab', (p) => {
    expect(key(mk(), p)).toBe('describe-tab');
  });
});
