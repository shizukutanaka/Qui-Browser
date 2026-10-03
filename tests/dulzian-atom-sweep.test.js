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
  // landslide zone designated & retaining wall approved
  'landslide zone designated', 'retaining wall approved',
];
const closeTabJa = [
  '土砂災害', '急傾斜地',
  '警戒区域', '特別警戒区域',
  'イエローゾーン', 'レッドゾーン',
  '砂防指定地', '地すべり防止区域',
  '崩壊危険区域', '土石流',
  '警戒避難体制', 'ハザードマップ',
  '斜面崩壊', '崖地',
  '擁壁工事', 'のり面',
  '危険箇所', '土砂災害防止法',
];
const negate = [
  'still in the landslide zone',
  'まだ警戒前', 'これから指定申請',
];
const nullPins = [
  'about to build the retaining wall', 'about to mark the zone',
];

describe('pass DXCI: landslide-hazard & slope-disaster idioms (dulzian)', () => {
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
