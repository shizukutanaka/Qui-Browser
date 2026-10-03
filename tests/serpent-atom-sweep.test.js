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
  // broker license granted & agency disclosure signed
  'broker license granted', 'agency disclosure signed',
];
const closeTabJa = [
  '宅地建物取引業', '宅建業免許',
  '宅地建物取引士', '宅建士',
  '宅建業免許更新', '契約書交付',
  '媒介契約', '専任媒介',
  '一般媒介', '専属専任',
  '媒介報酬', '国土交通大臣免許',
  '都道府県知事免許', '宅建業法',
  '宅地建物取引業者', '業務停止処分',
  '取引実績報告', '保証協会',
  '宅建業協会', '供託金',
  '営業保証金', '宅建試験',
  '宅建登録',
];
const negate = [
  'still awaiting the broker license',
  'まだ媒介前', 'これから媒介契約',
];
const nullPins = [
  'about to sign the agency agreement', 'about to file the brokerage',
];
const establishedPins = [
  ['まだ免許前', 'negate'],
  ['まだ登録前', 'negate'],
  ['まだ契約前', 'negate'],
];

describe('pass DCIV: real-estate brokerage license idioms (serpent)', () => {
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
  test.each(establishedPins)('pinned "%s" stays "%s"', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
