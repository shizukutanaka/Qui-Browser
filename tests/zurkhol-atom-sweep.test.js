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
  // bank inspection completed & market misconduct fined
  'bank inspection completed', 'market misconduct fined',
];
const closeTabJa = [
  '金融庁', '金融庁検査',
  '証券取引等監視委員会', '金融商品取引法',
  '銀行検査', '金融監督',
  'インサイダー取引', '粉飾決算',
  '課徴金', '業務改善命令',
  '預金保険機構', '銀行免許',
  '証券会社登録', '投資運用業',
  '金融審議会', '銀行法',
  '保険業法', '信託業法',
  '貸金業法', '暗号資産',
  '仮想通貨交換業', '資金決済法',
  '破綻処理', '金融持株会社',
  '金融機関監督', '金融審査官',
];
const negate = [
  'still awaiting the banking license',
  'まだ認可申請前', 'これから免許申請',
];
const nullPins = [
  'about to file the securities registration',
  'about to inspect the bank',
];
const establishedPins = [
  // '不良債権' already pinned close-tab — registered '金融持株会社' instead
  ['不良債権', 'close-tab'],
  // 'まだ免許申請前' / 'これから登録申請' already pinned negate
  ['まだ免許申請前', 'negate'],
  ['これから登録申請', 'negate'],
];

describe('pass DCXXXVI: financial supervision administration idioms (zurkhol)', () => {
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
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
