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
  // bills paid & autopay
  'rent paid', 'utilities paid',
  'paid the electric bill', 'water bill paid',
  'gas bill paid', 'internet bill paid',
  'set up autopay', 'direct debit done',
  // household budget & bookkeeping
  'household budget done', 'balanced the budget',
  'entered the expenses', 'bookkeeping done',
  'billing done',
];
const closeTabJa = [
  '家賃を払って', '電気代を払って',
  '水道代を払って', 'ガス代を払って',
  'ネット代を払って', '口座振替にして',
  '家計簿をつけて', '支出を記録して',
  '請求書を払って', '振り込みをして',
];
const negate = [
  'still paying bills', 'still doing the budget',
  'まだ支払い中', 'まだ家計簿中',
];
const nullPins = [
  'about to pay rent', 'mid bookkeeping',
  'utility bill', 'receipt book',
  'これから支払い', '記帳の途中',
  '請求書', '家計簿',
];
const establishedPins = [
  ['bills paid', 'close-tab'],
  ['公共料金を払って', 'close-tab'],
  ['引き落としを設定して', 'close-tab'],
];

describe('pass CDVIII: household bills & bookkeeping idioms (spinach)', () => {
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
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected);
  });
});
