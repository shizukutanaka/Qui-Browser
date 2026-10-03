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
  // contract awarded & bid opening done
  'contract awarded', 'bid opening done',
];
const closeTabJa = [
  // 入札方式・公告
  '公共調達', '入札',
  '競争入札', '指名競争入札',
  '随意契約', '一般競争入札',
  '入札公告', '電子入札',
  // 価格・審査
  '最低制限価格', '調達基準価格',
  '予定価格', '価格競争',
  '技術提案', '総合評価方式',
  '経営事項審査', '入札参加資格',
  '競争参加資格',
  // 保証・契約
  '入札保証金', '契約保証金',
  '履行保証', '請負代金',
  '契約変更', '仕様書',
  // 当事者・不正
  '発注者', '受注者',
  '官製談合', '歩切り',
  // 調達種別
  '工事請負', '物品購入',
  '役務調達', '政府調達協定',
  '中央調達', '障害者優先調達',
];
const negate = [
  'still awaiting the award notice',
  'これから入札', 'まだ入札前',
];
const nullPins = [
  'about to file the bid',
  'about to attend the bid opening',
];
const establishedPins = [
  ['落札', 'close-tab'],
  ['下請負', 'close-tab'],
  ['完成検査', 'close-tab'],
  ['まだ契約前', 'negate'],
];

describe('pass DCLXXII: public procurement & bidding administration (shallot)', () => {
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
