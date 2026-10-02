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
  // post-filing tax & records wrap-up
  'tax paid', 'payment cleared',
  'records filed', 'shoebox emptied',
  'ledger closed', 'documents archived',
];
const closeTabJa = [
  '還付金が入って', '納付を済ませて',
  '書類を整理して', 'レシートを分けて',
  '書類を保管して', '延納を申請して',
];
const negate = [
  'still waiting for the refund', 'still sorting receipts',
  'まだ還付待ち', 'まだ書類整理中',
];
const nullPins = [
  'about to pay the tax', 'mid bookkeeping',
  'tax documents', 'refund status',
  'これから納付', '経理の途中',
  '確定申告書', '納付書',
];
const establishedPins = [
  ['refund arrived', 'close-tab'],
  ['refund deposited', 'close-tab'],
  ['receipts sorted', 'close-tab'],
  ['extension filed', 'close-tab'],
  ['還付金が振り込まれて', 'close-tab'],
  ['税金を払って', 'close-tab'],
  ['領収書をまとめて', 'close-tab'],
  ['帳簿を締めて', 'close-tab'],
];

describe('pass CDXXIV: post-filing tax & records idioms (nettle)', () => {
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
