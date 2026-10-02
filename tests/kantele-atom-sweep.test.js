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
  // community comprehensive support & care-prevention done
  'care plan approved',
  'prevention program joined',
];
const closeTabJa = [
  '地域包括支援センター', '包括支援センター',
  'ケアマネジメント', '介護予防ケア',
  '介護予防事業', '筋力向上訓練',
  '閉じこもり予防', '認知症予防',
  '介護予防教室', 'シルバーリハビリ',
  '高齢者見守り', '見守りネットワーク',
  '避難行動要支援者', '高齢者名簿',
  '地域包括ケア', '在宅医療連携',
];
const negate = [
  'still in care',
  'まだ利用前', 'これからケアプラン',
];
const nullPins = [
  'care manager', 'ケアマネ',
];
const establishedPins = [
  ['about to enroll', 'negate'],
  ['ケアプラン', 'close-tab'],
  ['about to volunteer', 'negate'],
];

describe('pass DL: community comprehensive support idioms (kantele)', () => {
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
