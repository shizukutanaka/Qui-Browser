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
  // child allowance & subsidy filings done (児童手当・給付届出の終了側)
  'allowance filed', 'subsidy approved',
  'benefit renewed', 'voucher redeemed',
  'daycare subsidy', 'application stamped',
  'eligibility checked', 'lump sum paid',
];
const closeTabJa = [
  '児童手当', '児童扶養手当',
  '助成金をもらって', 'クーポンを使って',
  '保育料を払って', '支給が決まって',
  '育児休業給付金', '一時金を受け取って',
];
const negate = [
  'まだ申請中', 'これから申請',
];
const nullPins = [
  'mid review', 'child allowance',
  '給付金',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['still applying', 'negate'],
  ['出生届を出して', 'close-tab'],
  // about to apply collides with thyme (CDIX) & yukhoe (CDXLIV)'s null pins — documented, not added
  ['about to apply', null],
];

describe('pass CDLXXV: child-allowance & subsidy-filing idioms (recorder)', () => {
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
