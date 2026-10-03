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
  // pension claim approved & enrollment record issued
  'pension claim approved', 'enrollment record issued',
];
const closeTabJa = [
  '厚生年金', '被保険者',
  '第一号被保険者', '第三号被保険者',
  '報酬月額', '経過的加算',
  '在職定時改定', '年金額改定',
  'マクロ経済スライド', '物価スライド',
  '賃金スライド', '国民年金基金',
  '付加保険料', '老齢基礎年金',
  '老齢厚生年金', '障害基礎年金',
  '障害厚生年金', '障害手当金',
  '初診日', '認定基準',
  '年金証書', '裁定請求',
  '年金事務所', '社会保険労務士',
  '適用調査', '算定基礎届',
  '随時改定', '定時決定',
  '育児休業等終了時改定', '埋葬料',
  '確定給付企業年金', '企業型確定拠出年金',
];
const negate = [
  'still awaiting the pension ruling',
  'まだ裁定前', 'まだ請求前',
];
const nullPins = [
  'about to file the enrollment report',
  'about to join the pension fund',
];
const establishedPins = [
  ['基礎年金番号', 'close-tab'],
  ['年金手帳', 'close-tab'],
  ['加給年金', 'close-tab'],
  ['資格取得届', 'close-tab'],
  ['厚生年金基金', 'close-tab'],
  ['これから届出', 'negate'],
];

describe('pass DCLXVI: pension & social-insurance administration (rosin)', () => {
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
