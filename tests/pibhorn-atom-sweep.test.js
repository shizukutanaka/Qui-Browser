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
  // survey business registered & benchmark survey done
  'survey business registered', 'benchmark survey done',
];
const closeTabJa = [
  '測量士', '測量士補',
  '測量業', '基本測量',
  '公共測量', '水準測量',
  '基準点測量', '地形測量',
  '写真測量', 'uav測量',
  '測量法', '測量登録',
  '測量基準点', '三角点',
  '水準点', '基準面',
  '座標系', '測地系',
  '建設コンサルタント', '測量成果',
  '測量技師', '測量計画機関',
];
const negate = [
  'still awaiting the survey registration',
  'まだ測量前', 'これから測量届',
];
const nullPins = [
  'about to register the survey firm', 'about to run the benchmark',
];

describe('pass DCVI: surveying business & benchmark idioms (pibhorn)', () => {
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
