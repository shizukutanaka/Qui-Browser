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
  // rainy-season end & summer-setup done
  'rainy season over', 'tsuyu lifted',
  'wardrobe switched', 'summer clothes out',
  'fan set up', 'ac serviced',
  'heat curtain up', 'mosquito net hung',
  'winter clothes stored', 'cold gear put away',
];
const closeTabJa = [
  '梅雨が明けて', '梅雨明けしました',
  '衣替えをして', '夏服を出して',
  '扇風機を出して', 'エアコンを掃除して',
  'すだれをかけて', '蚊帳を張って',
  '冬服をしまって', '防寒具をしまって',
];
const negate = [
  'still in rainy season', 'still humid',
  'まだ梅雨の中', 'まだ蒸し暑い',
];
const nullPins = [
  'about to switch wardrobe', 'mid tsuyu',
  'ac broken', 'wardrobe boxes',
  'これから衣替え', '梅雨の途中',
  'エアコン故障', '衣装ケース',
];
const establishedPins = [];

describe('pass CDXXV: tsuyu-lift & summer-setup idioms (orache)', () => {
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
