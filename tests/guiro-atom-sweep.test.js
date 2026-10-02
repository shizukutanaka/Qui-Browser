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
  // newborn visit done & hearing screen passed
  'newborn visit done', 'hearing screen passed',
];
const closeTabJa = [
  '保健師', '助産師',
  '母乳相談', '離乳食指導',
  '母乳外来', '両親学級',
  '妊婦教室', '母親学級',
  '妊婦歯科健診', '妊婦健診券',
  '妊婦健診受診票', '出生連絡票',
  '乳児家庭全戸訪問', 'こんにちは赤ちゃん',
  '新生児聴覚検査', '新生児訪問指導',
];
const negate = [
  'still expecting the visit',
  'まだ健診前', 'これから相談訪問',
];
const nullPins = [
  'about to book the checkup', 'about to breastfeed',
];

describe('pass DLXXVI: maternal-health & newborn-visit idioms (guiro)', () => {
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
