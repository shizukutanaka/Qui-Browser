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
  // housing-support joined & safety-net registered
  'housing-support joined', 'safety-net registered',
];
const closeTabJa = [
  '住宅セーフティネット', '居住支援協議会',
  '円滑入居賃貸住宅', 'サポート付き住宅',
  '拒まない賃貸住宅', '高齢者住宅',
  '障害者住宅', '住宅確保要配慮者',
  '民間賃貸促進', '空き家再生',
  '家賃債務保証', '緊急連絡先登録',
  '見守りサービス', '居住支援団体',
  'あんしん入居',
];
const negate = [
  'still houseless',
  'まだ住宅探し中', 'これから入居審査',
];
const nullPins = [
  'about to apply for housing', 'about to move into supported housing',
];
const establishedPins = [];

describe('pass DLXXII: housing-safety-net & support idioms (maraca)', () => {
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
