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
  'cartel fined', 'merger cleared',
];
const closeTabJa = [
  // 法制・機関
  '独占禁止法', '私的独占の禁止',
  '公取委', '競争政策',
  // 行為類型
  '不当景品類及び不当表示防止法', '私的独占',
  '不当な取引制限', 'カルテル',
  '価格カルテル', '入札談合',
  '市場分割', '共同行為',
  // 不公正取引
  '事業者団体', 'トラスト',
  '不公正な取引方法', '再販売価格維持',
  '再販', '優越的地位の濫用',
  '抱き合わせ販売', '排他条件付取引',
  '取引拒絶',
  // 企業結合
  '企業結合', '合併審査',
  '株式保有', '役員兼任',
  '集中規制', '持株会社',
  // 課徴・処分
  '課徴金減免', 'リーニエンシー',
  '確約手続', '排除措置命令',
  '審決', '犯則調査',
  // 景品・表示
  '景品類', '懸賞',
  '総付景品', '二重価格',
  // 下請
  '誇大広告', '下請代金支払遅延等防止法',
  '親事業者', '下請事業者',
  '買いたたき',
  // フリーランス・デジタル
  'フリーランス新法', 'フリーランス取引適正化法',
  '発注事業者', 'デジタルプラットフォーム取引透明化法',
  'プラットフォーム規制', '特定デジタルプラットフォーム',
];
const negate = [
  'still awaiting the merger review',
  'still awaiting the cartel ruling',
  'まだ合併前', 'まだ納付前',
];
const nullPins = [
  'about to visit the competition bureau',
  'about to file the merger notice',
];
const establishedPins = [
  ['公正取引委員会', 'close-tab'],
  ['景品表示法', 'close-tab'],
  ['課徴金', 'close-tab'],
  ['優良誤認', 'close-tab'],
  ['有利誤認', 'close-tab'],
  ['不当表示', 'close-tab'],
  ['下請法', 'close-tab'],
  ['まだ審査前', 'negate'],
  ['まだ申告前', 'negate'],
  ['これから申告', 'negate'],
];

describe('pass DCXCVII: antitrust & fair-trade administration (antler)', () => {
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
