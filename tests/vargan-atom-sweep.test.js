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
  // livestock grant approved & dairy quota allocated
  'livestock grant approved', 'dairy quota allocated',
];
const closeTabJa = [
  '畜産経営', '畜産振興',
  '家畜市場', '肉牛振興',
  '酪農家', '酪農振興',
  '養豚', '養鶏',
  '家畜改良', '家畜人工授精',
  '家畜保健衛生所', '家畜伝染病',
  '家畜防疫', '口蹄疫',
  '鳥インフルエンザ', '豚熱',
  '動物検疫', '輸入検疫',
  '家畜市場開設', '飼料米',
  '配合飼料', '粗飼料',
  '畜産農家', '畜産物価格',
  '酪農経営', '肉牛生産',
  '乳価', '生乳生産',
];
const negate = [
  'still awaiting the livestock permit',
  'まだ飼養前', 'これから飼育届',
];
const nullPins = [
  'about to file the herd registration',
  'about to join the dairy co-op',
];

describe('pass DCXLVI: livestock administration idioms (vargan)', () => {
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
});
