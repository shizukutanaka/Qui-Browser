/**
 * Voice atoms CCCXII — year-end & New Year close-out idioms (EN)
 * + 年末/年越し/見納め (JA). A year closing out ends the tab.
 * New-year beginnings and midnights stay out (midnight = sleep-mode).
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
  // --- year winding down ---
  'year wound down', 'year in the books', 'year ended',
  'the year is over', 'year comes to a close', 'years end',
  'end of the year', 'years end approaches', 'closing the year',
  'out with the old', 'turn of the year', 'as the year closes',
  'year draws to an end', 'year wrapped up', 'year reviewed',
  'year retrospect done', 'year in review done',
  // --- New Year's Eve ritual ---
  'ball dropped', 'the ball has dropped', 'countdown ended',
  'countdown hit zero', 'ten seconds left in the year',
  'times square emptied', 'auld lang syne sung',
  'sang auld lang syne', 'new years eve over', 'nye over',
  'new years eve ended', 'confetti swept up',
  'champagne finished', 'resolutions made', 'last toast of the year',
  'fireworks finale done', 'midnight passed', 'clock struck new year',
  // --- calendar / fiscal close ---
  'calendar turned', 'last page of the calendar',
  'calendar year ended', 'calendar flipped to january',
  'january first', 'first of january', 'new calendar up',
  'fiscal year closed', 'fy ended', 'fy closed', 'books closed for the year',
  'year end close done', 'year end accounting done',
  'annual report filed', 'year end settlement', 'books balanced for the year',
  // --- holidays over ---
  'holiday season ended', 'holidays over', 'christmas over',
  'yuletide over', 'twelve days over', 'epiphany passed',
  'tree came down', 'decorations down', 'lights taken down',
  'ornaments boxed', 'back from the holidays', 'winter break over',
];

const closeTabJa = [
  // --- 年末/年越し ---
  '年末', '年越し', '年越しそばを食べて', '大晦日',
  '年が明けて', '年が明けた', '新年が始まって', '除夜',
  '除夜の鐘', '除夜の鐘が鳴り終わって', '鐘が鳴り終わって',
  'カウントダウン終了', 'カウントダウンが終わって', 'ゆく年くる年終了',
  '師走', '見納め', '納め', '年末年始終了', '年の瀬',
  '一年が終わって', '今年も終わり', '今年が終わって',
  // --- 決算/年度末 ---
  '年度末', '年度替わり', '会計年度終了', '決算終了',
  '年末調整終了', '年度末処理', '決算を締めて', '帳簿を締めて',
  '年次報告完了', '歳末', '歳末セール終了',
  // --- 正月明け ---
  'お正月が終わって', '正月明け', '松の内', '松が取れて',
  '七草', '七草がゆを食べて', '年賀状をしまって',
  '飾りを片付けて', '門松を外して', 'しめ縄を外して',
  '鏡餅を下げて', '鏡開き', 'お年玉を配って', '初詣を済ませて',
  '冬休みが終わって', '連休明け', '年末休暇終了',
];

const negate = [
  'keep the holidays going', 'stay for new years', 'still celebrating',
  'まだ正月気分', 'お祝いを続けて', '年末気分のまま',
];

const nullPins = [
  // beginnings / mid-year
  'new year', 'happy new year', 'new years resolution', 'spring is coming',
  '新年', 'あけましておめでとう', '明けましておめでとう', '今年の目標',
  '初売り', '書き初め', '年中行事',
];

const establishedPins = [
  ['midnight struck', 'sleep-mode'],
  ['stroke of midnight', 'sleep-mode'],
  ['burn the midnight oil', 'negate'],
];

describe('Voice atoms CCCXII — year-end & New Year close-out idioms', () => {
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
