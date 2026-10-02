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
  // occupational-disease certified & compensation exam done
  'occupational-disease certified', 'compensation exam done',
];
const closeTabJa = [
  'じん肺', '塵肺',
  '炭鉱じん肺', '石綿健康被害',
  'アスベスト救済', '公害健康被害補償',
  '公害健康被害手当', '公害医療手当',
  '公害認定', '公害病',
  '職業性疾病', '職業病認定',
  '二次健康診断', '特殊健康診断',
  '定期健康診断', '雇入れ時健康診断',
];
const negate = [
  'still awaiting diagnosis',
  'まだ認定前', 'まだ職業性確認',
];
const nullPins = [
  'about to seek compensation', 'about to get screened',
];
const establishedPins = [
  ['通勤災害', 'close-tab'],
  ['これから被害申請', 'negate'],
  ['about to file the claim', 'negate'],
];

describe('pass DLXXVIII: occupational-disease & asbestos idioms (darbuka)', () => {
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
  test.each(establishedPins)('"%s" keeps pin %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
