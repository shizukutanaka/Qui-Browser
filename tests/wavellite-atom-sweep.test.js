/**
 * Voice atoms CCCV — engagement-off / relationship-end idioms (EN)
 * + 破談/離縁/別れ (JA). Ending the engagement closes the tab.
 * Staying-together or starting forms stay null.
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function makeVC() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  const tabs = [{ id: 1, url: 'https://a.example', title: 'A' }];
  vc.connectBrowser({
    getActiveTab: () => tabs[0],
    closeTab: () => {},
    tabs: () => tabs,
  });
  return vc;
}

function key(vc, phrase) {
  const r = vc._matchCommand(phrase);
  return r && r.key;
}

const closeTab = [
  // --- calling off the wedding/engagement ---
  'call off the wedding', 'wedding is off', 'the weddings off',
  'engagement broken', 'engagement is off', 'broken engagement',
  'call off the engagement', 'break off the engagement',
  'gave back the ring', 'give the ring back', 'return the ring',
  'ring returned', 'no wedding bells', 'cancel the caterer',
  'left at the altar', 'jilted it', 'runaway bride',
  // --- breakup / dump ---
  'break it off', 'broke it off', 'breaking it off', 'breakup time',
  'dump it', 'dumped it', 'get dumped', 'kick it to the curb',
  'curb it', 'out on the curb', 'cut it loose', 'cut ties',
  'cut all ties', 'sever the tie', 'walk away from it',
  'walked away', 'done with it romantically', 'thats over between us',
  'we are through', 'through with it', 'over between us',
  'split up', 'split it up', 'parted ways', 'part ways with it',
  'go our separate ways', 'separate ways', 'calling it over',
  // --- divorce / papers ---
  'divorce papers', 'sign the papers', 'papers signed',
  'file for divorce', 'filed the papers', 'dissolve the union',
  'annulment', 'annul it', 'get an annulment', 'dissolution filed',
  'custody battle over', 'alimony settled', 'decree absolute',
  'decree nisi granted', 'irreconcilable differences', 'united it is not',
  'untying the knot', 'untie the knot', 'knot untied',
];

const closeTabJa = [
  // --- 破談/婚約解消 ---
  '破談', '婚約解消', '婚約を解消', '婚約破棄', '破棄して',
  '婚約を破って', '指輪を返して', '指輪を返却', '結婚をやめて',
  '結婚はなし', '結婚取り消し', '披露宴をキャンセル', '挙式中止',
  '結納を返して', 'エンゲージ解除', 'ブライダル解約',
  // --- 別れ/離縁 ---
  '別れて', '別れよう', 'お別れにして', '別れ話を切り出して',
  '縁を切って', '関係を清算', '関係を終わらせて', '付き合いを終えて',
  '縁を絶って', '絶縁して', '絶縁状を出して', '仲違いして',
  '疎遠にして', '距離を置いて', '冷却期間を置いて', '別居して',
  '出ていって', '家を出て行って', '追い出して', '追い出せ',
  // --- 離婚 ---
  '離婚', '離婚届', '離婚届を出して', '離婚して', '離縁',
  '離縁状', '三行半', '離婚調停', '協議離婚', '慰謝料を請求',
  '親権を取って', '籍を抜いて', '夫婦を解消', '婚姻を解消',
  // --- 振る/振られる ---
  '振って', '振ってしまって', '捨ててしまって', '見捨ててしまって',
  '愛想を尽かして', '見限って', '見切りをつけて', '諦めてしまって',
];

const negate = [
  'stay together', 'keep the ring', 'work it out', 'still engaged',
  'まだ付き合ってる', '別れないで', '関係を続けて',
];

const nullPins = [
  // starting / ongoing relationship — not ending
  'propose to it', 'pop the question', 'say yes', 'engagement party',
  'wedding bells soon', 'save the date', 'try on the ring',
  'bride to be', 'taking the plunge', 'set a date',
  '婚約', '婚約者', 'プロポーズ', '指輪を買って', '結婚式',
  '披露宴', '結納', '交際中', 'お付き合い', '同棲中',
];

const establishedPins = [
  ['別れないで', 'negate'],
  ['別れて', 'close-tab'],
  ['見捨てて', 'close-tab'],
];

describe('Voice atoms CCCV — engagement-off & breakup idioms', () => {
  test.each(closeTab.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(closeTabJa.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(negate.map((p) => [p]))('"%s" -> negate', (p) => {
    expect(key(makeVC(), p)).toBe('negate');
  });
  test.each(nullPins.map((p) => [p]))('"%s" -> null', (p) => {
    expect(key(makeVC(), p)).toBeNull();
  });
  test.each(establishedPins.map(([p, k]) => [p, k]))('"%s" -> %s', (p, k) => {
    expect(key(makeVC(), p)).toBe(k);
  });
});
