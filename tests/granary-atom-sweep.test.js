const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeVC() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({
    getActiveTab: () => ({ id: 1 }),
    closeTab: () => {},
    tabs: () => [],
  });
  return vc;
}
const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

const closeTab = [
  'rice reserve released', 'grain stockpile rotated',
];
const closeTabJa = [
  // 食管・政府米
  '食管法', '主要食糧',
  '米穀', '米穀配給',
  '買入米', '備蓄米',
  '政府備蓄米',
  // 放出・証券
  '放出米', '競売入札',
  '食糧証券', '食糧費',
  // 麦・糖乳
  '小麦', '大麦',
  '裸麦', '国内産麦',
  '輸入麦', 'マークアップ',
  'てん菜糖', '原料糖',
  // 乳
  'バター輸入', '脱脂粉乳',
  '畜産振興機構', '生乳',
  '指定生乳生産者団体',
  // 需給
  '加工原料乳', '補給金',
  '食糧需給',
  // 米種別
  '米消費', '新米',
  '新穀', '玄米',
  '精米', 'もち米',
  // 稲作・流通
  'うるち米', '米価',
  '稲作', '水田',
  '転作田', '飼料用米',
  // 買付
  '輸入米', 'ミニマムアクセス',
  '買付入札', '売渡入札',
  // 検査・産地
  '備蓄米放出', '検査米',
  '一等米', '規格外米',
  '産地品種',
];
const negate = [
  'still awaiting the rice tender',
  'still awaiting the reserve release',
  'まだ放出前', 'まだ集荷前',
  'これから買付',
];
const nullPins = [
  'about to visit the grain depot',
  'about to file the stock report',
];
const establishedPins = [
  ['食糧管理法', 'close-tab'],
  ['政府米', 'close-tab'],
  ['米価審議会', 'close-tab'],
  ['関税割当', 'close-tab'],
  ['作況', 'close-tab'],
  ['まだ入札前', 'negate'],
  ['まだ納付前', 'negate'],
];

describe('pass DCXCVIII: staple-food supply & reserve administration (granary)', () => {
  let vc;
  beforeEach(() => { vc = makeVC(); });

  test.each(closeTab)('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(closeTabJa)('"%s" -> close-tab (ja)', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(negate)('"%s" -> negate', (p) => {
    expect(key(vc, p)).toBe('negate');
  });
  test.each(nullPins)('"%s" -> null', (p) => {
    expect(key(vc, p)).toBeNull();
  });
  test.each(establishedPins)('established pin "%s" stays %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected ?? null);
  });
});
