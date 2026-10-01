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

describe('jute atom sweep — pass CCXXI', () => {
  it.each([
    // EN multilingual gratitude tails
    'close it thank you', 'close it ta', 'close it cheers',
    'close it merci', 'close it danke', 'close it grazie',
    'close it gracias', 'close it arigato', 'close it onegai',
    'close it kudasai', 'close it svp', 'close it bitte',
    'close it per favore', 'close it per piacere', 'close it prego',
    'ta close it', 'merci close it', 'danke close it',
    'gracias close it', 'arigato close it', 'onegai close it',
    'close it thanks kindly',
    // EN immediacy II + tags
    'close it right this minute', 'close it this very minute',
    'close it this very second', 'close it this very instant',
    'close it without delay', 'close it with haste',
    'close it expeditiously', 'close it swiftly',
    'close it with alacrity', 'close it with dispatch',
    'close it lickety', 'close it just now', 'close it anon',
    'close it betimes', 'close it right', 'close it innit',
    'eh close it', 'be a doll close it',
    // EN vocatives III
    'close it padre', 'close it mama', 'close it papa',
    'close it daddy', 'close it papi', 'close it sister',
    'close it brother', 'close it cuz', 'close it cousin',
    'close it unc', 'close it big man', 'close it big dawg',
    'close it bossman', 'close it m lord', 'close it mlord',
    'close it your majesty', 'close it your highness',
    'close it o great one', 'close it o wise one',
    'close it hot stuff', 'close it killer', 'close it tiger',
    'close it slugger', 'close it soldier', 'close it trooper',
    'close it cowboy', 'close it pardner', 'close it bucko',
    'close it buckaroo', 'close it slick', 'close it shorty',
    'close it dearie', 'close it deary', 'close it poppet',
    'close it ducky', 'close it pet', 'close it flower',
    'close it chuck', 'close it hen', 'close it hinny',
    'close it petal', 'close it my darling', 'close it my dear',
    'close it my friend', 'close it old friend', 'close it old chum',
    'close it old bean', 'close it old sport', 'close it old boy',
    'close it old man', 'close it old chap', 'close it old fruit',
    'close it me old mate', 'close it me old china',
    'close it bruv', 'close it bruvva', 'close it broski',
    'close it broseph', 'close it brohan', 'close it bromigo',
    'close it dudebro', 'close it guy', 'close it mister',
    'close it mister man', 'close it sonny', 'close it sonny boy',
    'close it kid', 'close it junior', 'close it rascal',
  ])('EN %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA まいか requests + humble honorifics
    '閉じてくれまいか', '閉じてくれますまいか',
    '閉じて進ぜよう', '閉じて進ぜます', '閉じて差し上げよう',
    '閉じて差し上げます', '閉じてしかるべし', '閉じてしかるべき',
    '閉じてしかるべきだ', '閉じて然るべき', '閉じて然るべきだ',
    // JA fate/aesthetic nouns
    '閉じるが当然', '閉じるのが道理', '閉じるが至当',
    '閉じるが定め', '閉じるが宿命', '閉じるが運命', '閉じるが天命',
    '閉じるのが一興', '閉じるが一興', '閉じるも一興',
    '閉じるのも風流', '閉じるが風流', '閉じるのが粋', '閉じるが粋',
    '閉じるが美学', '閉じるのが美学', '閉じるが矜持', '閉じるのが矜持',
    // JA Kyoto/Edo
    '閉じてほしゅうございます', '閉じておきなまし', '閉じてなまし',
    '閉じてやす', '閉じてやすよ', '閉じてどす', '閉じてどすえ',
    '閉じておし', '閉じておしてや', '閉じてやで', '閉じてやんす',
    '閉じてやんせ', '閉じてくれやんす', '閉じてくれはったら',
    '閉じてくれはれ', '閉じてくれはりな', '閉じてはりますか',
    '閉じてはりな', '閉じてみはりな', '閉じてもらいはる',
    '閉じてもらいはれ',
    // JA regional particles + negate fixes
    '閉じてほしな', '閉じてもらいたかねえ', '閉じてもらいますねん',
    '閉じてもらいなはれ', '閉じてほしいけんね',
    '閉じてもらっちゃ', '閉じてもらおや', '閉じてもらおかな',
    '閉じてもらうわい', '閉じてもらうぞう', '閉じてもらうぜよ',
    '閉じてもらうがや', '閉じてもらうみゃあ', '閉じてもらうねん',
    '閉じてもらうす', '閉じてもらうっしょ', '閉じてもらうっちゃ',
    '閉じてもらうんやで', '閉じてもらうんやから',
    '閉じてもらうんじゃけえ', '閉じてもらうんぞ',
    '閉じてもらうんだべ', '閉じてもらうんだな', '閉じてもらうんだべさ',
    '閉じてもらうっぺ', '閉じてもらうっぺよ', '閉じてもらうっぺな',
    '閉じてもらうぺ', '閉じてもらうだっぺ', '閉じてもらうぞな',
    '閉じてもらうぞね', '閉じてもらうぜい', '閉じてもらうさかい',
    '閉じてもらうさかいに', '閉じてもらうのう', '閉じてもらうなあ',
    '閉じてもらうなー', '閉じてもらうなのう', '閉じてもらうものを',
    '閉じてもらうものだが', '閉じてもらうものね', '閉じてもらうものをね',
  ])('JA %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });
});
