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
  // food business licensed & food manager certified
  'food business licensed', 'food manager certified',
];
const closeTabJa = [
  '食品営業許可', '営業許可',
  '飲食店営業', '食品衛生法',
  '食品衛生管理者', '食品衛生責任者',
  '保健所営業許可', '食品届出',
  '容器包装届出', '給食施設',
  '給食管理', '衛生検査',
  'haccp認定', '食中毒届',
  '営業停止処分', '食品表示法',
  'アレルギー表示', '厨房衛生',
];
const negate = [
  'still awaiting the food license',
  'まだ営業許可前', 'これから営業届',
];
const nullPins = [
  'about to file the food business notice', 'about to license the kitchen',
];
const establishedPins = [
  ['臨時検査', 'close-tab'],
  ['これから届出', 'negate'],
];

describe('pass DXCIX: food-business & hygiene-license idioms (suona)', () => {
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
