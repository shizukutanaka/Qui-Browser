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

describe('loom atom sweep — pass CCXXIII', () => {
  it.each([
    // EN coordination / delegation / encouragement / magic
    'close it and call it a day', 'close it and move on',
    'close it and forget it', 'close it and call it good',
    'close it and done', 'close it or dont', 'close it or leave it',
    'close it up to you', 'close it your call', 'close it your choice',
    'close it dealers choice', 'close it its up to you',
    'close it whatever you decide', 'close it whatever you think',
    'close it i trust you', 'close it i believe in you',
    'close it you can do it', 'close it you got this',
    'close it i know you can', 'close it do your best',
    'close it best effort', 'close it do your thing',
    'close it work your magic', 'close it do your magic',
    'close it wave your wand', 'close it abracadabra',
    'close it alakazam', 'close it presto change-o',
    'close it voila', 'close it and voila', 'close it like magic',
    'close it automagically', 'close it with magic',
    // EN archaic/legal + deliberation + patience + manner
    'close it herewith', 'close it hereby', 'close it accordingly',
    'close it per my last email', 'close it as requested',
    'close it as instructed', 'close it as directed',
    'close it as ordered', 'close it as commanded',
    'close it as decreed', 'close it like i asked',
    'close it like i told you', 'close it per my request',
    'close it pursuant to my request',
    'close it in accordance with my wishes', 'close it as agreed',
    'close it as promised', 'close it as discussed',
    'close it as we discussed', 'close it like we agreed',
    'close it all things considered', 'close it on balance',
    'close it ultimately', 'close it eventually',
    'close it at some point', 'close it by tonight',
    'close it at your pace', 'close it at your own pace',
    'close it take your time', 'close it no rush',
    'close it no hurry', 'close it no pressure',
    'close it slowly but surely', 'close it easy does it',
    'close it gingerly', 'close it with care',
    'close it like a surgeon', 'close it professionally',
    'close it like an adult', 'close it wisely',
    'close it elegantly', 'close it gracefully',
    'close it with style', 'close it with grace',
    'close it in style', 'close it cleanly', 'close it neatly',
    'close it thoroughly', 'close it completely',
  ])('EN %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA 名目評価名詞II
    '閉じるのが作法', '閉じるが作法', '閉じるのが礼儀', '閉じるが礼儀',
    '閉じるのがマナー', '閉じるがマナー', '閉じるのがエチケット',
    '閉じるのがお作法', '閉じるのが流儀', '閉じるが流儀',
    '閉じるのが方針', '閉じるが方針', '閉じるのが基本方針',
    '閉じるのが信条', '閉じるが信条', '閉じるのが主義', '閉じるが主義',
    '閉じるのがポリシー', '閉じるがポリシー', '閉じるのがルール',
    '閉じるがルール', '閉じるのが規則', '閉じるが規則',
    '閉じるのがおきて', '閉じるがおきて', '閉じるのが掟', '閉じるが掟',
    '閉じるのが鉄則', '閉じるが鉄則', '閉じるのが家訓', '閉じるが家訓',
    '閉じるのが責務', '閉じるが責務', '閉じるのが使命', '閉じるが使命',
    '閉じるのが務め', '閉じるが務め', '閉じるのが役目', '閉じるが役目',
    '閉じるのが役割', '閉じるが役割', '閉じるのが本分', '閉じるが本分',
    '閉じるのが職務', '閉じるのが必然', '閉じるが必然',
    '閉じるのが帰結', '閉じるが帰結', '閉じるのが成行き',
    '閉じるが成行き', '閉じるのが自然の流れ', '閉じるが自然の流れ',
    '閉じるのが流れ', '閉じるが流れ', '閉じるのが趨勢',
    '閉じるのが風潮', '閉じるのが時代の流れ', '閉じるのが時の流れ',
    '閉じるのが現実', '閉じるが現実', '閉じるのが事実', '閉じるが事実',
    '閉じるのが実態', '閉じるのが実情', '閉じるのが真理',
    '閉じるが真理', '閉じるのが真実', '閉じるのが本質', '閉じるが本質',
    '閉じるのが本筋', '閉じるが本筋', '閉じるのが正論', '閉じるが正論',
    '閉じるのが至言', '閉じるが至言', '閉じるのが金言', '閉じるのが名案',
    '閉じるが名案', '閉じるのが一案', '閉じるが一案',
    '閉じるのが禅', '閉じるが禅', '閉じるのが悟り', '閉じるが悟り',
    '閉じるのが美徳', '閉じるが美徳', '閉じるのが善', '閉じるが善',
    '閉じるのが仁', '閉じるのが義', '閉じるが義', '閉じるのが礼',
    '閉じるのが智', '閉じるのが信', '閉じるのが乙', '閉じるが乙',
    '閉じるのが趣', '閉じるが趣', '閉じるのが醍醐味', '閉じるが醍醐味',
    '閉じるのが華', '閉じるが華', '閉じるのがゴール', '閉じるがゴール',
    '閉じるのが終着点', '閉じるのが終着駅', '閉じるのが着地点',
    '閉じるのが落とし所', '閉じるが落とし所', '閉じるのが落としどころ',
    '閉じるのがオチ', '閉じるがオチ', '閉じるのが結末', '閉じるが結末',
    '閉じるのが結着', '閉じるのがフィナーレ', '閉じるのが大団円',
    '閉じるが大団円', '閉じるのが最終回', '閉じるのが最終章',
    '閉じるのがクライマックス', '閉じるのが千秋楽', '閉じるのが締め',
    '閉じるが締め', '閉じるのが王道', '閉じるが王道', '閉じるのが正道',
    '閉じるが正道', '閉じるのが正統', '閉じるが正統',
    '閉じるのが手順', '閉じるのがプロセス', '閉じるのが工程',
    '閉じるのが手続き', '閉じるのが儀式', '閉じるが儀式',
    '閉じるのがセレモニー', '閉じるのが通過儀礼', '閉じるのが洗礼',
    '閉じるのが正攻法', '閉じるが正攻法', '閉じるのが堅実',
    '閉じるが堅実', '閉じるのが常套', '閉じるが常套',
    '閉じるのが常套手段', '閉じるのがお決まり', '閉じるがお決まり',
    '閉じるのがお約束', '閉じるがお約束',
    '閉じるのがスマート', '閉じるがスマート', '閉じるのがクール',
    '閉じるがクール', '閉じるのがイケてる', '閉じるのがおしゃれ',
    '閉じるのがスタイリッシュ', '閉じるのが主流', '閉じるが主流',
    '閉じるのがトレンド', '閉じるがトレンド', '閉じるのが推奨',
    '閉じるが推奨', '閉じるのが推奨事項', '閉じるがおすすめ',
    '閉じるのがイチオシ', '閉じるがイチオシ', '閉じるが好ましい',
    '閉じるのが喜ばしい', '閉じるのがスッキリ', '閉じるがスッキリ',
    '閉じるのがすっきり', '閉じるが心地よい', '閉じるのが快感',
    '閉じるが快感', '閉じるのが至福', '閉じるが至福',
    '閉じるのが幸せ', '閉じるが幸せ', '閉じるのが幸福',
    '閉じるのが極楽', '閉じるが極楽', '閉じるのが天国',
    // JA imperative variants + request residue
    '閉じなさいまして', '閉じなされませ', '閉じなされまして',
    '閉じなすって', '閉じなすってください', '閉じませ', '閉じませい',
    '閉じやがりなさい', '閉じてんし', '閉じやりなさい',
    '閉じあそばせ', '閉じあそばして', '閉じあそばし',
    '閉じなむ', '閉じなも', '閉じなもう', '閉じてぇん', '閉じてやぁ',
    '閉じたまえまし', '閉じたまえぞよ', '閉じるのだまし',
    '閉じてよかろう', '閉じてよからん',
    '閉じてくだされや', '閉じてくだされい', '閉じてくださんし',
    '閉じてくれさんし', '閉じてくださんせ', '閉じてくれんしゃい',
    '閉じてくれせんかい', '閉じてくれんやろか', '閉じてくれはらんか',
    '閉じてくれぬかもの', '閉じてくれぬかのう', '閉じてくれぬかしらん',
    '閉じてくれねえかな', '閉じてくれねえかのう',
    '閉じてくれぬものかな', '閉じてくれねえものか',
    '閉じてもらえぬものか', '閉じてもらえんものか',
    '閉じてもらえねえものか', '閉じていただけねえものか',
    // JA りゃ/たなら conditionals + volitional
    '閉じてくれりゃ嬉しい', '閉じてくれりゃ助かる',
    '閉じてくれりゃありがてえ', '閉じてくれりゃ万々歳',
    '閉じてくれりゃ最高', '閉じてくれりゃ文句なし',
    '閉じてくれりゃ言うことなし', '閉じてくれたなら嬉しい',
    '閉じてくれたなら助かる', '閉じてもらったなら嬉しい',
    '閉じてもらったなら助かる', '閉じてくれたなら幸い',
    '閉じないではおれない', '閉じないではいられない',
    '閉じるほかなかろう', '閉じるに限ろう',
  ])('JA %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    '閉じるべからず', '閉じるべからざるなり',
  ])('JA prohibition %s -> negate', (p) => {
    expect(key(mk(), p)).toBe('negate');
  });
});
