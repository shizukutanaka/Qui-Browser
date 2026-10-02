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
  // overpayment refund claim procedures done
  'overpayment claim filed', 'attorney consulted',
  'claim settled', 'debt barred',
];
const closeTabJa = [
  '過払い金', '過払い金請求',
  '返還請求', 'グレーゾーン',
  '引き直し計算', '利息制限法',
  '出資法', '払いすぎた利息',
  '取引履歴開示', '貸金業者',
  '和解交渉', '時効援用',
  '時効の中断', '債権者一覧',
];
const negate = [
  'still calculating interest',
  'まだ利息計算中', 'これから過払い請求',
];
const nullPins = [
  'mid negotiation',
];
const establishedPins = [
  ['refund recovered', 'close-tab'],
  ['about to file the claim', 'negate'],
];

describe('pass DXX: overpayment refund claim idioms (hansho)', () => {
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
