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
  // property/injury insurance claim procedures done
  'insurance claim settled', 'payout received',
  'claim denied', 'damage assessed',
];
const closeTabJa = [
  '傷害保険', '地震保険',
  '火災保険請求', '保険金請求',
  '損害保険', '保険金支払い',
  '鑑定人', '損害調査',
  '保険証券番号', '保険金額',
  '免責金額', '時価額',
  '新価', '見舞金支払い',
  '損害認定', '支払い拒否',
  '示談交渉', '再調査依頼',
];
const negate = [
  'still gathering receipts', 'about to file the damage claim',
  'まだ査定待ち', 'これから保険請求',
];
const nullPins = [
  'mid claim process',
];
const establishedPins = [
  ['adjuster visited', 'close-tab'],
];

describe('pass DXXVI: property/injury insurance claim idioms (horagai)', () => {
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
