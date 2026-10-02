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
  // mortgage & auto loan
  'mortgage paid off', 'car loan done',
  'bank released title', 'pink slip in hand',
  'title in hand',
  // loan payoff
  'loan paid off', 'student loans gone',
  'closed the loan', 'promissory done',
  'balloon paid', 'lien released',
  'refinanced done',
  // card & balance
  'credit card paid off', 'balance zero',
  // payments complete
  'last payment made', 'final installment paid',
  'payments finished', 'all paid off',
  'made the last payment', 'debt free',
];
const closeTabJa = [
  'ローン完済', '住宅ローン終了',
  '最終返済', '残債を払って',
  '完済しました', '繰り上げ返済',
  '車のローン終了', '奨学金を返して',
  'リボ払い終了', '分割を払い終えて',
  '抵当権を抹消して', '所有権を取得して',
  'タイトルを受け取って', '引き落とし最終',
  '借り入れを返して', '無借金になって',
  'クレジットカードを払って', '最終回ローン',
];
const negate = [
  'still paying off the loan', 'still in debt',
  'still owe money',
  'まだ返済中', 'まだローン中',
];
const nullPins = [
  'about to refinance', 'mid loan',
  'loan agreement', 'payment plan', 'debt statement',
  '返済の途中', 'これから返済',
  '借入明細', '返済計画',
];
const establishedPins = [
  ['債務を整理して', 'close-tab'], ['借金を返して', 'close-tab'],
  ['payment due tomorrow', 'date'], ['明日返済', 'defer'],
];

describe('pass CCCLXXVII: loan payoff & debt-clear end idioms (hemlock)', () => {
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
