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
  // census form submitted & survey enumerator assigned
  'census form submitted', 'survey enumerator assigned',
];
const closeTabJa = [
  '国勢調査', '統計調査',
  '経済センサス', '事業所統計',
  '家計調査', '労働力調査',
  '消費者物価', '統計員',
  '調査票', 'オンライン回答',
  '回答義務', '統計法',
  '個票', '標本調査',
  '統計集計', '統計審議会',
  '基幹統計', '地域メッシュ',
];
const negate = [
  'still awaiting the census form',
  'まだ回答前', 'これから回答',
];
const nullPins = [
  'about to answer the census', 'about to call the enumerator',
];

describe('pass DXC: census & government-statistics idioms (sarangi)', () => {
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
