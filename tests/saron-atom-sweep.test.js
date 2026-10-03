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
  // redevelopment association approved & rights converted
  'redevelopment association approved', 'rights converted',
];
const closeTabJa = [
  '再開発組合', '都市再開発',
  '第一種市街地再開発', '第二種市街地再開発',
  '再開発促進区域', '再開発実施',
  '権利変換', '再開発組合設立',
  '事業計画', '施行地区',
  '床販売', '保留床',
  '再開発調査', '地権者説明会',
  'まちづくり推進', '再開発事業',
  '市街地再開発事業', '優良建築物等整備事業',
  '再開発緊急整備', 'まちづくり団体',
  'まちづくり協定', 'まちづくり推進委員会',
];
const negate = [
  'still awaiting the redevelopment plan',
  'まだ再開発前', 'これから組合設立',
];
const nullPins = [
  'about to form the redevelopment board', 'about to convert the rights',
];
const establishedPins = [
  ['rights conversion done', 'about'],
  ['組合設立', 'close-tab'],
];

describe('pass DCVII: urban redevelopment association idioms (saron)', () => {
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
