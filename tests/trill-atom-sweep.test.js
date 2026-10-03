const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

const makeVC = () => {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({ getActiveTab: () => ({ id: 1 }), closeTab: () => {}, tabs: () => [] });
  return vc;
};
const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

const closeTab = [
  'bank charter granted', 'lender registered',
];
const closeTabJa = [
  '預金', '貯金',
  '銀行業', '信託銀行',
  '第二地方銀行',
  '中央銀行', '政府系金融機関',
  '政策投資銀行',
  '国際協力銀行', '銀行協会',
  '全銀協',
  '貸金業', '上限金利',
  'グレーゾーン金利',
  '総量規制', '指定信用情報機関',
  '信用情報',
  'サービサー', 'ファクタリング',
  'リース会社',
  'クレジットカード', '銀行代理業',
  '貸金業登録',
  '貸金業務取扱主任者', '返済能力調査',
  '信用供与',
  '与信', '融資審査',
];
const negate = [
  'まだ融資前', 'まだ与信前',
  'まだ借入前', 'これから借入',
  'まだ査定前',
];
const nullPins = [
  'about to visit the bank bureau',
  'about to file the lending report',
];
const establishedPins = [
  ['still awaiting the banking license', 'negate'],
  ['銀行法', 'close-tab'],
  ['預金保険機構', 'close-tab'],
  ['預金保険', 'close-tab'],
  ['ペイオフ', 'close-tab'],
  ['定期預金', 'close-tab'],
  ['普通預金', 'close-tab'],
  ['当座預金', 'close-tab'],
  ['銀行免許', 'close-tab'],
  ['地方銀行', 'close-tab'],
  ['信用金庫', 'close-tab'],
  ['信用組合', 'close-tab'],
  ['労働金庫', 'close-tab'],
  ['日本政策金融公庫', 'close-tab'],
  ['商工中金', 'close-tab'],
  ['貸金業法', 'close-tab'],
  ['利息制限法', 'close-tab'],
  ['出資法', 'close-tab'],
  ['債権回収', 'close-tab'],
  ['割賦販売', 'close-tab'],
  ['電子マネー', 'close-tab'],
  ['資金決済法', 'close-tab'],
  ['前払式支払手段', 'close-tab'],
  ['これから融資', 'negate'],
  ['まだ返済中', 'negate'],
  ['まだ審査中', 'negate'],
  ['まだ登録前', 'negate'],
  ['まだ開業前', 'negate'],
];

describe('pass DCCIII: banking, moneylending & credit (trill)', () => {
  let vc;
  beforeEach(() => { vc = makeVC(); });

  test.each(closeTab.map(p => [p]))('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(closeTabJa.map(p => [p]))('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(negate.map(p => [p]))('"%s" -> negate', (p) => {
    expect(key(vc, p)).toBe('negate');
  });
  test.each(nullPins.map(p => [p]))('"%s" -> null', (p) => {
    expect(key(vc, p)).toBeNull();
  });
  test.each(establishedPins.map(([p, k2]) => [p, k2]))('"%s" stays %s', (p, k2) => {
    expect(key(vc, p)).toBe(k2);
  });
});
