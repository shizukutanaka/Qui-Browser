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

describe('keel atom sweep — pass CCXXII', () => {
  it.each([
    // EN vocatives IV: military/meta/media/mock
    'close it commander', 'close it general', 'close it admiral',
    'close it colonel', 'close it sarge', 'close it sergeant',
    'close it private', 'close it lieutenant', 'close it major',
    'close it cadet', 'close it ensign', 'close it number one',
    'close it doc', 'close it professor', 'close it coach',
    'close it sire', 'close it siree', 'close it milady',
    'close it mademoiselle', 'close it senor', 'close it senora',
    'close it senorita', 'close it monsieur', 'close it mon ami',
    'close it signor', 'close it signore', 'close it mi amigo',
    'close it hermano', 'close it hermana', 'close it primo',
    'close it vato', 'close it ese', 'close it carnal',
    'close it brotha', 'close it sista', 'close it team',
    'close it squad', 'close it robot', 'close it computer',
    'close it machine', 'close it device', 'close it browser',
    'close it system', 'close it ai', 'close it assistant',
    'close it jarvis', 'close it hal', 'close it rookie',
    'close it newbie', 'close it noob', 'close it pro',
    'close it wizard', 'close it merlin', 'close it gandalf',
    'close it padawan', 'close it young padawan', 'close it jedi',
    'close it master', 'close it grasshopper', 'close it student',
    'close it my son', 'close it child', 'close it baby',
    'close it babe', 'close it doll', 'close it dollface',
    'close it sweet pea', 'close it cutie', 'close it cutie pie',
    'close it gorgeous', 'close it beautiful', 'close it handsome',
    'close it lovely', 'close it luv', 'close it lovey',
    'close it lamb', 'close it angel', 'close it precious',
    'close it sugar', 'close it sugar plum', 'close it honeybun',
    'close it honey bunny', 'close it honey pie', 'close it snookums',
    'close it boo', 'close it bae', 'close it girl', 'close it boy',
    'close it young man', 'close it young lady', 'close it youngster',
    'close it whippersnapper', 'close it scallywag',
    'close it rapscallion', 'close it scoundrel', 'close it knave',
    'close it rogue', 'close it mortal', 'close it human',
    'close it earthling', 'close it mere mortal', 'close it peasant',
    'close it fool', 'close it buffoon', 'close it jester',
    'close it clown', 'close it wiseacre', 'close it smart aleck',
    'close it smarty pants', 'close it smarty', 'close it know it all',
    'close it brain', 'close it brainiac', 'close it whiz',
    'close it whiz kid', 'close it ace', 'close it star',
    'close it superstar', 'close it mvp', 'close it goat',
    'close it legend', 'close it hero', 'close it winner',
    'close it genius', 'close it einstein', 'close it smart guy',
    'close it wise guy', 'close it tough guy', 'close it big shot',
    'close it hotshot', 'close it ninja', 'close it gangsta',
    'close it gangster', 'close it playa', 'close it player',
    'close it homeboy', 'close it homegirl', 'close it home slice',
    'close it homeslice', 'close it dog', 'close it my good man',
    'close it friendo',
  ])('EN %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA て+方言単助詞粒子
    '閉じてせ', '閉じてず', '閉じてぬ', '閉じてぺ', '閉じてす',
    '閉じてぐ', '閉じてら', '閉じてやね', '閉じてやねん',
    '閉じてで', '閉じてじゃ', '閉じてじゃあ', '閉じてじゃけ',
    '閉じてじゃけえ', '閉じてけえ', '閉じてちゃ', '閉じてみゃ',
    '閉じてみゃあ', '閉じてにゃ', '閉じてにゃあ', '閉じてぎゃ',
    '閉じてずら', '閉じてっちゃ', '閉じてけん', '閉じてけんね',
    '閉じてばい', '閉じてたい', '閉じてとよ', '閉じてと',
    '閉じてとて', '閉じてごと', '閉じてごとね', '閉じてわい',
    '閉じてわいな', '閉じてさかい', '閉じてさかいに', '閉じてのう',
    '閉じてぞな', '閉じてぞね', '閉じてぜい', '閉じてぞい',
    '閉じてだべ', '閉じてだっぺ', '閉じてっぺ', '閉じてがす',
    '閉じてんじゃあ', '閉じてじゃろ', '閉じてじゃろう',
    '閉じてにょ', '閉じてんかい', '閉じてんのかい', '閉じてなの',
    '閉じてのお', '閉じてぬか', '閉じてまろ', '閉じてて',
    '閉じててや', '閉じてー', '閉じてぞぉ', '閉じてぜぇ',
    '閉じてわー', '閉じてさー',
    // JA ちゃう+地域粒子
    '閉じちゃうがええ', '閉じちゃうがいい', '閉じちゃうべし',
    '閉じちゃうが吉', '閉じちゃうぞよ', '閉じちゃうがな',
    '閉じちゃうわい', '閉じちゃうぞう', '閉じちゃうぜよ',
    '閉じちゃうけん', '閉じちゃうばい', '閉じちゃうのう',
    '閉じちゃうさかい', '閉じちゃうだべ', '閉じちゃうっぺ',
    '閉じちゃうにゃあ', '閉じちゃうみゃあ', '閉じちゃうっちゃ',
    '閉じちゃうんや', '閉じちゃうんぞ', '閉じちゃうぞな',
    '閉じちゃうぞね', '閉じちゃうなあ', '閉じちゃうのん',
    '閉じちゃうがや', '閉じちゃうだがや', '閉じちゃうだら',
    '閉じちゃうじゃん', '閉じちゃうっす', '閉じちゃうす',
    '閉じちゃうっしょ', '閉じちゃうだって', '閉じちゃうがす',
    '閉じちゃうてや',
  ])('JA %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });
});
