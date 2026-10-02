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
  // relocation & transfer expense settlement done (転勤/引っ越し費用精算の終了側)
  'expense settled', 'transfer allowance received',
  'relocation reimbursed', 'receipts submitted',
  'advance repaid', 'expense report approved',
  'settlement paid', 'moving costs covered',
  'allowance deposited',
];
const closeTabJa = [
  '引っ越し代が出て', '転勤手当',
  '引っ越し費用を精算して', '前払いを返して',
  '経費申請が通って', '交通費精算',
  '仮払い', '立替金',
  '赴任旅費',
];
const negate = [
  'still settling', 'about to settle',
  'まだ精算中', 'これから精算',
];
const nullPins = [
  'mid claim',
];
const establishedPins = [
  ['領収書をまとめて', 'close-tab'],
];

describe('pass CDLXXX: relocation expense-settlement idioms (veena)', () => {
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
