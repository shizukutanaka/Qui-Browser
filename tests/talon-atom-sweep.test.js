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

describe('talon atom sweep — pass CCXXXI', () => {
  it.each([
    // EN away-with/begone + declare/consider + slang hedges
    'tab begone', 'begone with it', 'away with it',
    'away with the tab', 'off with it', 'off with the tab',
    'out with it', 'out with the tab', 'down with the tab',
    'get it off my screen', 'off my screen', 'get it outta my face',
    'outta my face', 'out of my face', 'out of my sight',
    'get it out of my sight', 'waste of a tab', 'wasting a tab',
    'waste of space', 'taking up space', 'taking space',
    'eating space', 'dead to me', 'the tab is dead to me',
    'i hereby close it', 'i hereby declare it closed',
    'i declare it closed', 'i pronounce it closed',
    'consider it closed', 'consider the tab closed',
    'consider it shut', 'consider it done', 'consider it gone',
    'its officially closed', 'officially closed', 'officially done',
    'let the tab be closed', 'may the tab be closed',
    'tab be closed', 'punch out the tab', 'log the tab off',
    'log it out', 'sign the tab off', 'sign it off',
    'click the tab off', 'click it off', 'tap it closed',
    'tap it shut', 'if its not too much', 'no questions asked',
    'with prejudice', 'extreme prejudice',
    'in a jiffy', 'in a jiff', 'in one fell swoop', 'fell swoop',
    'posthaste', 'like the wind', 'like lightning',
    'sim sala bim', 'hocus pocus', 'alakazam',
    'tbh close it', 'tbh just close it', 'fr close it',
    'fr fr close it', 'ong close it', 'no cap close it',
    'on god close it', 'close it fam', 'close it chief',
    'close it bestie', 'close it sis', 'close it bro',
    'my guy close it', 'big dog close it', 'close it champ',
    'really though close it', 'quite simply close it',
    'in essence close it', 'effectively close it',
  ])('EN %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA hoshii/morau/yue + direction + insistence II
    '閉じてほしいので', '閉じてほしいんですが', '閉じてほしいんだけど',
    '閉じていいわよ', '閉じていいわ', '閉じてもろて',
    '閉じてくれへんなあ', '閉じてくれへんかなあ', '閉じてくれんかなあ',
    '閉じてはもらえまいか', '閉じてはもらえないか', '閉じてはどうか',
    '閉じてもらえばありがたい', '閉じてもらえればと',
    '閉じてくれればと思う', '閉じてほしいばかりに',
    '閉じるゆえ', '閉じるがゆえ', '閉じるゆえに', '閉じるがゆえに',
    '閉じるからよろしく', '閉じておいてよろしく',
    '閉じるのよろしく', '閉じるのお願い', '閉じるをお願い',
    '閉じるを頼む', '閉じるんだな', '閉じるんだよな',
    '閉じるわけだし', '閉じることになるから',
    '閉じてくれってば', '閉じてくれんかってば',
    '閉じてもらえってば', '閉じろったら', '閉じろと言ってるだろ',
    '閉じていく', '閉じていって', '閉じていこ', '閉じていくぞ',
    '閉じてくる', '閉じてくるわ', '閉じてくるね',
    '閉じてこい', '閉じてこいよ', '閉じておいで', '閉じておいでよ',
    '閉じてこよう', '閉じていっといで',
  ])('JA %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA progressive question -> describe-tab
    '閉じてんのよ',
  ])('JA %s -> describe-tab', (p) => {
    expect(key(mk(), p)).toBe('describe-tab');
  });

});
