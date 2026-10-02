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
  // foster parent certification & placement procedures done
  'foster license granted', 'child placed',
];
const closeTabJa = [
  '里親認定', '里親登録',
  '里親養親', '養育里親',
  '専門里親', '親戚里親',
  '里親研修', '基礎研修',
  '登録前研修', '研修修了',
  '認定委員会',
  '委託児童', '児童委託',
  '養育委託', '措置費',
  '養育費支給', '里親手当',
  '児童養護施設', 'ファミリーホーム',
  '委託解除', '児童自立支援施設',
  '社会的養護', '一時保護',
  '保護者支援', '里親会',
  '養育記録', '委託契約書',
];
const negate = [
  'still in training',
  'まだ里親', 'これから里親',
];
const nullPins = [
  'mid paperwork',
];
const establishedPins = [
  ['home study done', 'close-tab'],
  ['児童相談所', 'close-tab'],
  ['訪問調査', 'close-tab'],
  ['まだ研修中', 'negate'],
  ['about to apply', null],
];

describe('pass DXXXVIII: foster parent certification idioms (atsume)', () => {
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
