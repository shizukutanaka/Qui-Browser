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
  // survivor pension claim procedures done
  'survivor pension claimed', 'unpaid pension claimed',
  'widow pension granted', 'death benefit received',
];
const closeTabJa = [
  '遺族年金', '遺族基礎年金',
  '遺族厚生年金', '未支給年金',
  '寡婦年金', '死亡一時金',
  '年金請求書', '生計維持',
  '同一世帯', '加算額',
  '中核家族', '除籍謄本',
  '受給権者',
];
const negate = [
  'still gathering documents', 'about to file the survivor claim',
  'まだ書類収集中', 'これから遺族年金請求',
];
const nullPins = [
  'mid claim review', 'claim rejected',
];
const establishedPins = [
  ['死亡届', 'close-tab'],
  ['死亡診断書', 'close-tab'],
];

describe('pass DXXII: survivor pension claim idioms (kei)', () => {
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
