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
  // pension record & statement procedures done
  'pension statement checked',
  'record verified',
];
const closeTabJa = [
  'ねんきん定期便', 'ねんきんネット',
  '年金ダイヤル', '年金記録',
  '被保険者記録', '加入記録',
  '記録確認', '年金相談',
  '共済組合', '基金代行',
  '脱退一時金', '加入期間',
  '保険料納付状況', '見込額',
  '試算結果', '老齢年金',
  '特別支給', 'カード再交付',
];
const negate = [
  'still checking records',
  'まだ確認前', 'これから照会',
];
const nullPins = [
  'about to call',
];
const establishedPins = [
  ['標準報酬月額', 'close-tab'],
  ['基礎年金番号', 'close-tab'],
  ['まだ加入中', 'negate'],
];

describe('pass DXLVI: pension record & statement idioms (fife)', () => {
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
