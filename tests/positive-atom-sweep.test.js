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
  // registration filed & deed recorded
  'registration filed',
];
const closeTabJa = [
  '司法書士', '筆界確定',
  '登記官', '登記嘱託',
  '登記済証', '人権擁護',
  '刑事施設', '矯正',
  '保護観察所', '公安調査庁',
  '治安', '出入国在留管理庁',
  '入管', '難民認定',
  '上陸拒否',
  '強制送還', '仮放免',
  '国際刑事裁判', '検察審査会',
  '収容', '収容所',
  '登記簿', '登記済',
  '登記理由証明', '登記識別情報',
  '登記費用', '所有権登記',
  '抵当権設定',
];
const negate = [
  'still awaiting the registry review',
  'これから移転登記',
];
const nullPins = [
  'about to file the boundary petition',
  'about to visit the registry office',
];
const establishedPins = [
  ['まだ登記前', 'negate'],
];

describe('pass DCLXIII: legal-affairs bureau & registry administration idioms (positive)', () => {
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
