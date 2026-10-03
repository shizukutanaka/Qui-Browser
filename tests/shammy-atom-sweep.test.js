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
  // audit passed & license renewed (pin)
  'audit passed',
];
const closeTabJa = [
  // 決済・前払
  '前払式支払手段', '資金移動業者',
  '電子決済等代行業者', '収納代行',
  // 暗号資産
  '暗号資産交換業', 'ステーブルコイン',
  '仮想通貨交換所',
  // キャッシュレス
  'キャッシュレス', 'qrコード決済',
  '電子マネー', 'プリペイドカード',
  'ポイント還元',
  // AML・詐欺
  'マネーロンダリング', '犯罪収益移転防止法',
  '本人確認', 'ekyc',
  '振込詐欺', '反社会的勢力',
  '反社チェック',
  // 保険・保護
  '預金保険', 'ペイオフ',
  // 登録・信用
  '割賦販売', '消費者金融',
  '闇金', '行検',
  '登録金融機関', '認可金融機関',
];
const negate = [
  'still awaiting the examination',
  'still awaiting the registration number',
  'これから認可申請',
];
const nullPins = [
  'about to file the compliance report',
  'about to attend the regulatory hearing',
];
const establishedPins = [
  ['license renewed', 'close-tab'],
  ['金融商品取引法', 'close-tab'],
  ['貸金業法', 'close-tab'],
  ['資金決済法', 'close-tab'],
  ['暗号資産', 'close-tab'],
  ['特殊詐欺', 'close-tab'],
  ['インサイダー取引', 'close-tab'],
  ['課徴金', 'close-tab'],
  ['業務改善命令', 'close-tab'],
  ['貸金業者', 'close-tab'],
  ['金融庁検査', 'close-tab'],
  ['still awaiting the registration', 'negate'],
  ['まだ登録前', 'negate'],
  ['まだ免許前', 'negate'],
  ['これから届出', 'negate'],
  ['まだ審査中', 'negate'],
];

describe('pass DCLXXIII: financial regulation & payments administration (shammy)', () => {
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
